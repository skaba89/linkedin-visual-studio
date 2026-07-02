/**
 * HERMÈS — Phase 3.2 — Reactor capture
 *
 * Captures every like + comment on the user's LinkedIn posts and persists
 * them as `LinkedInReactor` rows. Reactors are then synced into the CRM
 * as warm leads (someone who engaged with your content is by definition
 * a warm lead — they raised their hand).
 *
 * LinkedIn API endpoints used:
 *   GET /v2/socialActions/{urn}/likes?projection=...(actor,actor~)
 *   GET /v2/socialActions/{urn}/comments?projection=...(actor,actor~)
 *
 * The `actor` field is a URN like `urn:li:person:ABC123`. To get the
 * person's name + headline, we use the `projection` parameter to inline
 * the profile fields. This avoids a second N+1 round-trip per reactor.
 *
 * Multi-tenant safe: every query is scoped by userId. The LinkedIn token
 * is fetched per-user via `getDecryptedTokenFromDB(userId)`.
 *
 * Idempotent: rows are upserted on the
 *   (userId, postUrn, reactorLinkedInId, action)
 * unique key, so re-running the capture on the same post is safe.
 */
import { db } from "@/lib/db";
import { getDecryptedTokenFromDB } from "@/lib/linkedin-token";
import { createLogger } from "@/lib/logger";

const log = createLogger("reactor-capture");

/** Don't re-capture reactors on a post more often than this. */
const MIN_RECAPTURE_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Max posts to capture reactors for per user per cron tick. */
const MAX_POSTS_PER_USER = 30;

/** Max likes/comments to fetch per post (LinkedIn API count param). */
const MAX_REACTORS_PER_POST = 200;

/** Delay between LinkedIn API calls to be polite. */
const API_DELAY_MS = 300;

export interface ReactorCaptureResult {
  userId: string;
  postsScanned: number;
  likesCaptured: number;
  commentsCaptured: number;
  duplicatesSkipped: number;
  failed: number;
}

interface LinkedInLikeElement {
  actor?: string; // urn:li:person:ABC123
  actorInfo?: {
    firstName?: string;
    lastName?: string;
    headline?: { text?: string } | string;
    picture?: { url?: string } | string;
    id?: string;
  };
  $URN?: string;
}

interface LinkedInCommentElement {
  actor?: string;
  actorInfo?: {
    firstName?: string;
    lastName?: string;
    headline?: { text?: string } | string;
    picture?: { url?: string } | string;
    id?: string;
  };
  $URN?: string;
  message?: { text?: string };
  created?: { time?: number };
}

/**
 * Extract the LinkedIn person ID from an actor URN.
 * "urn:li:person:ABC123" → "ABC123"
 */
function extractPersonId(urn: string | undefined): string {
  if (!urn) return "";
  const parts = urn.split(":");
  return parts[parts.length - 1] || "";
}

/**
 * Build a name from a profile's firstName + lastName fields.
 */
function buildName(info: { firstName?: string; lastName?: string } | undefined): string {
  if (!info) return "";
  return [info.firstName, info.lastName].filter(Boolean).join(" ").trim();
}

/**
 * Extract the headline text from the various shapes LinkedIn returns it in.
 * Sometimes it's a plain string, sometimes an object with a `text` field,
 * sometimes a localized object.
 */
function extractHeadline(headline: unknown): string | null {
  if (!headline) return null;
  if (typeof headline === "string") return headline;
  if (typeof headline === "object" && headline !== null) {
    const obj = headline as { text?: string; localizedText?: string };
    if (obj.text) return obj.text;
    if (obj.localizedText) return obj.localizedText;
  }
  return null;
}

/**
 * Extract the avatar URL from the various shapes LinkedIn returns it in.
 */
function extractAvatar(picture: unknown): string | null {
  if (!picture) return null;
  if (typeof picture === "string") return picture;
  if (typeof picture === "object" && picture !== null) {
    const obj = picture as { url?: string };
    if (obj.url) return obj.url;
  }
  return null;
}

/**
 * Fetch likes + comments for a single post and upsert them as reactors.
 *
 * @returns the number of likes + comments captured (excluding duplicates).
 */
