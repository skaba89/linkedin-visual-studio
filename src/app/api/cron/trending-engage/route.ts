/**
 * HERMÈS — Phase 3.6 — Cron route: trending engagement
 *
 * Runs every 2 hours. For every user that has opted into engagement
 * auto-reply (UserSettings.engagementAutoReply = true):
 *   - Load unsynced TrendingTopic rows (status="new")
 *   - For each: find a target LinkedIn post via web search
 *   - Generate an expert comment via AI (anti-detection prompt)
 *   - Post the comment via the LinkedIn API
 *   - Update the topic with the comment text + URN + status
 *
 * Compliance is enforced at multiple layers:
 *   - UserSettings.engagementAutoReply (opt-in toggle)
 *   - UserSettings.engagementMaxDailyComments (daily cap)
 *   - UserSettings.engagementMinHoursBetween (spacing)
 *   - LinkedIn compliance module (dailyComments limit)
 *
 * Auth: protected by x-cron-secret header (see src/lib/cron/auth.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/auth";
import { engageTrendingTopicsForAllUsers } from "@/lib/linkedin/trending-engagement";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:trending-engage");

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    log.info("Trending engagement cron started");
    const result = await engageTrendingTopicsForAllUsers();
    log.info("Trending engagement cron done", {
      totalUsers: result.totalUsers,
      totalCommentsPosted: result.totalCommentsPosted,
      totalFailed: result.totalFailed,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    log.error("Trending engagement cron failed", {
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
