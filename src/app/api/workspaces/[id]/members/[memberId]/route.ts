/**
 * HERMÈS — Phase 4.4 — /api/workspaces/[id]/members/[memberId]
 *
 * PATCH:  update a member's role (admin only)
 * DELETE: remove a member from the workspace (admin only, owner cannot be removed)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { removeMember, updateMemberRole, type WorkspaceRole } from "@/lib/workspaces";

const VALID_ROLES: WorkspaceRole[] = ["admin", "member", "viewer"];

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, memberId } = await ctx.params;
    const body = await req.json();

    const newRole = body.role as WorkspaceRole;
    if (!VALID_ROLES.includes(newRole)) {
      throw new HttpError(400, "Rôle invalide", "VALIDATION_ERROR");
    }

    await updateMemberRole(id, memberId, newRole, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, memberId } = await ctx.params;

    await removeMember(id, memberId, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
