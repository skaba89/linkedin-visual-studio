import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookies } from "@/lib/linkedin-token";

// In-memory scheduled posts store (resets on server restart)
// In production, use a database
interface ScheduledPost {
  id: string;
  text: string;
  visibility: "PUBLIC" | "CONNECTIONS";
  linkedinId: string;
  scheduledAt: string; // ISO string
  status: "scheduled" | "publishing" | "published" | "failed";
  createdAt: string;
  publishedAt?: string;
  error?: string;
}

let scheduledPosts: ScheduledPost[] = [];

// Check and publish due posts
let lastCheck = 0;

async function checkAndPublishDuePosts() {
  const now = Date.now();
  if (now - lastCheck < 30000) return; // Check every 30s
  lastCheck = now;

  const duePosts = scheduledPosts.filter(
    (p) => p.status === "scheduled" && new Date(p.scheduledAt).getTime() <= now
  );

  for (const post of duePosts) {
    post.status = "publishing";
    try {
      const token = await getTokenFromCookies();
      if (!token) {
        post.status = "failed";
        post.error = "Token LinkedIn expiré";
        continue;
      }

      const postBody = {
        author: `urn:li:person:${post.linkedinId}`,
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
        post.status = "failed";
        post.error = `LinkedIn API error (${postResponse.status}): ${errorText.slice(0, 200)}`;
      } else {
        post.status = "published";
        post.publishedAt = new Date().toISOString();
      }
    } catch (error) {
      post.status = "failed";
      post.error = error instanceof Error ? error.message : "Erreur inconnue";
    }
  }
}

/**
 * GET /api/linkedin/schedule
 * List all scheduled posts
 */
export async function GET() {
  await checkAndPublishDuePosts();

  return NextResponse.json({
    posts: scheduledPosts.map((p) => ({
      id: p.id,
      text: p.text,
      visibility: p.visibility,
      scheduledAt: p.scheduledAt,
      status: p.status,
      createdAt: p.createdAt,
      publishedAt: p.publishedAt,
      error: p.error,
    })),
  });
}

/**
 * POST /api/linkedin/schedule
 * Schedule a new post for later publication
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getTokenFromCookies();
    if (!token) {
      return NextResponse.json(
        { error: "Non authentifié. Connectez votre compte LinkedIn." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { text, visibility = "PUBLIC", linkedinId, scheduledAt } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Le texte du post est requis" },
        { status: 400 }
      );
    }

    if (!linkedinId) {
      return NextResponse.json(
        { error: "L'ID LinkedIn est requis" },
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
        { error: "La date de publication doit être dans le futur" },
        { status: 400 }
      );
    }

    const post: ScheduledPost = {
      id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: text.trim(),
      visibility,
      linkedinId,
      scheduledAt: scheduledDate.toISOString(),
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };

    scheduledPosts.push(post);

    return NextResponse.json({
      success: true,
      postId: post.id,
      scheduledAt: post.scheduledAt,
      message: `Post planifié pour le ${scheduledDate.toLocaleDateString("fr-FR", {
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

  const postIndex = scheduledPosts.findIndex(
    (p) => p.id === id && p.status === "scheduled"
  );

  if (postIndex === -1) {
    return NextResponse.json(
      { error: "Post planifié introuvable ou déjà publié" },
      { status: 404 }
    );
  }

  scheduledPosts.splice(postIndex, 1);

  return NextResponse.json({
    success: true,
    message: "Post planifié annulé",
  });
}
