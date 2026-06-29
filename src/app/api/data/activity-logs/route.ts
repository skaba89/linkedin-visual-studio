/**
 * HERMÈS — R-001 / R-002 — /api/data/activity-logs
 * Migré vers requireUser() + assertOwnership.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function GET() {
  try {
    const user = await requireUser();
    const logs = await db.activityLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(logs);
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const log = await db.activityLog.create({
      data: {
        userId: user.id,
        agentId: body.agentId || "",
        agentName: body.agentName || "",
        type: body.type || "info",
        message: body.message || "",
        details: body.details,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const existing = await db.activityLog.findUnique({ where: { id } });
      assertOwnership(existing, user.id);
      await db.activityLog.delete({ where: { id } });
    } else {
      await db.activityLog.deleteMany({ where: { userId: user.id } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
