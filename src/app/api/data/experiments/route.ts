/**
 * HERMÈS — R-001 / R-002 — /api/data/experiments
 * Migré vers requireUser() + assertOwnership.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function GET() {
  try {
    const user = await requireUser();
    const experiments = await db.experiment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(experiments);
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const experiment = await db.experiment.create({
      data: {
        userId: user.id,
        name: body.name,
        description: body.description || "",
        type: body.type || "ab",
        status: body.status || "draft",
        targetAgentId: body.targetAgentId,
        variants: body.variants || [],
        trafficSplit: body.trafficSplit || "50/50",
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    });

    return NextResponse.json(experiment, { status: 201 });
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

    const existing = await db.experiment.findUnique({ where: { id } });
    assertOwnership(existing, user.id);

    const data: Record<string, unknown> = { ...updates };
    if (updates.variants) data.variants = updates.variants;
    if (updates.results) data.results = updates.results;
    if (updates.startDate) data.startDate = new Date(updates.startDate);
    if (updates.endDate) data.endDate = new Date(updates.endDate);

    const experiment = await db.experiment.update({
      where: { id },
      data,
    });

    return NextResponse.json(experiment);
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
