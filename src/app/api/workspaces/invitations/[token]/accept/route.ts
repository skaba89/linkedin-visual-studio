/**
 * HERMÈS — Phase 4.4 — /api/workspaces/invitations/[token]/accept
 *
 * POST: accept a workspace invitation by token.
 * The user must be authenticated — the invitation is matched by email
 * to verify it was sent to the right person.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { acceptInvitation } from "@/lib/workspaces";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    const user = await requireUser();
    const { token } = await ctx.params;

    // Verify the invitation email matches the user's email
    const invitation = await db.workspaceInvitation.findUnique({
      where: { token },
      select: { email: true, status: true, expiresAt: true },
    });

    if (!invitation) {
      throw HttpError.notFound("Invitation");
    }
    if (invitation.email !== user.email) {
      throw new HttpError(403, "Cette invitation ne vous est pas destinée", "ADMIN_REQUIRED");
    }

    const result = await acceptInvitation(token, user.id);

    return NextResponse.json({
      ok: true,
      workspaceId: result.workspaceId,
      role: result.role,
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}

/**
 * GET: peek at an invitation without accepting it (for the invite page UI).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await ctx.params;

    const invitation = await db.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: {
          select: { name: true, slug: true },
        },
      },
    });

    if (!invitation) {
      throw HttpError.notFound("Invitation");
    }

    return NextResponse.json({
      workspaceName: invitation.workspace.name,
      workspaceSlug: invitation.workspace.slug,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      email: invitation.email,
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
