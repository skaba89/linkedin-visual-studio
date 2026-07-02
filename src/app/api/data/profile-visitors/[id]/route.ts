/**
 * HERMÈS — Phase 3.8 — /api/data/profile-visitors/[id]
 *
 * PATCH: update ignored flag.
 * DELETE: hard-delete.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();

    const visitor = await db.profileVisitor.findUnique({ where: { id } });
    assertOwnership(visitor, user.id);

    const updated = await db.profileVisitor.update({
      where: { id },
      data: {
        ignored: typeof body.ignored === "boolean" ? body.ignored : undefined,
        note: typeof body.note === "string" ? body.note : undefined,
      },
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const visitor = await db.profileVisitor.findUnique({ where: { id } });
    assertOwnership(visitor, user.id);

    await db.profileVisitor.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
