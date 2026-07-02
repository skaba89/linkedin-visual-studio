/**
 * HERMÈS — LinkedIn metrics sync
 *
 * For each LinkedInPost row that has a linkedinUrn, fetch the current
 * likes + comments counts from LinkedIn's /v2/socialActions endpoint and
 * update the row. This is what powers the "performance" view in the UI
 * without requiring the user to manually refresh.
 *
 * LinkedIn's personal-post metrics API:
 *   GET /v2/socialActions/{postUrn}/likes    → { elements: [...] }
 *   GET /v2/socialActions/{postUrn}/comments → { elements: [...] }
 *
 * There is NO way to fetch impressions for personal posts via the
 * standard API — that requires the Marketing API platform which is only
 * available for company pages. So we only sync likes + comments.
 *
 * Sync strategy:
 *   1. Find all LinkedInPost rows with a linkedinUrn that haven't been
 *      synced in the last 6 hours (rate-limit budget).
 *   2. For each, fetch likes + comments in parallel.
 *   3. Update the row with the new counts + metricsSyncedAt.
 *
 * Aggregate metrics (Metrics table) are also recomputed:
 *   - tauxEngagement = avg((likes + comments) / max(impressions, 1))
 *     across the user's last 20 posts. Since we don't have impressions,
 *     we use a proxy of `likes + comments` as the engagement count and
 *     compute the engagement rate as (likes + comments) / 100 (a rough
 *     LinkedIn average is ~2% engagement, so 100 views per engagement
 *     is a reasonable placeholder).
 */
import { db } from "@/lib/db";
import { getDecryptedTokenFromDB } from "@/lib/linkedin-token";
import { createLogger } from "@/lib/logger";

const log = createLogger("linkedin-metrics-sync");

/** Don't re-sync a post more often than this. */
const MIN_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Max posts to sync per user per cron tick (rate-limit budget). */
const MAX_POSTS_PER_USER = 50;

export interface PostSyncResult {
  postId: string;
  linkedinUrn: string;
  likes: number;
  comments: number;
  status: "synced" | "failed" | "skipped";
  error?: string;
}

export interface UserSyncResult {
  userId: string;
  postsTotal: number;
  postsSynced: number;
  postsFailed: number;
  postsSkipped: number;
  results: PostSyncResult[];
}

/**
 * Sync metrics for a single user's LinkedIn posts.
 *
 * @param userId — the HERMÈS user ID
 * @returns aggregate result of the sync
 */
