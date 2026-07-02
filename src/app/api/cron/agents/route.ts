/**
 * HERMÈS — Cron: scheduled post publisher
 *
 * Called every 5 minutes by Render Cron. Publishes all scheduled posts
 * that are due, across ALL users.
 *
 * Without this cron, scheduled posts only fire when the user opens the
 * HERMÈS schedule UI — so a post scheduled for 8am Monday silently
 * doesn't publish until the user logs back in. With this cron, posts
 * fire on time regardless of whether the user is online.
 *
 * Render Cron config:
 *   Schedule: every 5 minutes
 *   Command: curl -fsS -X POST \
 *     -H "x-cron-secret: $CRON_SECRET" \
 *     https://linkedin-visual-studio.onrender.com/api/cron/agents
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/auth";
import { publishAllDuePosts } from "@/lib/linkedin/scheduled-posts";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — Render cron timeout

export async function POST(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) return auth.response;

  const startedAt = Date.now();
  const results = await publishAllDuePosts();

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    total: results.length,
    published: results.filter((r) => r.status === "published").length,
    failed: results.filter((r) => r.status === "failed").length,
    results: results.slice(0, 50), // cap response size
  });
}

// Also allow GET for simple curl testing without -X POST
export async function GET(request: NextRequest) {
  return POST(request);
}
