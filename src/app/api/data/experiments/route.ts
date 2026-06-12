import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function GET() {
  const experiments = await db.experiment.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(experiments);
}

export async function POST(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();

  const experiment = await db.experiment.create({
    data: {
      userId: DEFAULT_USER_ID,
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
}

export async function PUT(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

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
}
