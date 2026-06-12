import { NextRequest, NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow";

// POST /api/data/workflows/execute — Execute a workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, triggerData } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 }
      );
    }

    const execution = await workflowEngine.executeWorkflow(workflowId, triggerData ?? {});

    return NextResponse.json({ execution });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to execute workflow", details: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/data/workflows/execute — Get execution history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);

    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 }
      );
    }

    const stats = await workflowEngine.getWorkflowStats(workflowId);
    const executions = await workflowEngine.getExecutionHistory(workflowId, limit);

    return NextResponse.json({ stats, executions });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch execution history", details: String(error) },
      { status: 500 }
    );
  }
}
