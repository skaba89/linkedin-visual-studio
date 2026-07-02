/**
 * HERMÈS — Phase 3.6 — Cron route: reactor capture
 *
 * Runs every 2 hours. For every user with a LinkedInAuth row:
 *   1. Capture likes + comments on their LinkedIn posts (LinkedInReactor rows)
 *   2. Sync unsynced reactors into the CRM as Contacts
 *
 * Auth: protected by x-cron-secret header (see src/lib/cron/auth.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/auth";
import { captureReactorsForAllUsers } from "@/lib/linkedin/reactor-capture";
import { syncReactorsToCrmForAllUsers } from "@/lib/linkedin/reactor-crm-sync";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:reactor-capture");

// Render cron jobs have a 5-min timeout (300s). Cap our work accordingly.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    log.info("Reactor capture cron started");
    const captureResult = await captureReactorsForAllUsers();
    log.info("Reactor capture cron done", {
      totalUsers: captureResult.totalUsers,
      totalLikesCaptured: captureResult.totalLikesCaptured,
      totalCommentsCaptured: captureResult.totalCommentsCaptured,
    });

    const crmSyncResult = await syncReactorsToCrmForAllUsers();
    log.info("Reactor CRM sync cron done", {
      totalUsers: crmSyncResult.totalUsers,
      totalCreated: crmSyncResult.totalCreated,
      totalLinked: crmSyncResult.totalLinked,
    });

    return NextResponse.json({
      ok: true,
      capture: captureResult,
      crmSync: crmSyncResult,
    });
  } catch (err) {
    log.error("Reactor capture cron failed", {
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

// Allow GET for Render cron jobs that don't support POST
export const GET = POST;
