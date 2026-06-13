import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// ─── Rate-limit store (in-memory, per-instance) ────────────────────────────────
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
  "/api/ai/chat",        // Uses its own API key auth
  "/api/ai/web-search",  // Uses its own API key auth
];

function shouldSkipAuth(pathname: string): boolean {
  return AUTH_SKIP_ROUTES.some((route) => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── 1. Security headers ──────────────────────────────────────────────────
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // ─── 2. Rate limiting for API routes ──────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
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
