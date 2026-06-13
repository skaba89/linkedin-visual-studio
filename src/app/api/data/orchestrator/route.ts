import { NextResponse } from "next/server";
import { orchestrator } from "@/lib/orchestrator";
import { eventBus } from "@/lib/orchestrator";

export async function GET() {
  const state = await orchestrator.getState();
  const metrics = await orchestrator.getMetrics();
  const rules = await orchestrator.getRules();
  const recentEvents = await eventBus.getHistory(50);

  return NextResponse.json({
    state,
    metrics,
    rules,
    recentEvents,
  });
}
