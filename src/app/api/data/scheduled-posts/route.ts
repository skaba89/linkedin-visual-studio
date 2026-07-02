/**
 * HERMÈS — Phase 6.3 — /api/data/scheduled-posts
 *
 * Lightweight CRUD for scheduled posts, decoupled from the actual
 * LinkedIn publication step. The calendar UI uses this to:
 *   - List all scheduled + published posts (for the calendar grid)
 *   - Create a new scheduled post (no linkedinId required at this stage;
 *     it'll be resolved by the cron job at publish time)
 *
 * The actual LinkedIn publication is handled by /api/linkedin/schedule
 * (called by the cron job every 5 minutes) and /api/cron/agents.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { handleRouteError, HttpError } from "@/lib/http-error";
import { stripEmojis } from "@/lib/sanitize-text";

export async function GET() {
  try {
    const user = await requireUser();
    const posts = await db.scheduledPost.findMany({
      where: { userId: user.id },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json(
      posts.map((p) => ({
        id: p.id,
        title: p.text.slice(0, 80) + (p.text.length > 80 ? "..." : ""),
        content: p.text,
        visibility: p.visibility,
        scheduledAt: p.scheduledAt.toISOString(),
        postedAt: p.publishedAt?.toISOString() ?? null,
        status: p.status, // scheduled | publishing | published | failed
        linkedinUrn: null,
        error: p.error,
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const text = typeof body.content === "string" ? stripEmojis(body.content).trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!text && !title) {
      throw new HttpError(422, "Le contenu du post est requis", "VALIDATION_ERROR");
    }

    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (!scheduledAt || isNaN(scheduledAt.getTime())) {
      throw new HttpError(422, "Date de publication invalide", "VALIDATION_ERROR");
    }

    // Combine title + content into the post text (LinkedIn API takes a single text field)
    const finalText = title && text ? `${title}\n\n${text}` : text || title;

    const post = await db.scheduledPost.create({
      data: {
        userId: user.id,
        text: finalText,
        visibility: body.visibility ?? "PUBLIC",
        scheduledAt,
        status: "scheduled",
      },
    });

    return NextResponse.json(
      {
        id: post.id,
        title,
        content: post.text,
        visibility: post.visibility,
        scheduledAt: post.scheduledAt.toISOString(),
        status: post.status,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new HttpError(422, "ID du post manquant", "VALIDATION_ERROR");
    }

    const post = await db.scheduledPost.findUnique({ where: { id } });
    assertOwnership(post, user.id);

    if (post.status === "published") {
      throw new HttpError(409, "Impossible de supprimer un post déjà publié", "CONFLICT");
    }

    await db.scheduledPost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
