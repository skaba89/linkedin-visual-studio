/**
 * HERMÈS — R-001 / R-002 — /api/data/email-messages
 * Migré vers requireUser() + assertOwnership.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get("contactId");
    const sequenceId = searchParams.get("sequenceId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { userId: user.id };
    if (contactId) where.contactId = contactId;
    if (sequenceId) where.sequenceId = sequenceId;
    if (status) where.status = status;

    const messages = await db.emailMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(messages);
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const message = await db.emailMessage.create({
      data: {
        userId: user.id,
        contactId: body.contactId,
        sequenceId: body.sequenceId,
        subject: body.subject || "",
        body: body.body || "",
        status: body.status || "draft",
        sentAt: body.status === "sent" ? new Date() : undefined,
      },
    });

    return NextResponse.json(message, { status: 201 });
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

    const existing = await db.emailMessage.findUnique({ where: { id } });
    assertOwnership(existing, user.id);

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
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