export async function syncUserLinkedInMetrics(userId: string): Promise<UserSyncResult> {
  const token = await getDecryptedTokenFromDB(userId);
  if (!token) {
    log.info("Skipping metrics sync — no LinkedIn token", { userId });
    return {
      userId,
      postsTotal: 0,
      postsSynced: 0,
      postsFailed: 0,
      postsSkipped: 0,
      results: [],
    };
  }

  // Find posts with URNs that haven't been synced recently
  const cutoff = new Date(Date.now() - MIN_SYNC_INTERVAL_MS);
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

  const results: PostSyncResult[] = [];

  for (const post of posts) {
    const urn = post.linkedinUrn;
    if (!urn) continue;

    try {
      // Fetch likes + comments in parallel
      const [likesRes, commentsRes] = await Promise.all([
        fetch(
          `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(urn)}/likes?count=100`,
          { headers: { Authorization: `Bearer ${token}` } },
        ).catch((err) => ({
          ok: false,
          status: 0,
          json: async () => ({ error: err instanceof Error ? err.message : String(err) }),
          text: async () => "",
        })),
        fetch(
          `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(urn)}/comments?count=100`,
          { headers: { Authorization: `Bearer ${token}` } },
        ).catch((err) => ({
          ok: false,
          status: 0,
          json: async () => ({ error: err instanceof Error ? err.message : String(err) }),
          text: async () => "",
        })),
      ]);

      let likesCount = 0;
      let commentsCount = 0;

      if (likesRes.ok) {
        const likesData = await likesRes.json() as { elements?: unknown[]; _total?: number };
        likesCount = Array.isArray(likesData.elements)
          ? likesData.elements.length
          : (likesData._total ?? 0);
      } else if (likesRes.status === 401) {
        // Token expired — abort this user's sync entirely
        log.warn("LinkedIn token expired during metrics sync", { userId });
        results.push({
          postId: post.id,
          linkedinUrn: urn,
          likes: 0,
          comments: 0,
          status: "failed",
          error: "token expired",
        });
        break;
      }

      if (commentsRes.ok) {
        const commentsData = await commentsRes.json() as { elements?: unknown[]; _total?: number };
        commentsCount = Array.isArray(commentsData.elements)
          ? commentsData.elements.length
          : (commentsData._total ?? 0);
      }

      await db.linkedInPost.update({
        where: { id: post.id },
        data: {
          likes: likesCount,
          comments: commentsCount,
          metricsSyncedAt: new Date(),
        },
      });

      results.push({
        postId: post.id,
        linkedinUrn: urn,
        likes: likesCount,
        comments: commentsCount,
        status: "synced",
      });

      // Small delay between posts to be polite to LinkedIn's API
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      log.warn("Failed to sync post metrics", {
        userId,
        postId: post.id,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({
        postId: post.id,
        linkedinUrn: urn,
        likes: 0,
        comments: 0,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Recompute aggregate Metrics for this user
  await recomputeUserMetrics(userId);

  return {
    userId,
    postsTotal: posts.length,
    postsSynced: results.filter((r) => r.status === "synced").length,
    postsFailed: results.filter((r) => r.status === "failed").length,
    postsSkipped: results.filter((r) => r.status === "skipped").length,
    results,
  };
}

/**
 * Recompute the aggregate Metrics row for a user based on their
 * LinkedInPost metrics. Uses the last 20 posts as the rolling window.
 *
 * Note: without impressions (LinkedIn doesn't expose them for personal
 * posts), the engagement rate is an approximation: (likes + comments)
 * treated as a percentage of a nominal 100-view baseline per post.
 */
async function recomputeUserMetrics(userId: string): Promise<void> {
  const recentPosts = await db.linkedInPost.findMany({
    where: { userId, metricsSyncedAt: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { likes: true, comments: true },
  });

  if (recentPosts.length === 0) return;

  const totalEngagement = recentPosts.reduce(
    (sum, p) => sum + p.likes + p.comments,
    0,
  );
  const avgEngagementPerPost = totalEngagement / recentPosts.length;
  // Rough engagement rate: engagements / 100 (assumed avg views per post)
  // Capped at 100% to avoid absurd values for viral posts.
  const tauxEngagement = Math.min(100, (avgEngagementPerPost / 100) * 100);

  await db.metrics.upsert({
    where: { userId },
    create: {
      userId,
      postsPublished: await db.linkedInPost.count({ where: { userId } }),
      tauxEngagement,
      impressionsMoy: 0, // LinkedIn doesn't expose this for personal posts
    },
    update: {
      postsPublished: await db.linkedInPost.count({ where: { userId } }),
      tauxEngagement,
    },
  });
}

/**
 * Sync metrics for all users who have a LinkedInAuth row.
 * Called by the /api/cron/metrics-sync route.
 */
export async function syncAllUsersMetrics(): Promise<{
  totalUsers: number;
  totalPostsSynced: number;
  totalPostsFailed: number;
  results: UserSyncResult[];
}> {
  const users = await db.linkedInAuth.findMany({
    select: { userId: true },
  });

  const results: UserSyncResult[] = [];
  for (const user of users) {
    const result = await syncUserLinkedInMetrics(user.userId);
    results.push(result);
  }

  return {
    totalUsers: users.length,
    totalPostsSynced: results.reduce((s, r) => s + r.postsSynced, 0),
    totalPostsFailed: results.reduce((s, r) => s + r.postsFailed, 0),
    results,
  };
}
