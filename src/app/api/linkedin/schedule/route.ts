/**
 * HERMÈS — R-001 / R-002 / R-004 — /api/linkedin/schedule
 *
 * Migré vers requireUser() + assertOwnership.
 *
 * `checkAndPublishDuePosts()` est scoppée à l'utilisateur authentifié.
 *
 * R-004 deep : le token LinkedIn est résolu via `getActiveLinkedInToken()`
 * qui essaie d'abord le cookie chiffré (fast path), puis la colonne
 * `LinkedInAuth.accessToken` (decryptée) en fallback. Cela permet aux
 * publications planifiées de s'exécuter même si la session browser a
 * expiré — le token persisté en base survit 60 jours.
 */
import { NextRequest, NextResponse } from "next/server";
import { getActiveLinkedInToken } from "@/lib/linkedin-token";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

// In-memory throttle for the publish sweep (per user now — kept simple)
const lastCheckPerUser = new Map<string, number>();

async function checkAndPublishDuePosts(userId: string) {
  const now = Date.now();
  const last = lastCheckPerUser.get(userId) ?? 0;
  if (now - last < 30000) return; // Check every 30s per user
  lastCheckPerUser.set(userId, now);

  const duePosts = await db.scheduledPost.findMany({
    where: {
      userId,
      status: "scheduled",
      scheduledAt: { lte: new Date(now) },
    },
  });

  for (const post of duePosts) {
    await db.scheduledPost.update({
      where: { id: post.id },
      data: { status: "publishing" },
    });

    try {
      const token = await getActiveLinkedInToken(userId);
      if (!token) {
        await db.scheduledPost.update({
          where: { id: post.id },
          data: { status: "failed", error: "Token LinkedIn expiré" },
        });
        continue;
      }

      const linkedInAuth = await db.linkedInAuth.findUnique({
        where: { userId },
      });

      if (!linkedInAuth || !linkedInAuth.linkedInUserId) {
        await db.scheduledPost.update({
          where: { id: post.id },
          data: { status: "failed", error: "ID LinkedIn introuvable" },
        });
        continue;
      }

      const postBody = {
        author: `urn:li:person:${linkedInAuth.linkedInUserId}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: post.text.trim() },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility":
            post.visibility === "CONNECTIONS" ? "CONNECTIONS" : "PUBLIC",
        },
      };

      const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postBody),
      });

      if (!postResponse.ok) {
        const errorText = await postResponse.text();
        await db.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: "failed",
            error: `LinkedIn API error (${postResponse.status}): ${errorText.slice(0, 200)}`,
          },
        });
      } else {
        await db.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: "published",
            publishedAt: new Date(),
          },
        });
      }
    } catch (error) {
      await db.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "Erreur inconnue",
        },
      });
    }
  }
}

/**
 * GET /api/linkedin/schedule
 * List all scheduled posts
 */
export async function GET() {
  try {
    const user = await requireUser();
    await checkAndPublishDuePosts(user.id);

    const posts = await db.scheduledPost.findMany({
      where: { userId: user.id },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({
      posts: posts.map((p) => ({
        id: p.id,
        text: p.text,
        visibility: p.visibility,
        scheduledAt: p.scheduledAt.toISOString(),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        publishedAt: p.publishedAt?.toISOString(),
        error: p.error,
      })),
    });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/linkedin/schedule
 * Schedule a new post for later publication
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const token = await getActiveLinkedInToken(user.id);
    if (!token) {
      throw new HttpError(
        401,
        "Non authentifié. Connectez votre compte LinkedIn.",
        "AUTH_REQUIRED",
      );
    }

    const body = await request.json();
    const { text, visibility = "PUBLIC", linkedinId, scheduledAt } = body;

    if (!text || !text.trim()) {
      throw new HttpError(422, "Le texte du post est requis", "VALIDATION_ERROR");
    }

    if (!linkedinId) {
      throw new HttpError(422, "L'ID LinkedIn est requis", "VALIDATION_ERROR");
    }

    if (!scheduledAt) {
      throw new HttpError(422, "La date de publication est requise", "VALIDATION_ERROR");
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new HttpError(422, "Date de publication invalide", "VALIDATION_ERROR");
    }

    if (scheduledDate.getTime() <= Date.now()) {
      throw new HttpError(
        422,
        "La date de publication doit être dans le futur",
        "VALIDATION_ERROR",
      );
    }

    const post = await db.scheduledPost.create({
      data: {
        userId: user.id,
        text: text.trim(),
        visibility,
        scheduledAt: scheduledDate,
        status: "scheduled",
      },
    });

    return NextResponse.json({
      success: true,
      postId: post.id,
      scheduledAt: post.scheduledAt.toISOString(),
      message: `Post planifié pour le ${scheduledDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
    });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    console.error("LinkedIn schedule error:", err);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/linkedin/schedule?id=xxx
 * Cancel a scheduled post
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      throw new HttpError(422, "ID du post manquant", "VALIDATION_ERROR");
    }

    const post = await db.scheduledPost.findUnique({ where: { id } });
    assertOwnership(post, user.id);

    if (post.status !== "scheduled") {
      throw new HttpError(
        404,
        "Post planifié introuvable ou déjà publié",
        "NOT_FOUND",
      );
    }

    await db.scheduledPost.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Post planifié annulé",
    });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}
