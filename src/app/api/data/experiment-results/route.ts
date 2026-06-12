import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const experimentId = searchParams.get("experimentId");

  const where: Record<string, unknown> = { userId: DEFAULT_USER_ID };
  if (experimentId) where.experimentId = experimentId;

  const results = await db.experimentResult.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();

  const result = await db.experimentResult.create({
    data: {
      userId: DEFAULT_USER_ID,
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
}
