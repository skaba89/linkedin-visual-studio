/**
 * HERMÈS — Phase 4.4 — /api/workspaces/[id]
 *
 * GET:   workspace details + members list (members only)
 * PATCH: update workspace name (admin only)
 * DELETE: delete the workspace (owner only)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { listMembers } from "@/lib/workspaces";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const workspace = await db.workspace.findUnique({ where: { id } });
    if (!workspace) throw HttpError.notFound("Workspace");

    const members = await listMembers(id, user.id);

    return NextResponse.json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      ownerId: workspace.ownerId,
      createdAt: workspace.createdAt,
      members,
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();

    // Verify the user is an admin
    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: id, userId: user.id } },
    });
    if (!membership || membership.role !== "admin") {
      throw new HttpError(403, "Seuls les administrateurs peuvent modifier le workspace", "ADMIN_REQUIRED");
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }

    const updated = await db.workspace.update({
      where: { id },
      data,
      select: { id: true, name: true, slug: true, updatedAt: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const workspace = await db.workspace.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!workspace) throw HttpError.notFound("Workspace");

    if (workspace.ownerId !== user.id) {
      throw new HttpError(403, "Seul le propriétaire peut supprimer le workspace", "ADMIN_REQUIRED");
    }

    // Clear currentWorkspaceId for all members who had this workspace selected
    await db.userSettings.updateMany({
      where: { currentWorkspaceId: id },
      data: { currentWorkspaceId: null },
    });

    await db.workspace.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
