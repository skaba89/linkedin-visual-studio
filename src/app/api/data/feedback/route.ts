import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";
import { feedbackEngine } from "@/lib/feedback";

export async function GET() {
  await ensureDefaultUser();
  const dashboardData = await feedbackEngine.getDashboardData();
  const rules = await feedbackEngine.getRules();
  const insights = await feedbackEngine.getInsights(20);

  const dbEvents = await db.feedbackEvent.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    dashboard: dashboardData,
    rules,
    insights,
    recentEvents: dbEvents,
  });
}

export async function POST(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();

  const baselineValue = body.baselineValue ?? 0;

  const insight = await feedbackEngine.recordFeedback({
    sourceAgentId: body.sourceAgentId,
    contentType: body.contentType,
    contentId: body.contentId || "",
    metricType: body.metricType,
    metricValue: body.metricValue,
    baselineValue,
  });

  return NextResponse.json(insight, { status: 201 });
}
