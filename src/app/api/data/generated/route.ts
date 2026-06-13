import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all";

  const results: Record<string, any> = {};

  if (type === "all" || type === "posts") {
    results.posts = await db.generatedPost.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  if (type === "all" || type === "messages") {
    results.messages = await db.generatedMessage.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  if (type === "all" || type === "comments") {
    results.comments = await db.generatedComment.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  if (type === "all" || type === "briefings") {
    results.briefings = await db.marketBriefing.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  if (type === "all" || type === "nurturing") {
    results.nurturing = await db.nurturingAction.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  if (type === "all" || type === "insights") {
    results.insights = await db.performanceInsight.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();
  const type = body.type;

  let result;

  switch (type) {
    case "post":
      result = await db.generatedPost.create({
        data: {
          userId: DEFAULT_USER_ID,
          text: body.text || "",
          topic: body.topic || "",
          model: body.model || "",
          agentRun: body.agentRun || 0,
        },
      });
      break;

    case "message":
      result = await db.generatedMessage.create({
        data: {
          userId: DEFAULT_USER_ID,
          leadId: body.leadId || "",
          leadName: body.leadName || "",
          leadEntreprise: body.leadEntreprise || "",
          content: body.content || "",
          timing: body.timing || "",
          model: body.model || "",
        },
      });
      break;

    case "comment":
      result = await db.generatedComment.create({
        data: {
          userId: DEFAULT_USER_ID,
          authorName: body.authorName || "",
          authorPoste: body.authorPoste || "",
          postExcerpt: body.postExcerpt || "",
          comment: body.comment || "",
          model: body.model || "",
        },
      });
      break;

    case "briefing":
      result = await db.marketBriefing.create({
        data: {
          userId: DEFAULT_USER_ID,
          title: body.title || "",
          summary: body.summary || "",
          trends: body.trends || [],
          opportunities: body.opportunities || [],
          competitors: body.competitors || [],
          model: body.model || "",
        },
      });
      break;

    case "nurturing":
      result = await db.nurturingAction.create({
        data: {
          userId: DEFAULT_USER_ID,
          leadId: body.leadId || "",
          leadName: body.leadName || "",
          leadEntreprise: body.leadEntreprise || "",
          type: body.nurturingType || "check-in",
          content: body.content || "",
          model: body.model || "",
        },
      });
      break;

    case "insight":
      result = await db.performanceInsight.create({
        data: {
          userId: DEFAULT_USER_ID,
          category: body.category || "contenu",
          metric: body.metric || "",
          value: body.value || "",
          recommendation: body.recommendation || "",
          priority: body.priority || "medium",
          model: body.model || "",
        },
      });
      break;

    default:
      return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  }

  return NextResponse.json(result, { status: 201 });
}
