/**
 * HERMÈS — R-001 / R-002 — /api/data/experiment-results
 * Migré vers requireUser() + ownerFilter.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const experimentId = searchParams.get("experimentId");

    const where: Record<string, unknown> = { userId: user.id };
    if (experimentId) where.experimentId = experimentId;

    const results = await db.experimentResult.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(results);
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const result = await db.experimentResult.create({
      data: {
        userId: user.id,
        experimentId: body.experimentId,
        variantId: body.variantId,
        variantName: body.variantName || "",
        impressionId: body.impressionId,
        outcome: body.outcome || "",
        metricValue: body.metricValue || 0,
        metadata: body.metadata ?? undefined,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
