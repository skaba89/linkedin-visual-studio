import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get("contentType");
  const agentId = searchParams.get("agentId");

  const where: Record<string, unknown> = { userId: DEFAULT_USER_ID };
  if (contentType) where.contentType = contentType;
  if (agentId) where.agentId = agentId;

  const metrics = await db.contentMetric.findMany({
    where,
    orderBy: { recordedAt: "desc" },
    take: 200,
  });

  return NextResponse.json(metrics);
}

export async function POST(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();

  // Auto-calculate engagementRate if not provided
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

  // Upsert based on unique constraint (userId, contentId, period)
  const metric = await db.contentMetric.upsert({
    where: {
      userId_contentId_period: {
        userId: DEFAULT_USER_ID,
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
      userId: DEFAULT_USER_ID,
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
}
