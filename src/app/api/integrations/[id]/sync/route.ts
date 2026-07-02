/**
 * HERMÈS — Phase 4.3 — /api/integrations/[id]/sync
 *
 * POST: trigger a manual sync of an integration.
 * Returns the sync result (synced, failed, errors).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { syncIntegration } from "@/lib/integrations/sync";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const integration = await db.integration.findUnique({ where: { id } });
    if (!integration) throw HttpError.notFound("Integration");
    assertOwnership(integration, user.id);

    const result = await syncIntegration(id);
    return NextResponse.json(result);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
