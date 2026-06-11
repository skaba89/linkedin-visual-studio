import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");
  const sequenceId = searchParams.get("sequenceId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { userId: DEFAULT_USER_ID };
  if (contactId) where.contactId = contactId;
  if (sequenceId) where.sequenceId = sequenceId;
  if (status) where.status = status;

  const messages = await db.emailMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();

  const message = await db.emailMessage.create({
    data: {
      userId: DEFAULT_USER_ID,
      contactId: body.contactId,
      sequenceId: body.sequenceId,
      subject: body.subject || "",
      body: body.body || "",
      status: body.status || "draft",
      sentAt: body.status === "sent" ? new Date() : undefined,
    },
  });

  return NextResponse.json(message, { status: 201 });
}

export async function PUT(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...updates };
  if (updates.status === "sent" && !updates.sentAt) data.sentAt = new Date();
  if (updates.status === "opened" && !updates.openedAt) data.openedAt = new Date();
  if (updates.status === "clicked" && !updates.clickedAt) data.clickedAt = new Date();
  if (updates.status === "replied" && !updates.repliedAt) data.repliedAt = new Date();

  const message = await db.emailMessage.update({
    where: { id },
    data,
  });

  return NextResponse.json(message);
}
