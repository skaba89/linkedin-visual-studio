/**
 * HERMÈS — R-001 / R-002 — /api/data/generated
 * Migré vers requireUser(). POST garde le switch sur `type`.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all";

    const results: Record<string, unknown> = {};

    if (type === "all" || type === "posts") {
      results.posts = await db.generatedPost.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }

    if (type === "all" || type === "messages") {
      results.messages = await db.generatedMessage.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }

    if (type === "all" || type === "comments") {
      results.comments = await db.generatedComment.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }

    if (type === "all" || type === "briefings") {
      results.briefings = await db.marketBriefing.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    }

    if (type === "all" || type === "nurturing") {
      results.nurturing = await db.nurturingAction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }

    if (type === "all" || type === "insights") {
      results.insights = await db.performanceInsight.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    }

    return NextResponse.json(results);
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const type = body.type;

    let result;

    switch (type) {
      case "post":
        result = await db.generatedPost.create({
          data: {
            userId: user.id,
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
            userId: user.id,
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
            userId: user.id,
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
            userId: user.id,
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
            userId: user.id,
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
            userId: user.id,
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
        throw new HttpError(422, `Unknown type: ${type}`, "VALIDATION_ERROR");
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
