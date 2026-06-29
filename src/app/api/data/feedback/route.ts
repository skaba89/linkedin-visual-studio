/**
 * HERMÈS — R-001 / R-002 — /api/data/feedback
 *
 * La partie DB (feedbackEvent) est désormais scoppée à user.id.
 * `feedbackEngine` reste global — TODO (R-002 deep) : refactor du moteur pour
 * accepter un userId.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedbackEngine } from "@/lib/feedback";
import { requireUser } from "@/lib/session";
import { isHttpError } from "@/lib/http-error";

export async function GET() {
  try {
    const user = await requireUser();
    const dashboardData = await feedbackEngine.getDashboardData();
    const rules = await feedbackEngine.getRules();
    const insights = await feedbackEngine.getInsights(20);

    const dbEvents = await db.feedbackEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      dashboard: dashboardData,
      rules,
      insights,
      recentEvents: dbEvents,
    });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
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
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
