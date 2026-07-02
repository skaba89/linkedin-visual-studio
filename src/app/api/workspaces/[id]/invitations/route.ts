/**
 * HERMÈS — Phase 4.4 — /api/workspaces/[id]/invitations
 *
 * GET:   list pending invitations (admin only)
 * POST:  create a new invitation (alias for POST /api/workspaces/[id]/members)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { listInvitations } from "@/lib/workspaces";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const invitations = await listInvitations(id, user.id);
    return NextResponse.json(invitations);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