async function captureReactorsForPost(
  userId: string,
  postUrn: string,
  postId: string | null,
  token: string,
): Promise<{ likes: number; comments: number; duplicates: number; failed: number }> {
  const encodedUrn = encodeURIComponent(postUrn);
  // Use projection to inline the actor profile so we get name + headline
  // in a single round-trip. Without this, we'd need to call
  // /v2/people/(id:{id}) for every reactor (N+1 problem).
  const likesProjection = encodeURIComponent(
    "(elements*($URN,actor,actor~(firstName,lastName,headline,picture)))",
  );
  const commentsProjection = encodeURIComponent(
    "(elements*($URN,actor,message,created,actor~(firstName,lastName,headline,picture)))",
  );

  const [likesRes, commentsRes] = await Promise.all([
    fetch(
      `https://api.linkedin.com/v2/socialActions/${encodedUrn}/likes?count=${MAX_REACTORS_PER_POST}&projection=${likesProjection}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).catch((err) => ({
      ok: false as const,
      status: 0,
      json: async () => ({ error: err instanceof Error ? err.message : String(err) }),
    })),
    fetch(
      `https://api.linkedin.com/v2/socialActions/${encodedUrn}/comments?count=${MAX_REACTORS_PER_POST}&projection=${commentsProjection}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).catch((err) => ({
      ok: false as const,
      status: 0,
      json: async () => ({ error: err instanceof Error ? err.message : String(err) }),
    })),
  ]);

  let likesCaptured = 0;
  let commentsCaptured = 0;
  let duplicates = 0;
  let failed = 0;

  // Process likes
  if (likesRes.ok) {
    const likesData = (await likesRes.json()) as { elements?: LinkedInLikeElement[] };
    const likeElements = Array.isArray(likesData.elements) ? likesData.elements : [];

    for (const like of likeElements) {
      const personId = extractPersonId(like.actor);
      if (!personId) {
        failed++;
        continue;
      }

      const actorInfo = like.actorInfo;
      try {
        const result = await db.linkedInReactor.upsert({
          where: {
            userId_postUrn_reactorLinkedInId_action: {
              userId,
              postUrn,
              reactorLinkedInId: personId,
              action: "like",
            },
          },
          create: {
            userId,
            postUrn,
            postId: postId ?? null,
            reactorLinkedInId: personId,
            reactorName: buildName(actorInfo),
            reactorHeadline: extractHeadline(actorInfo?.headline),
            reactorProfileUrl: `https://www.linkedin.com/in/${personId}`,
            reactorAvatarUrl: extractAvatar(actorInfo?.picture),
            action: "like",
          },
          update: {
            // Update name/headline in case the profile changed since last capture
            reactorName: buildName(actorInfo) || undefined,
            reactorHeadline: extractHeadline(actorInfo?.headline) ?? undefined,
            reactorAvatarUrl: extractAvatar(actorInfo?.picture) ?? undefined,
            capturedAt: new Date(),
          },
        });
        // Distinguish insert vs update by checking createdAt vs capturedAt
        if (result.createdAt.getTime() === result.capturedAt.getTime()) {
          likesCaptured++;
        } else {
          duplicates++;
        }
      } catch (err) {
        log.warn("Failed to upsert like reactor", {
          userId,
          postUrn,
          personId,
          error: err instanceof Error ? err.message : String(err),
        });
        failed++;
      }
    }
  } else if (likesRes.status === 401) {
    log.warn("LinkedIn token expired during reactor capture (likes)", { userId });
    return { likes: 0, comments: 0, duplicates: 0, failed: 0 };
  } else {
    log.warn("Failed to fetch likes for post", {
      userId,
      postUrn,
      status: likesRes.status,
    });
  }

  await new Promise((r) => setTimeout(r, API_DELAY_MS));

  // Process comments
  if (commentsRes.ok) {
    const commentsData = (await commentsRes.json()) as { elements?: LinkedInCommentElement[] };
    const commentElements = Array.isArray(commentsData.elements) ? commentsData.elements : [];

    for (const comment of commentElements) {
      const personId = extractPersonId(comment.actor);
      if (!personId) {
        failed++;
        continue;
      }

      const actorInfo = comment.actorInfo;
      const commentText = comment.message?.text ?? null;
      const commentUrn = comment.$URN ?? null;

      try {
        const result = await db.linkedInReactor.upsert({
          where: {
            userId_postUrn_reactorLinkedInId_action: {
              userId,
              postUrn,
              reactorLinkedInId: personId,
              action: "comment",
            },
          },
          create: {
            userId,
            postUrn,
            postId: postId ?? null,
            reactorLinkedInId: personId,
            reactorName: buildName(actorInfo),
            reactorHeadline: extractHeadline(actorInfo?.headline),
            reactorProfileUrl: `https://www.linkedin.com/in/${personId}`,
            reactorAvatarUrl: extractAvatar(actorInfo?.picture),
            action: "comment",
            commentText,
            commentUrn,
          },
          update: {
            reactorName: buildName(actorInfo) || undefined,
            reactorHeadline: extractHeadline(actorInfo?.headline) ?? undefined,
            reactorAvatarUrl: extractAvatar(actorInfo?.picture) ?? undefined,
            commentText: commentText ?? undefined,
            commentUrn: commentUrn ?? undefined,
            capturedAt: new Date(),
          },
        });
        if (result.createdAt.getTime() === result.capturedAt.getTime()) {
          commentsCaptured++;
        } else {
          duplicates++;
        }
      } catch (err) {
        log.warn("Failed to upsert comment reactor", {
          userId,
          postUrn,
          personId,
          error: err instanceof Error ? err.message : String(err),
        });
        failed++;
      }
    }
  } else if (commentsRes.status === 401) {
    log.warn("LinkedIn token expired during reactor capture (comments)", { userId });
  } else {
    log.warn("Failed to fetch comments for post", {
      userId,
      postUrn,
      status: commentsRes.status,
    });
  }

  return {
    likes: likesCaptured,
    comments: commentsCaptured,
    duplicates,
    failed,
  };
}

