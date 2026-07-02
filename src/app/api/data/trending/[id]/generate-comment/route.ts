/**
 * HERMÈS — Phase 3.7 — /api/data/trending/[id]/generate-comment
 *
 * POST: generate an expert comment for a trending topic WITHOUT posting it.
 * Returns up to 3 variants in different tones so the user can pick one.
 *
 * This is the "interactive" path. The cron-driven auto-reply path is in
 * /api/cron/trending-engage.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { generateExpertCommentVariants } from "@/lib/linkedin/expert-comment";
import { handleRouteError } from "@/lib/http-error";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const topic = await db.trendingTopic.findUnique({ where: { id } });
    assertOwnership(topic, user.id);

    // Load ICP config for the AI context
    const icpConfig = await db.iCPConfig.findUnique({ where: { userId: user.id } });
    let icpSectors: string[] = [];
    try {
      icpSectors = JSON.parse(icpConfig?.sectors ?? "[]");
    } catch {
      icpSectors = [];
    }

    // Use the topic + angle + suggested hook as the "post text" the AI comments on
    const syntheticPostText = [
      `Sujet: ${topic.topic}`,
      topic.angle ? `Angle: ${topic.angle}` : "",
      topic.suggestedHook ? `Hook suggéré: ${topic.suggestedHook}` : "",
    ].filter(Boolean).join("\n");

    const variants = await generateExpertCommentVariants(
      {
        postText: syntheticPostText,
        postAuthor: "Tendance LinkedIn",
        icpSectors,
      },
      3,
    );

    if (variants.length === 0) {
      return NextResponse.json(
        { error: "La génération IA a échoué. Réessayez dans un instant." },
        { status: 503 },
      );
    }

    return NextResponse.json({
      topicId: topic.id,
      topic: topic.topic,
      variants: variants.map((v) => ({
        text: v.text,
        tone: v.tone,
        model: v.model,
        fixedViolations: v.fixedViolations,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
