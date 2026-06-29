/**
 * HERMÈS — R-001 / R-002 — /api/data/orchestrator
 *
 * Ajout de requireUser() au boundary pour authentifier la route.
 *
 * TODO (R-002 deep) : `orchestrator` + `eventBus` opèrent sur un état global.
 * Pour l'isolation multi-tenant, le moteur devrait accepter un `userId` et
 * charger l'OrchestratorState filtré par userId.
 */
import { NextResponse } from "next/server";
import { orchestrator } from "@/lib/orchestrator";
import { eventBus } from "@/lib/orchestrator";
import { requireUser } from "@/lib/session";
import { isHttpError } from "@/lib/http-error";

export async function GET() {
  try {
    await requireUser();
    const state = await orchestrator.getState();
    const metrics = await orchestrator.getMetrics();
    const rules = await orchestrator.getRules();
    const recentEvents = await eventBus.getHistory(50);

    return NextResponse.json({ state, metrics, rules, recentEvents });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
