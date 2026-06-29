/**
 * HERMÈS — R-001 / R-002 — /api/data/compliance
 *
 * Ajout de requireUser() au boundary pour authentifier la route.
 *
 * TODO (R-002 deep) : `linkedInCompliance` opère actuellement sur un état global
 * (singleton). Pour la vraie isolation multi-tenant, le moteur devrait accepter
 * un `userId` et chargerer l'état (ComplianceState) depuis la base filtré par
 * userId. Cf. Volume 1 §R-002 + Volume 2 §R-002.
 */
import { NextResponse } from "next/server";
import { linkedInCompliance } from "@/lib/compliance";
import { requireUser } from "@/lib/session";
import { isHttpError } from "@/lib/http-error";

export async function GET() {
  try {
    await requireUser();
    const status = await linkedInCompliance.getStatus();
    const warmupInfo = await linkedInCompliance.getWarmupInfo();

    return NextResponse.json({ status, warmupInfo });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
