/**
 * HERMÈS — Phase 3.7 — /api/data/expert-comments
 *
 * GET: list the AI-generated expert comments audit trail for the user.
 *   Filters: status (generated|posted|failed), source (trending|reactor_reply|manual)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

    const where: Record<string, unknown> = { userId: user.id };
    if (status) where.status = status;
    if (source) where.source = source;

    const comments = await db.expertComment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(comments);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
