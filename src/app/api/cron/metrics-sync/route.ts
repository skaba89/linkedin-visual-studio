/**
 * HERMÈS — Cron: LinkedIn metrics sync
 *
 * Called hourly. For every LinkedInPost with a linkedinUrn, fetches
 * current likes + comments counts from LinkedIn and updates the row.
 * Recomputes aggregate Metrics.tauxEngagement per user.
 *
 * Render Cron config:
 *   Schedule: 0 * * * *
 *   Command: curl -fsS -X POST \
 *     -H "x-cron-secret: $CRON_SECRET" \
 *     https://linkedin-visual-studio.onrender.com/api/cron/metrics-sync
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/auth";
import { syncAllUsersMetrics } from "@/lib/linkedin/metrics-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) return auth.response;

  const startedAt = Date.now();
  const result = await syncAllUsersMetrics();

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    ...result,
    // Drop the verbose per-post results to keep the response small
    results: result.results.map((r) => ({
      userId: r.userId,
      postsTotal: r.postsTotal,
      postsSynced: r.postsSynced,
      postsFailed: r.postsFailed,
    })),
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
