/**
 * HERMÈS — Cron job authentication
 *
 * Cron routes are public endpoints (no NextAuth session) but must NOT be
 * callable by anyone. They're called by Render Cron Jobs (or equivalent)
 * with a shared secret passed via the `x-cron-secret` header.
 *
 * The secret is set via the `CRON_SECRET` environment variable on the
 * server. If the env var is not set, cron jobs are disabled entirely
 * (fail-closed) — this prevents accidental exposure if the env is missing.
 *
 * Render Cron config (in Render dashboard → Cron Jobs):
 *   Schedule: every 5 minutes  (cron expression: 5-star with slash)
 *   Command:   curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
 *              https://linkedin-visual-studio.onrender.com/api/cron/agents
 *
 * The same pattern applies to /api/cron/metrics-sync (hourly) and
 * /api/cron/token-refresh (daily).
 */
import { NextRequest, NextResponse } from "next/server";

export interface CronAuthResult {
  ok: boolean;
  response?: NextResponse;
}

/**
 * Verify the x-cron-secret header against the server's CRON_SECRET env var.
 * Returns { ok: true } if authorized, or { ok: false, response } with a
 * 401 to short-circuit the route handler.
 *
 * Usage:
 *   const auth = verifyCronSecret(request);
 *   if (!auth.ok) return auth.response;
 */
export function verifyCronSecret(request: NextRequest): CronAuthResult {
  const expected = process.env.CRON_SECRET;

  // Fail-closed: if CRON_SECRET is not configured on the server, cron
  // routes are disabled. This prevents anyone from calling them when the
  // env var is missing (e.g. during local dev or a misconfigured deploy).
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "CRON_SECRET not configured — cron jobs disabled",
          code: "CRON_NOT_CONFIGURED",
        },
        { status: 503 },
      ),
    };
  }

  const provided = request.headers.get("x-cron-secret");

  // Constant-time comparison to prevent timing attacks on the secret.
  // Even though cron secrets are not as sensitive as auth tokens, this is
  // cheap and prevents information leakage via response timing.
  if (!provided || !constantTimeEquals(provided, expected)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "CRON_UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }

  return { ok: true };
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
