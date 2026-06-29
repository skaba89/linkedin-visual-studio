/**
 * HERMÈS — R-001 / R-002 — /api/data/experiments/[id]
 * Migré vers requireUser() + assertOwnership.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { isHttpError } from "@/lib/http-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const experiment = await db.experiment.findUnique({ where: { id } });
    assertOwnership(experiment, user.id);

    const results = await db.experimentResult.findMany({
      where: { experimentId: id, userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ experiment, results });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await db.experiment.findUnique({ where: { id } });
    assertOwnership(existing, user.id);

    await db.experimentResult.deleteMany({
      where: { experimentId: id, userId: user.id },
    });
    await db.experiment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
