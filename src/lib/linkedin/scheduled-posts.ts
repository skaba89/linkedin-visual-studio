/**
 * HERMÈS — Scheduled post publisher
 *
 * Extracted from /api/linkedin/schedule so it can be called from both:
 *   1. The lazy UI-triggered sweep (when a user GETs /api/linkedin/schedule)
 *   2. The eager cron sweep (every 5 minutes from /api/cron/agents)
 *
 * Without the cron, scheduled posts only get published when the user
 * opens the schedule UI in their browser. If they schedule a post for
 * 8am Monday and don't open HERMÈS until Wednesday, the post is
 * published Wednesday — silently missed deadline.
 *
 * With the cron, scheduled posts fire on time even if the user never
 * logs back in.
 */
import { db } from "@/lib/db";
import { getActiveLinkedInToken } from "@/lib/linkedin-token";
import { createLogger } from "@/lib/logger";

const log = createLogger("scheduled-posts");

export interface PublishResult {
  scheduledPostId: string;
  userId: string;
  status: "published" | "failed";
  error?: string;
}

/**
 * Publish all scheduled posts that are due for a single user.
 * Used by the lazy UI sweep.
 */
export async function publishDuePostsForUser(userId: string): Promise<PublishResult[]> {
  return publishDuePosts({ userId });
}

/**
 * Publish all scheduled posts that are due, across ALL users.
 * Used by the cron sweep.
 */
export async function publishAllDuePosts(): Promise<PublishResult[]> {
  return publishDuePosts({});
}

/**
 * Core publish sweep. If `userId` is provided, only that user's posts
 * are processed; otherwise all users' due posts are processed.
 */
async function publishDuePosts(opts: { userId?: string }): Promise<PublishResult[]> {
  const where = {
    status: "scheduled" as const,
    scheduledAt: { lte: new Date() },
    ...(opts.userId ? { userId: opts.userId } : {}),
  };

  const duePosts = await db.scheduledPost.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    take: 100, // safety cap per cron tick
  });

  const results: PublishResult[] = [];

  for (const post of duePosts) {
    // Mark as "publishing" so a concurrent cron tick doesn't double-publish
    await db.scheduledPost.update({
      where: { id: post.id },
      data: { status: "publishing" },
    });

    try {
      const token = await getActiveLinkedInToken(post.userId);
      if (!token) {
        await db.scheduledPost.update({
          where: { id: post.id },
          data: { status: "failed", error: "Token LinkedIn expiré" },
        });
        results.push({
          scheduledPostId: post.id,
          userId: post.userId,
          status: "failed",
          error: "token expired",
        });
        continue;
      }

      const linkedInAuth = await db.linkedInAuth.findUnique({
        where: { userId: post.userId },
      });

      if (!linkedInAuth || !linkedInAuth.linkedInUserId) {
        await db.scheduledPost.update({
          where: { id: post.id },
          data: { status: "failed", error: "ID LinkedIn introuvable" },
        });
        results.push({
          scheduledPostId: post.id,
          userId: post.userId,
          status: "failed",
          error: "no linkedin user id",
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
        log.warn("LinkedIn publish failed", {
          scheduledPostId: post.id,
          userId: post.userId,
          status: postResponse.status,
          error: errorText.slice(0, 200),
        });
        await db.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: "failed",
            error: `LinkedIn API ${postResponse.status}: ${errorText.slice(0, 200)}`,
          },
        });
        results.push({
          scheduledPostId: post.id,
          userId: post.userId,
          status: "failed",
          error: `LinkedIn ${postResponse.status}`,
        });
      } else {
        const responseData = await postResponse.json() as { activity?: string; id?: string };

        // Persist the LinkedIn URN + create a LinkedInPost row for metrics tracking
        const linkedinUrn = responseData.activity || responseData.id || "";
        await db.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: "published",
            publishedAt: new Date(),
          },
        });
        if (linkedinUrn) {
          await db.linkedInPost.create({
            data: {
              userId: post.userId,
              text: post.text.trim(),
              visibility: post.visibility,
              linkedinUrn,
            },
          }).catch((err) => {
            log.warn("Failed to create LinkedInPost row for tracking", {
              scheduledPostId: post.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }

        log.info("Scheduled post published", {
          scheduledPostId: post.id,
          userId: post.userId,
          linkedinUrn,
        });
        results.push({
          scheduledPostId: post.id,
          userId: post.userId,
          status: "published",
        });
      }

      // Small delay between posts to respect LinkedIn's rate limit
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error) {
      log.error("Scheduled post publish threw", {
        scheduledPostId: post.id,
        userId: post.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await db.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "Erreur inconnue",
        },
      });
      results.push({
        scheduledPostId: post.id,
        userId: post.userId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