/**
 * Capture reactors for all of a user's LinkedIn posts that have a URN and
 * haven't been captured in the last MIN_RECAPTURE_INTERVAL_MS.
 *
 * @param userId — the HERMÈS user ID
 */
export async function captureReactorsForUser(userId: string): Promise<ReactorCaptureResult> {
  const token = await getDecryptedTokenFromDB(userId);
  if (!token) {
    log.info("Skipping reactor capture — no LinkedIn token", { userId });
    return {
      userId,
      postsScanned: 0,
      likesCaptured: 0,
      commentsCaptured: 0,
      duplicatesSkipped: 0,
      failed: 0,
    };
  }

  // Find posts with URNs that haven't been re-captured recently.
  // We use metricsSyncedAt as a proxy for "last time we touched this post
  // from a cron" — it's not perfect but it avoids adding another column.
  // The cutoff is more conservative than metrics-sync (4h vs 6h) because
  // reactors matter more for lead generation.
  const cutoff = new Date(Date.now() - MIN_RECAPTURE_INTERVAL_MS);
  const posts = await db.linkedInPost.findMany({
    where: {
      userId,
      linkedinUrn: { not: null },
      OR: [
        { metricsSyncedAt: null },
        { metricsSyncedAt: { lt: cutoff } },
      ],
    },
    take: MAX_POSTS_PER_USER,
    orderBy: { createdAt: "desc" },
    select: { id: true, linkedinUrn: true },
  });

  let totalLikes = 0;
  let totalComments = 0;
  let totalDuplicates = 0;
  let totalFailed = 0;

  for (const post of posts) {
    const urn = post.linkedinUrn;
    if (!urn) continue;

    try {
      const result = await captureReactorsForPost(userId, urn, post.id, token);
      totalLikes += result.likes;
      totalComments += result.comments;
      totalDuplicates += result.duplicates;
      totalFailed += result.failed;
    } catch (err) {
      log.warn("captureReactorsForPost threw", {
        userId,
        postId: post.id,
        error: err instanceof Error ? err.message : String(err),
      });
      totalFailed++;
    }

    await new Promise((r) => setTimeout(r, API_DELAY_MS));
  }

  log.info("Reactor capture complete for user", {
    userId,
    postsScanned: posts.length,
    likesCaptured: totalLikes,
    commentsCaptured: totalComments,
    duplicatesSkipped: totalDuplicates,
    failed: totalFailed,
  });

  return {
    userId,
    postsScanned: posts.length,
    likesCaptured: totalLikes,
    commentsCaptured: totalComments,
    duplicatesSkipped: totalDuplicates,
    failed: totalFailed,
  };
}

/**
 * Capture reactors for all users who have a LinkedInAuth row.
 * Called by the /api/cron/reactor-capture route (every 2 hours).
 */
export async function captureReactorsForAllUsers(): Promise<{
  totalUsers: number;
  totalLikesCaptured: number;
  totalCommentsCaptured: number;
  results: ReactorCaptureResult[];
}> {
  const users = await db.linkedInAuth.findMany({ select: { userId: true } });

  const results: ReactorCaptureResult[] = [];
  for (const user of users) {
    const result = await captureReactorsForUser(user.userId);
    results.push(result);
  }

  return {
    totalUsers: users.length,
    totalLikesCaptured: results.reduce((s, r) => s + r.likesCaptured, 0),
    totalCommentsCaptured: results.reduce((s, r) => s + r.commentsCaptured, 0),
    results,
  };
}
