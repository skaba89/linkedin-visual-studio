import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const experiment = await db.experiment.findUnique({
    where: { id },
  });

  if (!experiment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const results = await db.experimentResult.findMany({
    where: { experimentId: id, userId: DEFAULT_USER_ID },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ experiment, results });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDefaultUser();
  const { id } = await params;

  await db.experimentResult.deleteMany({ where: { experimentId: id, userId: DEFAULT_USER_ID } });
  await db.experiment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
