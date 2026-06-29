/**
 * HERMÈS — R-001 / R-002 — /api/data/workflows
 *
 * Ajout de requireUser() au boundary.
 *
 * TODO (R-002 deep) : `workflowEngine` opère sur un état global. Pour l'isolation
 * multi-tenant, le moteur devrait accepter un userId et filtrer les workflows
 * par userId. Cf. Volume 3 §R-011 (defineWorkflow/executeRun pattern) qui
 * propose une refonte complète stateful.
 */
import { NextRequest, NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow";
import { requireUser } from "@/lib/session";
import { isHttpError } from "@/lib/http-error";

// GET /api/data/workflows — List all workflows
export async function GET() {
  try {
    await requireUser();
    const workflows = await workflowEngine.getWorkflows();
    return NextResponse.json({ workflows });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Failed to fetch workflows", details: String(err) },
      { status: 500 },
    );
  }
}

// POST /api/data/workflows — Create a new workflow
export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const body = await request.json();
    const { name, description, nodes, edges, tags, fromTemplate } = body;

    if (fromTemplate) {
      const workflow = await workflowEngine.createFromTemplate(fromTemplate, name);
      if (!workflow) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      return NextResponse.json({ workflow }, { status: 201 });
    }

    if (!name) {
      return NextResponse.json(
        { error: "Workflow name is required" },
        { status: 400 },
      );
    }

    const workflow = await workflowEngine.createWorkflow({
      name,
      description,
      nodes,
      edges,
      tags,
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Failed to create workflow", details: String(err) },
      { status: 500 },
    );
  }
}

// PUT /api/data/workflows — Update a workflow
export async function PUT(request: NextRequest) {
  try {
    await requireUser();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 },
      );
    }

    const workflow = await workflowEngine.updateWorkflow(id, updates);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    return NextResponse.json({ workflow });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Failed to update workflow", details: String(err) },
      { status: 500 },
    );
  }
}

// DELETE /api/data/workflows — Delete a workflow
export async function DELETE(request: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 },
      );
    }

    const deleted = await workflowEngine.deleteWorkflow(id);
    if (!deleted) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Failed to delete workflow", details: String(err) },
      { status: 500 },
    );
  }
}
