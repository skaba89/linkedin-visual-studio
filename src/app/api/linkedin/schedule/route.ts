import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookies } from "@/lib/linkedin-token";
import { db, DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/db";

// Check and publish due posts
let lastCheck = 0;

async function checkAndPublishDuePosts() {
  const now = Date.now();
  if (now - lastCheck < 30000) return; // Check every 30s
  lastCheck = now;

  const duePosts = await db.scheduledPost.findMany({
    where: {
      userId: DEFAULT_USER_ID,
      status: "scheduled",
      scheduledAt: { lte: new Date() },
    },
  });

  for (const post of duePosts) {
    await db.scheduledPost.update({
      where: { id: post.id },
      data: { status: "publishing" },
    });

    try {
      const token = await getTokenFromCookies();
      if (!token) {
        await db.scheduledPost.update({
          where: { id: post.id },
          data: { status: "failed", error: "Token LinkedIn expire" },
        });
        continue;
      }

      const postBody = {
        author: `urn:li:person:${post.id}`, // Using post.id as placeholder; linkedinId stored elsewhere
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
          data: { status: "published", publishedAt: new Date() },
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
 * List all scheduled posts — now from SQLite
 */
export async function GET() {
  await checkAndPublishDuePosts();

  const posts = await db.scheduledPost.findMany({
    where: { userId: DEFAULT_USER_ID },
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
}

/**
 * POST /api/linkedin/schedule
 * Schedule a new post for later publication — persisted to SQLite
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getTokenFromCookies();
    if (!token) {
      return NextResponse.json(
        { error: "Non authentifie. Connectez votre compte LinkedIn." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { text, visibility = "PUBLIC", scheduledAt } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Le texte du post est requis" },
        { status: 400 }
      );
    }

    if (!scheduledAt) {
      return NextResponse.json(
        { error: "La date de publication est requise" },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: "Date de publication invalide" },
        { status: 400 }
      );
    }

    if (scheduledDate.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "La date de publication doit etre dans le futur" },
        { status: 400 }
      );
    }

    await ensureDefaultUser();

    const post = await db.scheduledPost.create({
      data: {
        userId: DEFAULT_USER_ID,
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
      message: `Post planifie pour le ${scheduledDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
    });
  } catch (error) {
    console.error("LinkedIn schedule error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/linkedin/schedule?id=xxx
 * Cancel a scheduled post
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID du post manquant" }, { status: 400 });
  }

  const post = await db.scheduledPost.findFirst({
    where: { id, userId: DEFAULT_USER_ID, status: "scheduled" },
  });

  if (!post) {
    return NextResponse.json(
      { error: "Post planifie introuvable ou deja publie" },
      { status: 404 }
    );
  }

  await db.scheduledPost.delete({ where: { id } });

  return NextResponse.json({
    success: true,
    message: "Post planifie annule",
  });
}
