/**
 * HERMÈS — R-001 / R-002 — /api/data/content-metrics
 * Migré vers requireUser() + ownerFilter. Garde l'upsert sur clé unique.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const contentType = searchParams.get("contentType");
    const agentId = searchParams.get("agentId");

    const where: Record<string, unknown> = { userId: user.id };
    if (contentType) where.contentType = contentType;
    if (agentId) where.agentId = agentId;

    const metrics = await db.contentMetric.findMany({
      where,
      orderBy: { recordedAt: "desc" },
      take: 200,
    });

    return NextResponse.json(metrics);
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const impressions = body.impressions || 0;
    const likes = body.likes || 0;
    const comments = body.comments || 0;
    const shares = body.shares || 0;
    const clicks = body.clicks || 0;
    const replies = body.replies || 0;
    const conversions = body.conversions || 0;
    const engagementRate = body.engagementRate ?? (impressions > 0
      ? ((likes + comments + shares + clicks + replies + conversions) / impressions) * 100
      : 0);

    const metric = await db.contentMetric.upsert({
      where: {
        userId_contentId_period: {
          userId: user.id,
          contentId: body.contentId,
          period: body.period || "",
        },
      },
      update: {
        impressions,
        likes,
        comments,
        shares,
        clicks,
        replies,
        conversions,
        engagementRate,
        agentId: body.agentId || "",
        experimentId: body.experimentId,
        variantId: body.variantId,
        recordedAt: new Date(),
      },
      create: {
        userId: user.id,
        contentType: body.contentType || "post",
        contentId: body.contentId,
        agentId: body.agentId || "",
        impressions,
        likes,
        comments,
        shares,
        clicks,
        replies,
        conversions,
        engagementRate,
        experimentId: body.experimentId,
        variantId: body.variantId,
        period: body.period || "",
        recordedAt: new Date(),
      },
    });

    return NextResponse.json(metric, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
