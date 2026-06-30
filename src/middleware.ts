import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  generateNonce,
  applySecurityHeaders,
} from "@/lib/security-headers";
import {
  resolveCategory,
  checkRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";

// ─── Routes that skip auth entirely ────────────────────────────────────────────
const AUTH_SKIP_ROUTES = [
  "/api/auth",              // NextAuth endpoints (sign-in, sign-out, callbacks, session)
  "/api/health",            // Health check for Render/monitoring
  "/api/ai/",               // All AI routes use their own x-api-key auth (chat, web-search, generate-*)
  "/api/linkedin/auth",     // Starts the LinkedIn OAuth flow (must be reachable pre-login)
  "/api/linkedin/callback", // LinkedIn OAuth callback (called by LinkedIn's redirect)
  "/api/setup/",            // One-time setup endpoints (migration trigger, etc.) — protected by MIGRATION_KEY
  "/api/csp-report",        // Endpoint de reporting CSP (POST)
];

function shouldSkipAuth(pathname: string): boolean {
  return AUTH_SKIP_ROUTES.some((route) => pathname.startsWith(route));
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ─── 1. Security headers + CSP nonce per-request ─────────────────────────
  // R-010 — Headers de sécurité (Volume 2 chapitre 9)
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  applySecurityHeaders(response, nonce);

  // ─── 2. Rate limiting (R-007) ─────────────────────────────────────────────
  // Apply to all /api/* routes with category-specific limits.
  // Per-IP by default; the withRateLimit() wrapper can switch to per-userId
  // for sensitive endpoints (register, ai, etc.).
  if (pathname.startsWith("/api/")) {
    const category = resolveCategory(pathname, method);
    if (category) {
      const ip = getClientIp(request);
      // Don't await session here — middleware rate-limits per-IP for simplicity.
      // Per-userId limiting happens in the route handler via withRateLimit().
      const rl = await checkRateLimit(category, ip);

      // Attach rate-limit headers to ALL responses (including successful ones)
      const headers = rateLimitHeaders(rl);
      for (const [k, v] of Object.entries(headers)) {
        response.headers.set(k, v);
      }

      if (!rl.allowed) {
        return NextResponse.json(
          {
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests. Please try again later.",
              retryAfter: rl.retryAfter,
            },
          },
          {
            status: 429,
            headers: rateLimitHeaders(rl),
          },
        );
      }
    }
  }

  // ─── 3. NextAuth session check for protected API routes ───────────────────
  if (pathname.startsWith("/api/") && !shouldSkipAuth(pathname)) {
    // In development, skip auth entirely for easy testing
    if (process.env.NODE_ENV !== "production") {
      return response;
    }

    // Check for a NextAuth JWT session cookie
    // NOTE: do NOT add a fallback secret here — auth-config.ts has no fallback
    // in production, so a mismatch would cause every request to be rejected
    // with 401. If NEXTAUTH_SECRET is unset, both sides fail consistently.
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
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
