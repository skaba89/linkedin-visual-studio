/**
 * HERMÈS — Phase 4.3 — /api/integrations
 *
 * GET:    list all integrations for the authenticated user (without credentials)
 * POST:   create a new integration (validates credentials before saving)
 * PATCH:  update an integration (re-encrypts new credentials if provided)
 * DELETE: remove an integration
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { PROVIDERS, type ProviderId } from "@/lib/integrations/providers";
import {
  encryptCredentials,
  decryptCredentials,
  testIntegrationConnection,
} from "@/lib/integrations/sync";

export async function GET() {
  try {
    const user = await requireUser();
    const integrations = await db.integration.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncError: true,
        totalSynced: true,
        autoSyncEnabled: true,
        autoSyncCron: true,
        syncSettings: true,
        createdAt: true,
        updatedAt: true,
        // NOTE: credentials are NOT included in the response (security)
      },
    });

    // Map to include provider metadata
    const result = integrations.map((i) => ({
      ...i,
      providerMeta: PROVIDERS[i.provider as ProviderId] ?? null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const provider = body.provider as ProviderId;
    const name = body.name as string | undefined;
    const credentials = body.credentials as Record<string, string>;
    const syncSettings = body.syncSettings as Record<string, unknown> | undefined;

    const providerMeta = PROVIDERS[provider];
    if (!providerMeta) {
      throw new HttpError(400, "Provider non supporté", "VALIDATION_ERROR");
    }

    // Validate required fields
    for (const field of providerMeta.authFields) {
      if (field.required && !credentials[field.id]) {
        throw new HttpError(400, `Champ requis manquant: ${field.label}`, "VALIDATION_ERROR");
      }
    }

    // Test the connection before saving (fail-fast)
    const testResult = await testIntegrationConnection(provider, credentials);
    if (!testResult.ok) {
      throw new HttpError(400, `Connexion échouée: ${testResult.message}`, "VALIDATION_ERROR");
    }

    // Check if integration already exists (one per provider per user)
    const existing = await db.integration.findUnique({
      where: { userId_provider: { userId: user.id, provider } },
    });
    if (existing) {
      throw new HttpError(409, `Vous avez déjà une intégration ${providerMeta.name}`, "CONFLICT");
    }

    const integration = await db.integration.create({
      data: {
        userId: user.id,
        provider,
        name: name ?? providerMeta.name,
        credentials: encryptCredentials(credentials),
        syncSettings: JSON.stringify(syncSettings ?? {}),
        status: "active",
      },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json(integration, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
