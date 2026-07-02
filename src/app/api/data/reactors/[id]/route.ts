/**
 * HERMÈS — Phase 3.7 — /api/data/reactors/[id]
 *
 * PATCH: update a reactor (currently only the `ignored` flag).
 * DELETE: hard-delete a reactor.
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

    const reactor = await db.linkedInReactor.findUnique({ where: { id } });
    assertOwnership(reactor, user.id);

    const updated = await db.linkedInReactor.update({
      where: { id },
      data: {
        ignored: typeof body.ignored === "boolean" ? body.ignored : undefined,
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

    const reactor = await db.linkedInReactor.findUnique({ where: { id } });
    assertOwnership(reactor, user.id);

    await db.linkedInReactor.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
