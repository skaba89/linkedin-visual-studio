/**
 * HERMÈS — Phase 3.6 — Cron route: trending topic detection
 *
 * Runs daily at 6am UTC. For every user with a LinkedInAuth row:
 *   - Web-searches for current trending topics in their ICP sectors
 *   - Uses AI to structure them into TrendingTopic rows
 *   - Deduplicates against topics detected in the last 7 days
 *
 * Auth: protected by x-cron-secret header (see src/lib/cron/auth.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/auth";
import { detectTrendingTopicsForAllUsers } from "@/lib/linkedin/trending-engagement";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:trending-detect");

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    log.info("Trending detection cron started");
    const result = await detectTrendingTopicsForAllUsers();
    log.info("Trending detection cron done", {
      totalUsers: result.totalUsers,
      totalTopicsDetected: result.totalTopicsDetected,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    log.error("Trending detection cron failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}

export const GET = POST;
