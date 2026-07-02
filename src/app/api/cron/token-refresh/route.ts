/**
 * HERMÈS — Cron: LinkedIn token refresh
 *
 * Called daily. For every user with a LinkedInAuth row, checks if their
 * access token is within 7 days of expiry; if so, calls LinkedIn's
 * /oauth/v2/accessToken with grant_type=refresh_token to get a fresh
 * 60-day token. This is what keeps users logged into LinkedIn
 * indefinitely without having to re-authenticate every 60 days.
 *
 * Requires LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET env vars.
 *
 * Render Cron config:
 *   Schedule: 0 3 * * *   (3am UTC daily)
 *   Command: curl -fsS -X POST \
 *     -H "x-cron-secret: $CRON_SECRET" \
 *     https://linkedin-visual-studio.onrender.com/api/cron/token-refresh
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/auth";
import { refreshAllExpiringTokens } from "@/lib/linkedin/token-refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) return auth.response;

  const startedAt = Date.now();
  const result = await refreshAllExpiringTokens();

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    ...result,
    // Drop the per-user results to keep response small
    results: result.results.map((r) => ({
      userId: r.userId,
      status: r.status,
    })),
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
