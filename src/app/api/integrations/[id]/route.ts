/**
 * HERMÈS — Phase 4.3 — /api/integrations/[id]
 *
 * DELETE: remove an integration
 * PATCH:  update name, status, autoSync settings, or credentials
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { encryptCredentials, testIntegrationConnection } from "@/lib/integrations/sync";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const integration = await db.integration.findUnique({ where: { id } });
    if (!integration) throw HttpError.notFound("Integration");
    assertOwnership(integration, user.id);

    await db.integration.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();

    const integration = await db.integration.findUnique({ where: { id } });
    if (!integration) throw HttpError.notFound("Integration");
    assertOwnership(integration, user.id);

    const data: Record<string, unknown> = {};

    if (typeof body.name === "string") data.name = body.name;
    if (typeof body.status === "string") {
      if (!["active", "paused", "error", "disconnected"].includes(body.status)) {
        throw new HttpError(400, "Statut invalide", "VALIDATION_ERROR");
      }
      data.status = body.status;
    }
    if (typeof body.autoSyncEnabled === "boolean") data.autoSyncEnabled = body.autoSyncEnabled;
    if (typeof body.autoSyncCron === "string") data.autoSyncCron = body.autoSyncCron;
    if (body.syncSettings && typeof body.syncSettings === "object") {
      data.syncSettings = JSON.stringify(body.syncSettings);
    }

    // Re-encrypt new credentials if provided
    if (body.credentials && typeof body.credentials === "object") {
      const newCreds = body.credentials as Record<string, string>;
      // Test the new connection before saving
      const testResult = await testIntegrationConnection(integration.provider, newCreds);
      if (!testResult.ok) {
        throw new HttpError(400, `Nouveaux identifiants invalides: ${testResult.message}`, "VALIDATION_ERROR");
      }
      data.credentials = encryptCredentials(newCreds);
    }

    const updated = await db.integration.update({
      where: { id },
      data,
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        autoSyncEnabled: true,
        autoSyncCron: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
