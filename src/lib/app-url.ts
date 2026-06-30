/**
 * HERMÈS — Public URL resolver
 *
 * On Render (and most PaaS providers), the Next.js server binds to an internal
 * address (`0.0.0.0:10000`) behind a reverse proxy. When route handlers use
 * `request.url` or `request.nextUrl.host` to build redirect URLs, they get the
 * INTERNAL address, not the public one — browsers then receive a redirect to
 * `https://0.0.0.0:10000/...` which fails with ERR_ADDRESS_INVALID.
 *
 * This helper resolves the PUBLIC app URL using the following priority:
 *   1. `NEXTAUTH_URL` env var  (always set on Render — see render.yaml)
 *   2. `NEXT_PUBLIC_APP_URL` env var
 *   3. `X-Forwarded-Proto` + `X-Forwarded-Host` headers (set by Render's proxy)
 *   4. `request.nextUrl.protocol` + `request.nextUrl.host` (last resort —
 *      will be the internal address on Render, but works in local dev)
 *
 * Usage in API routes:
 *   import { appUrl, appUrlFor } from "@/lib/app-url";
 *
 *   // Build a redirect URL from a path:
 *   return NextResponse.redirect(appUrlFor(request, "/?linkedin=connected"));
 *
 *   // Get the base URL (e.g., for OAuth redirect_uri):
 *   const redirectUri = `${appUrl(request)}/api/linkedin/callback`;
 */

import type { NextRequest } from "next/server";

/**
 * Resolve the public base URL of the app (no trailing slash).
 * Examples:
 *   - Production (Render): "https://linkedin-visual-studio.onrender.com"
 *   - Local dev: "http://localhost:3000"
 */
export function appUrl(request?: NextRequest): string {
  // 1. Explicit env var (highest priority — always set on Render)
  const envUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, ""); // trim trailing slashes
  }

  // 2. X-Forwarded-* headers (set by Render's reverse proxy)
  if (request) {
    const forwardedProto =
      request.headers.get("x-forwarded-proto") ||
      request.nextUrl.protocol.replace(":", "");
    const forwardedHost = request.headers.get("x-forwarded-host");
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`;
    }
  }

  // 3. Last resort: request.nextUrl (will be internal address on Render,
  //    but works fine in local dev where there's no proxy)
  if (request) {
    return `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  }

  // 4. Absolute fallback (should never happen in practice)
  return "http://localhost:3000";
}

/**
 * Build an absolute URL from a path, using the resolved public app URL.
 *
 * @param request — the incoming NextRequest (used for header-based fallback)
 * @param path — the path (with or without leading slash), may include query/fragment
 * @returns absolute URL string
 *
 * Example:
 *   appUrlFor(request, "/?linkedin=connected")
 *   → "https://linkedin-visual-studio.onrender.com/?linkedin=connected"
 */
export function appUrlFor(request: NextRequest, path: string): string {
  const base = appUrl(request);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
