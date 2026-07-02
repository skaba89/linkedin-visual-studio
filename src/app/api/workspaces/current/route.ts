/**
 * HERMÈS — Phase 4.4 — /api/workspaces/current
 *
 * POST: switch the user's current workspace (or pass null for personal mode)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { switchWorkspace } from "@/lib/workspaces";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const workspaceId = body.workspaceId ?? null;

    if (workspaceId !== null && typeof workspaceId !== "string") {
      throw new HttpError(400, "workspaceId doit être une string ou null", "VALIDATION_ERROR");
    }

    await switchWorkspace(user.id, workspaceId);
    return NextResponse.json({ ok: true, currentWorkspaceId: workspaceId });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
