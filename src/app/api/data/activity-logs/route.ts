import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function GET() {
  const logs = await db.activityLog.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(logs);
}

export async function POST(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();

  const log = await db.activityLog.create({
    data: {
      userId: DEFAULT_USER_ID,
      agentId: body.agentId || "",
      agentName: body.agentName || "",
      type: body.type || "info",
      message: body.message || "",
      details: body.details,
    },
  });

  return NextResponse.json(log, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  await ensureDefaultUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    await db.activityLog.delete({ where: { id } });
  } else {
    await db.activityLog.deleteMany({ where: { userId: DEFAULT_USER_ID } });
  }

  return NextResponse.json({ success: true });
}
