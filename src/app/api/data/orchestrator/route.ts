import { NextResponse } from "next/server";
import { orchestrator } from "@/lib/orchestrator";
import { eventBus } from "@/lib/orchestrator";

export async function GET() {
  const state = orchestrator.getState();
  const metrics = orchestrator.getMetrics();
  const rules = orchestrator.getRules();
  const recentEvents = eventBus.getHistory(50);

  return NextResponse.json({
    state,
    metrics,
    rules,
    recentEvents,
  });
}
