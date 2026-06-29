/**
 * HERMÈS — R-001 / R-002 — /api/data/email-sequences
 * Migré vers requireUser() + assertOwnership.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function GET() {
  try {
    const user = await requireUser();
    const sequences = await db.emailSequence.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sequences);
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const sequence = await db.emailSequence.create({
      data: {
        userId: user.id,
        name: body.name,
        description: body.description || "",
        triggerEvent: body.triggerEvent || "manual",
        status: body.status || "draft",
        steps: body.steps || [],
      },
    });

    return NextResponse.json({ ...sequence, steps: body.steps || [] }, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      throw new HttpError(422, "id is required", "VALIDATION_ERROR", { field: "id" });
    }

    const existing = await db.emailSequence.findUnique({ where: { id } });
    assertOwnership(existing, user.id);

    const data: Record<string, unknown> = { ...updates };
    if (updates.steps) data.steps = updates.steps;

    const sequence = await db.emailSequence.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ...sequence, steps: updates.steps || [] });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
