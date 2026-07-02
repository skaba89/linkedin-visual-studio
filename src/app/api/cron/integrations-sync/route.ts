/**
 * HERMÈS — Phase 4.3 — /api/cron/integrations-sync
 *
 * Cron job that runs every 6 hours to sync all active integrations.
 *
 * Schedule: "0 *\/6 * * *" (every 6 hours)
 *
 * Auth: x-cron-secret header (verified by verifyCronSecret)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/auth";
import { syncAllIntegrations } from "@/lib/integrations/sync";
import { createLogger } from "@/lib/logger";

export const maxDuration = 300;
export const runtime = "nodejs";

const log = createLogger("cron-integrations-sync");

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log.info("Cron: starting integrations sync");

  try {
    await syncAllIntegrations();
    log.info("Cron: integrations sync completed");
    return NextResponse.json({ ok: true, syncedAt: new Date().toISOString() });
  } catch (err) {
    log.error("Cron: integrations sync failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Sync failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
