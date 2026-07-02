/**
 * HERMÈS — Phase 3.7 — /api/data/reactors/sync-crm
 *
 * POST: trigger CRM sync for unsynced reactors of the authenticated user.
 * Returns the sync result (created, linked, skipped, failed counts).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { syncReactorsToCrmForUser } from "@/lib/linkedin/reactor-crm-sync";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function POST(_req: NextRequest) {
  try {
    const user = await requireUser();
    const result = await syncReactorsToCrmForUser(user.id, 200);
    return NextResponse.json(result);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
