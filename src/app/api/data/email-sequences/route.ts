import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function GET() {
  const sequences = await db.emailSequence.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sequences);
}

export async function POST(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();

  const sequence = await db.emailSequence.create({
    data: {
      userId: DEFAULT_USER_ID,
      name: body.name,
      description: body.description || "",
      triggerEvent: body.triggerEvent || "manual",
      status: body.status || "draft",
      steps: body.steps || [],
    },
  });

  return NextResponse.json({ ...sequence, steps: body.steps || [] }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...updates };
  if (updates.steps) data.steps = updates.steps;

  const sequence = await db.emailSequence.update({
    where: { id },
    data,
  });

  return NextResponse.json({ ...sequence, steps: updates.steps || [] });
}
