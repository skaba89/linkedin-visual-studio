/**
 * HERMÈS — Phase 4.4 — /api/workspaces/[id]/members
 *
 * GET:   list workspace members (members only)
 * POST:  invite a new member (admin only)
 *        Body: { email, role }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { listMembers, inviteMember, type WorkspaceRole } from "@/lib/workspaces";

const VALID_ROLES: WorkspaceRole[] = ["admin", "member", "viewer"];

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const members = await listMembers(id, user.id);
    return NextResponse.json(members);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();

    if (!body.email || typeof body.email !== "string") {
      throw new HttpError(400, "Email requis", "VALIDATION_ERROR");
    }
    const role = (body.role ?? "member") as WorkspaceRole;
    if (!VALID_ROLES.includes(role)) {
      throw new HttpError(400, "Rôle invalide", "VALIDATION_ERROR");
    }

    const result = await inviteMember(id, body.email.toLowerCase(), role, user.id);

    // Build the invite URL (for the UI to display — email sending is optional)
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl}/workspaces/invite?token=${result.token}`;

    return NextResponse.json({
      id: result.id,
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
      inviteUrl,
    }, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
