/**
 * HERMÈS — Phase 4.4 — /api/workspaces
 *
 * GET:  list the authenticated user's workspaces + their current workspace
 * POST: create a new workspace (the creator becomes the owner/admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { createWorkspace, listUserWorkspaces, getCurrentWorkspace } from "@/lib/workspaces";

export async function GET() {
  try {
    const user = await requireUser();
    const [workspaces, current] = await Promise.all([
      listUserWorkspaces(user.id),
      getCurrentWorkspace(user.id),
    ]);
    return NextResponse.json({ workspaces, current });
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

    if (!body.name || typeof body.name !== "string") {
      throw new HttpError(400, "Le nom du workspace est requis", "VALIDATION_ERROR");
    }

    const workspace = await createWorkspace(user.id, body.name);
    return NextResponse.json(workspace, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
