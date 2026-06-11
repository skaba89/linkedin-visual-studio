import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";
import { feedbackEngine } from "@/lib/feedback";

export async function GET() {
  const dashboardData = feedbackEngine.getDashboardData();
  const rules = feedbackEngine.getRules();
  const insights = feedbackEngine.getInsights(20);

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

  const insight = feedbackEngine.recordFeedback({
    sourceAgentId: body.sourceAgentId,
    contentType: body.contentType,
    contentId: body.contentId || "",
    metricType: body.metricType,
    metricValue: body.metricValue,
    baselineValue,
  });

  // Also save to DB
  const improvement = body.metricValue - baselineValue;
  await db.feedbackEvent.create({
    data: {
      userId: DEFAULT_USER_ID,
      sourceAgentId: body.sourceAgentId,
      contentType: body.contentType,
      contentId: body.contentId || "",
      metricType: body.metricType,
      metricValue: body.metricValue,
      baselineValue,
      improvement,
      actionTaken: insight.action,
      lesson: insight.recommendation,
    },
  });

  return NextResponse.json(insight, { status: 201 });
}
