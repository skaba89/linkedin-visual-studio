/**
 * HERMÈS — R-001 / R-002 — /api/data/workflows/execute
 * Ajout de requireUser() au boundary.
 */
import { NextRequest, NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow";
import { requireUser } from "@/lib/session";
import { isHttpError } from "@/lib/http-error";

// POST /api/data/workflows/execute — Execute a workflow
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { workflowId, triggerData } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 },
      );
    }

    const execution = await workflowEngine.executeWorkflow(
      workflowId,
      triggerData ?? {},
      undefined,
      user.id,
    );

    return NextResponse.json({ execution });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Failed to execute workflow", details: String(err) },
      { status: 500 },
    );
  }
}

// GET /api/data/workflows/execute — Get execution history
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);

    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 },
      );
    }

    const stats = await workflowEngine.getWorkflowStats(workflowId);
    const executions = await workflowEngine.getExecutionHistory(workflowId, limit);

    return NextResponse.json({ stats, executions });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Failed to fetch execution history", details: String(err) },
      { status: 500 },
    );
  }
}
