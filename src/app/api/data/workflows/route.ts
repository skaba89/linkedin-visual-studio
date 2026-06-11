import { NextRequest, NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow";

// GET /api/data/workflows — List all workflows
export async function GET() {
  try {
    const workflows = workflowEngine.getWorkflows();
    return NextResponse.json({ workflows });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch workflows", details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/data/workflows — Create a new workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, nodes, edges, tags, fromTemplate } = body;

    if (fromTemplate) {
      const workflow = workflowEngine.createFromTemplate(fromTemplate, name);
      if (!workflow) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ workflow }, { status: 201 });
    }

    if (!name) {
      return NextResponse.json(
        { error: "Workflow name is required" },
        { status: 400 }
      );
    }

    const workflow = workflowEngine.createWorkflow({
      name,
      description,
      nodes,
      edges,
      tags,
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create workflow", details: String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/data/workflows — Update a workflow
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 }
      );
    }

    const workflow = workflowEngine.updateWorkflow(id, updates);
    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ workflow });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update workflow", details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/data/workflows — Delete a workflow
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 }
      );
    }

    const deleted = workflowEngine.deleteWorkflow(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete workflow", details: String(error) },
      { status: 500 }
    );
  }
}
