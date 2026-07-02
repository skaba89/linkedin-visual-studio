/**
 * HERMÈS — Phase 4.3 — /api/integrations/test
 *
 * POST: test the connection for a set of credentials (without saving).
 * Used by the "Test" button in the integration setup modal.
 *
 * Request body:
 *   { provider: string, credentials: Record<string, string> }
 *
 * Response:
 *   { ok: boolean, message: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { testIntegrationConnection } from "@/lib/integrations/sync";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    void user; // Auth check only — no DB access needed
    const body = await req.json();

    if (!body.provider || typeof body.provider !== "string") {
      throw new HttpError(400, "Provider requis", "VALIDATION_ERROR");
    }
    if (!body.credentials || typeof body.credentials !== "object") {
      throw new HttpError(400, "Identifiants requis", "VALIDATION_ERROR");
    }

    const result = await testIntegrationConnection(body.provider, body.credentials);
    return NextResponse.json(result);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
