import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  generateNonce,
  applySecurityHeaders,
} from "@/lib/security-headers";

// ─── Rate-limit store (in-memory, per-instance) ────────────────────────────────
// NOTE (Volume 2 §6) : ce rate-limit local est conservé comme fallback
// défensif. Le rate-limit distribué Upstash Redis (R-007) doit être appliqué
// dans les handlers API eux-mêmes pour être partagé entre instances.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // requests per window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

// ─── Routes that skip auth entirely ────────────────────────────────────────────
const AUTH_SKIP_ROUTES = [
  "/api/auth",           // NextAuth endpoints (sign-in, sign-out, callbacks)
  "/api/health",         // Health check for Render/monitoring
  "/api/ai/chat",        // Uses its own API key auth
  "/api/ai/web-search",  // Uses its own API key auth
  "/api/csp-report",     // Endpoint de reporting CSP (POST)
];

function shouldSkipAuth(pathname: string): boolean {
  return AUTH_SKIP_ROUTES.some((route) => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── 1. Security headers + CSP nonce per-request ─────────────────────────
  // R-010 — Headers de sécurité (Volume 2 chapitre 9)
  // Le nonce est régénéré à chaque requête et injecté dans <Script nonce={...}>
  // côté layout racine via request.headers.get('x-nonce').
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  applySecurityHeaders(response, nonce);

  // ─── 2. Rate limiting for API routes ──────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }
  }

  // ─── 3. NextAuth session check for protected API routes ───────────────────
  if (pathname.startsWith("/api/") && !shouldSkipAuth(pathname)) {
    // In development, skip auth entirely for easy testing
    if (process.env.NODE_ENV !== "production") {
      return response;
    }

    // Check for a NextAuth JWT session cookie
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET ?? "hermes-dev-secret-change-in-production",
    });

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all API routes and page routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, etc.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|favicon-.*\\.png|apple-touch-icon\\.png|site\\.webmanifest).*)",
  ],
};
