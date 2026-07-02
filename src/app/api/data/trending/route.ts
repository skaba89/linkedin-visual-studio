/**
 * HERMÈS — Phase 3.7 — /api/data/trending
 *
 * GET: list trending topics for the authenticated user.
 *   Filters: status (new|commented|archived|failed), limit
 *
 * POST: manually create a trending topic (for user-supplied topics).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleRouteError } from "@/lib/http-error";
import { stripEmojis } from "@/lib/sanitize-text";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

    const where: Record<string, unknown> = { userId: user.id };
    if (status) where.status = status;

    const topics = await db.trendingTopic.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      take: limit,
    });

    return NextResponse.json(topics);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    if (!body.topic || typeof body.topic !== "string" || body.topic.trim().length === 0) {
      return NextResponse.json(
        { error: "Le champ 'topic' est requis" },
        { status: 400 },
      );
    }

    const topic = await db.trendingTopic.create({
      data: {
        userId: user.id,
        topic: stripEmojis(body.topic).trim(),
        angle: stripEmojis(body.angle ?? "").trim(),
        heat: ["hot", "warm", "rising"].includes(body.heat) ? body.heat : "warm",
        suggestedHook: stripEmojis(body.suggestedHook ?? "").trim(),
        sourceUrl: body.sourceUrl ?? null,
      },
    });

    return NextResponse.json(topic, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
