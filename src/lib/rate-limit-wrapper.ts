/**
 * HERMÈS — R-007 — Route-level rate-limit wrapper
 *
 * Wraps a Next.js API route handler to apply rate-limiting before the handler
 * runs. Useful when:
 *  - The middleware cannot identify the category (e.g., dynamic routes)
 *  - You want per-userId (not per-IP) limiting
 *  - You want to skip rate-limit in tests
 *
 * Usage:
 *   import { withRateLimit } from "@/lib/rate-limit-wrapper";
 *
 *   export const POST = withRateLimit("register", async (req) => {
 *     // ... handler body
 *   });
 *
 * Or with options:
 *   export const POST = withRateLimit(
 *     "ai",
 *     async (req, ctx) => {
 *       const user = ctx.user; // optional injected user
 *       // ...
 *     },
 *     { identifyByUserId: true }
 *   );
 */

import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitHeaders,
  type RateLimitCategory,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { getSession } from "@/lib/session";

export interface RateLimitContext {
  /** The authenticated user id, if `identifyByUserId: true` was set. */
  userId?: string;
  /** The rate-limit result for this request (useful for logging). */
  rateLimit: RateLimitResult;
}

export interface WithRateLimitOptions {
  /**
   * If true, the wrapper will resolve the user id from the session and use
   * it as the rate-limit key (instead of IP). Falls back to IP if no session.
   * Default: false (IP-based).
   */
  identifyByUserId?: boolean;
  /**
   * Skip rate-limiting entirely. Useful for tests or admin overrides.
   * Default: false.
   */
  skip?: boolean;
}

/**
 * Extract the client IP from common proxy headers.
 */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Wrap a route handler with rate-limiting.
 *
 * On 429, returns a JSON error with standard rate-limit headers.
 * On success, calls the handler with an extra `ctx` argument containing
 * the rate-limit result (and userId if `identifyByUserId` was set).
 *
 * @example
 *   export const POST = withRateLimit("register", handler);
 *   export const GET = withRateLimit("ai", handler, { identifyByUserId: true });
 */
export function withRateLimit<TArgs extends unknown[]>(
  category: RateLimitCategory,
  handler: (req: NextRequest, ctx: RateLimitContext, ...args: TArgs) => Promise<Response> | Response,
  options: WithRateLimitOptions = {},
): (req: NextRequest, ...args: TArgs) => Promise<Response> {
  const { identifyByUserId = false, skip = false } = options;

  return async function rateLimitedHandler(req: NextRequest, ...args: TArgs): Promise<Response> {
    if (skip) {
      // Bypass — useful for tests
      const fakeCtx: RateLimitContext = {
        rateLimit: {
          allowed: true,
          limit: 0,
          remaining: 0,
          resetAt: 0,
          retryAfter: 0,
        },
      };
      return handler(req, fakeCtx, ...args);
    }

    const ip = getClientIp(req);
    let userId: string | undefined;

    if (identifyByUserId) {
      const session = await getSession();
      if (session?.user?.id) {
        userId = session.user.id;
      }
    }

    const result = await checkRateLimit(category, ip, userId);

    if (!result.allowed) {
      const headers = rateLimitHeaders(result);
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
            retryAfter: result.retryAfter,
          },
        },
        { status: 429, headers },
      );
    }

    const ctx: RateLimitContext = { userId, rateLimit: result };
    const response = await handler(req, ctx, ...args);

    // Attach rate-limit headers to successful responses too
    if (response instanceof NextResponse) {
      const headers = rateLimitHeaders(result);
      for (const [k, v] of Object.entries(headers)) {
        response.headers.set(k, v);
      }
    }

    return response;
  };
}

/**
 * Apply rate-limit headers to an existing response (without short-circuiting).
 *
 * Useful when the middleware has already done the check and you just need
 * to attach the headers to the final response.
 */
export function applyRateLimitHeaders(
  response: NextResponse | Response,
  result: RateLimitResult,
): void {
  const headers = rateLimitHeaders(result);
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v);
  }
}
