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
      impressions: body.impressions || 0,
      likes: body.likes || 0,
      comments: body.comments || 0,
      shares: body.shares || 0,
      clicks: body.clicks || 0,
      replies: body.replies || 0,
      conversions: body.conversions || 0,
      engagementRate: body.engagementRate || 0,
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
      impressions: body.impressions || 0,
      likes: body.likes || 0,
      comments: body.comments || 0,
      shares: body.shares || 0,
      clicks: body.clicks || 0,
      replies: body.replies || 0,
      conversions: body.conversions || 0,
      engagementRate: body.engagementRate || 0,
      experimentId: body.experimentId,
      variantId: body.variantId,
      period: body.period || "",
      recordedAt: new Date(),
    },
  });

  return NextResponse.json(metric, { status: 201 });
}
