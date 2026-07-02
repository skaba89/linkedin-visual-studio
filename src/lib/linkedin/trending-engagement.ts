/**
 * HERMÈS — Phase 3.5 — Trending engagement engine
 *
 * For each user that has opted into engagement auto-reply:
 *   1. Load unsynced TrendingTopic rows (status="new")
 *   2. For each topic, web-search for relevant LinkedIn posts in the
 *      user's niche published in the last 48h
 *   3. Pick the top post (highest engagement, no AI spam signals)
 *   4. Generate an expert comment via generateExpertComment()
 *   5. Post the comment via the LinkedIn API (compliance-guarded)
 *   6. Update the TrendingTopic with the comment text + URN + status
 *
 * Compliance is enforced at multiple layers:
 *   - UserSettings.engagementAutoReply must be true (opt-in)
 *   - UserSettings.engagementMaxDailyComments caps daily AI comments
 *   - UserSettings.engagementMinHoursBetween enforces spacing
 *   - Compliance guard checks the user's dailyComments limit
 *   - Comment is sanitized to remove any AI tics + emojis before posting
 *
 * Server-side only — runs in cron context, no browser session.
 */
import { db } from "@/lib/db";
import { getDecryptedTokenFromDB } from "@/lib/linkedin-token";
import { createLogger } from "@/lib/logger";
import { generateExpertComment, type ExpertTone } from "@/lib/linkedin/expert-comment";
import { stripEmojis } from "@/lib/sanitize-text";
import { linkedInCompliance } from "@/lib/compliance/linkedin-compliance";

const log = createLogger("trending-engagement");

/** Web search helper using z-ai-web-dev-sdk directly. */
async function webSearchPosts(query: string, num: number = 8): Promise<SearchResult[]> {
  try {
    const { getZai } = await import("@/lib/z-ai-bootstrap");
    const zai = await getZai();
    const results = (await zai.functions.invoke("web_search", { query, num })) as unknown;
    if (!Array.isArray(results)) return [];
    return results.slice(0, num).map((r: Record<string, unknown>) => ({
      title: (r.title as string) ?? "",
      url: (r.url as string) ?? (r.link as string) ?? "",
      snippet: (r.content as string) ?? (r.snippet as string) ?? "",
    }));
  } catch (err) {
    log.warn("Web search failed in trending engagement", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface TargetPostCandidate {
  url: string;
  title: string;
  snippet: string;
  /** Heuristic engagement score (higher = better target). */
  score: number;
}

/**
 * Score a search result as a comment target.
 *
 * Higher score = better target. Boosts:
 *   - LinkedIn URLs (we can actually comment on these)
 *   - Recent content (snippets mentioning numbers, percentages)
 *   - Substantial snippets (more context for the AI to work with)
 *
 * Penalizes:
 *   - URLs that look like marketing blogs (medium, substack are OK;
 *     vendor blogs less so)
 *   - Very short snippets (no context for the AI)
 */
function scoreCandidate(result: SearchResult): TargetPostCandidate {
  let score = 0;
  const url = result.url.toLowerCase();

  if (url.includes("linkedin.com/posts/")) score += 100;
  else if (url.includes("linkedin.com")) score += 60;
  else if (url.includes("medium.com")) score += 20;
  else if (url.includes("substack.com")) score += 15;
  else if (url.includes("hbr.org") || url.includes("harvardbusinessreview")) score += 25;
  else score += 5;

  // Length boost
  if (result.snippet.length > 200) score += 15;
  if (result.snippet.length > 400) score += 10;

  // Number presence (signal of data-rich content)
  if (/\d+%/.test(result.snippet)) score += 10;
  if (/\b\d{4}\b/.test(result.snippet)) score += 5;

  return {
    ...result,
    score,
  };
}

/**
 * Find the best target post for a given trending topic.
 * Returns null if no suitable candidate was found.
 */
async function findTargetPostForTopic(
  topic: string,
  angle: string,
  icpSectors: string[],
): Promise<TargetPostCandidate | null> {
  const sectorsQuery = icpSectors.length > 0 ? icpSectors.slice(0, 2).join(" ") : "B2B IA";
  const query = `${topic} ${angle} ${sectorsQuery} site:linkedin.com OR site:medium.com`;
  const results = await webSearchPosts(query, 8);

  if (results.length === 0) return null;

  const scored = results.map(scoreCandidate).sort((a, b) => b.score - a.score);
  return scored[0] ?? null;
}

/**
 * Extract a LinkedIn post URN from a LinkedIn URL.
 * LinkedIn post URLs look like:
 *   https://www.linkedin.com/posts/username_some-slug-activity-1234567890
 *   https://www.linkedin.com/feed/update/urn:li:activity:1234567890
 *   https://www.linkedin.com/posts/username_activity-1234567890
 *
 * We construct the URN as `urn:li:activity:{id}` from the trailing number.
 * If we can't extract an ID, we return null (we can't comment without a URN).
 */
function extractPostUrnFromUrl(url: string): string | null {
  // Match the trailing activity ID
  const match = url.match(/activity[-_:](\d+)/);
  if (match) {
    return `urn:li:activity:${match[1]}`;
  }
  // Match an explicit URN in the URL
  const urnMatch = url.match(/urn:li:activity:(\d+)/);
  if (urnMatch) {
    return `urn:li:activity:${urnMatch[1]}`;
  }
  return null;
}

/**
 * Check whether the user is allowed to post an AI comment right now.
 * Combines UserSettings preferences with the compliance module.
 *
 * @returns "allowed" or a specific reason for blocking
 */
async function checkCanPostAiComment(
  userId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Check UserSettings.engagementAutoReply
  const settings = await db.userSettings.findUnique({ where: { userId } });
  if (!settings?.engagementAutoReply) {
    return { allowed: false, reason: "auto_reply_disabled" };
  }

  // 2. Check daily AI comment cap from UserSettings
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const aiCommentsToday = await db.expertComment.count({
    where: {
      userId,
      status: "posted",
      postedAt: { gte: today },
    },
  });
  if (aiCommentsToday >= settings.engagementMaxDailyComments) {
    return { allowed: false, reason: "daily_cap_reached" };
  }

  // 3. Check min hours between AI comments
  const lastAiComment = await db.expertComment.findFirst({
    where: {
      userId,
      status: "posted",
      postedAt: { not: null },
    },
    orderBy: { postedAt: "desc" },
    select: { postedAt: true },
  });
  if (lastAiComment?.postedAt) {
    const hoursSinceLast = (Date.now() - lastAiComment.postedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLast < settings.engagementMinHoursBetween) {
      return {
        allowed: false,
        reason: `min_hours_not_elapsed (${hoursSinceLast.toFixed(1)}h since last)`,
      };
    }
  }

  // 4. Check compliance module (LinkedIn dailyComments limit)
  await linkedInCompliance.initializedForUserId(userId);
  const check = await linkedInCompliance.canPerformAction("comment");
  if (!check.allowed) {
    return { allowed: false, reason: check.reason ?? "compliance_blocked" };
  }

  return { allowed: true };
}

/**
 * Engage trending topics for a single user.
 *
 * For each unsynced TrendingTopic (status="new"):
 *   - Find a target post via web search
 *   - Extract the post URN
 *   - Generate an expert comment
 *   - Post the comment via LinkedIn API
 *   - Update the topic with the comment + URN + status
 *
 * Stops at the first compliance block to avoid burning the daily quota.
 */
export async function engageTrendingTopicsForUser(
  userId: string,
  maxTopics: number = 3,
): Promise<{
  userId: string;
  topicsProcessed: number;
  commentsPosted: number;
  skipped: number;
  failed: number;
  reason?: string;
}> {
  // Pre-flight compliance check
  const canPost = await checkCanPostAiComment(userId);
  if (!canPost.allowed) {
    log.info("Skipping trending engagement for user — compliance block", {
      userId,
      reason: canPost.reason,
    });
    return {
      userId,
      topicsProcessed: 0,
      commentsPosted: 0,
      skipped: 0,
      failed: 0,
      reason: canPost.reason,
    };
  }

  // Load the user's ICP config for the web search query
  const icpConfig = await db.iCPConfig.findUnique({ where: { userId } });
  const icpSectorsRaw = icpConfig?.sectors ?? "[]";
  let icpSectors: string[] = [];
  try {
    icpSectors = JSON.parse(icpSectorsRaw as string);
  } catch {
    icpSectors = [];
  }

  // Load unsynced trending topics
  const topics = await db.trendingTopic.findMany({
    where: { userId, status: "new" },
    orderBy: { detectedAt: "desc" },
    take: maxTopics,
  });

  let commentsPosted = 0;
  let skipped = 0;
  let failed = 0;

  const token = await getDecryptedTokenFromDB(userId);
  if (!token) {
    log.info("Skipping trending engagement — no LinkedIn token", { userId });
    return {
      userId,
      topicsProcessed: 0,
      commentsPosted: 0,
      skipped: topics.length,
      failed: 0,
      reason: "no_linkedin_token",
    };
  }

  // Load user's LinkedIn person ID (needed for the comment actor field)
  const linkedInAuth = await db.linkedInAuth.findUnique({ where: { userId } });
  if (!linkedInAuth?.linkedInUserId) {
    log.info("Skipping trending engagement — no linkedInUserId", { userId });
    return {
      userId,
      topicsProcessed: 0,
      commentsPosted: 0,
      skipped: topics.length,
      failed: 0,
      reason: "no_linkedin_user_id",
    };
  }

  for (const topic of topics) {
    // Re-check compliance for each topic (quota may have been hit)
    const check = await checkCanPostAiComment(userId);
    if (!check.allowed) {
      log.info("Stopping trending engagement — compliance block mid-run", {
        userId,
        reason: check.reason,
      });
      skipped += topics.length - (commentsPosted + failed + skipped);
      break;
    }

    try {
      // 1. Find a target post
      const target = await findTargetPostForTopic(topic.topic, topic.angle, icpSectors);
      if (!target) {
        await db.trendingTopic.update({
          where: { id: topic.id },
          data: { status: "archived", error: "no_target_post_found" },
        });
        skipped++;
        continue;
      }

      // 2. Extract the post URN
      const postUrn = extractPostUrnFromUrl(target.url);
      if (!postUrn) {
        await db.trendingTopic.update({
          where: { id: topic.id },
          data: { status: "archived", error: "no_post_urn_in_url" },
        });
        skipped++;
        continue;
      }

      // 3. Generate an expert comment
      const settings = await db.userSettings.findUnique({ where: { userId } });
      const tone = (settings?.engagementTone as ExpertTone) ?? "expert";
      const comment = await generateExpertComment({
        postText: target.snippet,
        postAuthor: target.title,
        tone,
        icpSectors,
      });

      if (!comment) {
        await db.trendingTopic.update({
          where: { id: topic.id },
          data: { status: "failed", error: "comment_generation_failed" },
        });
        failed++;
        continue;
      }

      // 4. Post the comment via LinkedIn API
      const commentBody = {
        actor: `urn:li:person:${linkedInAuth.linkedInUserId}`,
        object: postUrn,
        message: { text: comment.text },
      };

      const postResponse = await fetch(
        `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify(commentBody),
        },
      );

      if (!postResponse.ok) {
        const errText = await postResponse.text();
        log.warn("LinkedIn comment post failed", {
          userId,
          topicId: topic.id,
          status: postResponse.status,
          error: errText.slice(0, 200),
        });
        await db.trendingTopic.update({
          where: { id: topic.id },
          data: {
            status: "failed",
            error: `linkedin_api_${postResponse.status}`,
            targetPostUrn: postUrn,
            targetPostExcerpt: target.snippet.slice(0, 280),
            commentText: comment.text,
          },
        });
        failed++;
        continue;
      }

      // 5. Extract the comment URN from the response
      const responseData = (await postResponse.json()) as { id?: string; $URN?: string; activity?: string };
      const commentUrn = responseData.$URN ?? responseData.id ?? "";

      // 6. Record the expert comment in the audit trail
      await db.expertComment.create({
        data: {
          userId,
          source: "trending",
          trendingTopicId: topic.id,
          targetPostUrn: postUrn,
          targetPostExcerpt: target.snippet.slice(0, 280),
          commentText: comment.text,
          tone: comment.tone,
          model: comment.model,
          status: "posted",
          commentUrn: commentUrn || null,
          postedAt: new Date(),
        },
      });

      // 7. Record the action in the compliance module
      await linkedInCompliance.initializedForUserId(userId);
      await linkedInCompliance.recordAction("comment");

      // 8. Update the trending topic
      await db.trendingTopic.update({
        where: { id: topic.id },
        data: {
          status: "commented",
          targetPostUrn: postUrn,
          targetPostExcerpt: target.snippet.slice(0, 280),
          commentText: comment.text,
          commentUrn: commentUrn || null,
          postedAt: new Date(),
        },
      });

      commentsPosted++;
      log.info("Expert comment posted for trending topic", {
        userId,
        topicId: topic.id,
        topic: topic.topic,
        postUrn,
        commentLength: comment.text.length,
      });

      // Sleep between topics to space out the comments
      await new Promise((r) => setTimeout(r, 30_000)); // 30s between topics
    } catch (err) {
      log.warn("Trending topic engagement failed", {
        userId,
        topicId: topic.id,
        error: err instanceof Error ? err.message : String(err),
      });
      await db.trendingTopic.update({
        where: { id: topic.id },
        data: {
          status: "failed",
          error: err instanceof Error ? err.message : "unknown_error",
        },
      });
      failed++;
    }
  }

  return {
    userId,
    topicsProcessed: topics.length,
    commentsPosted,
    skipped,
    failed,
  };
}

/**
 * Engage trending topics for all users who have opted into auto-reply.
 * Called by the /api/cron/trending-engage route (every 2 hours).
 */
export async function engageTrendingTopicsForAllUsers(): Promise<{
  totalUsers: number;
  totalCommentsPosted: number;
  totalFailed: number;
  results: Awaited<ReturnType<typeof engageTrendingTopicsForUser>>[];
}> {
  // Find users who have opted into engagement auto-reply AND have unsynced topics
  const users = await db.trendingTopic.groupBy({
    by: ["userId"],
    where: { status: "new" },
    _count: { _all: true },
  });

  const results: Awaited<ReturnType<typeof engageTrendingTopicsForUser>>[] = [];
  for (const u of users) {
    // Double-check the user has opted in (groupBy doesn't filter on UserSettings)
    const settings = await db.userSettings.findUnique({ where: { userId: u.userId } });
    if (!settings?.engagementAutoReply) continue;

    const result = await engageTrendingTopicsForUser(u.userId);
    results.push(result);
  }

  return {
    totalUsers: users.length,
    totalCommentsPosted: results.reduce((s, r) => s + r.commentsPosted, 0),
    totalFailed: results.reduce((s, r) => s + r.failed, 0),
    results,
  };
}

/**
 * Detect trending topics for a single user by running a web search and
 * asking the AI to structure the results into TrendingTopic rows.
 *
 * This is the "detection" half of the engine. It runs daily.
 */
export async function detectTrendingTopicsForUser(
  userId: string,
  maxTopics: number = 5,
): Promise<{ userId: string; topicsDetected: number }> {
  const icpConfig = await db.iCPConfig.findUnique({ where: { userId } });
  let icpSectors: string[] = [];
  try {
    icpSectors = JSON.parse(icpConfig?.sectors ?? "[]");
  } catch {
    icpSectors = [];
  }
  if (icpSectors.length === 0) icpSectors = ["B2B", "IA", "growth"];

  const query = `LinkedIn trending topics ${icpSectors.join(" ")} ${new Date().getFullYear()}`;
  const searchResults = await webSearchPosts(query, 10);
  if (searchResults.length === 0) {
    log.info("No web search results for trending topics", { userId });
    return { userId, topicsDetected: 0 };
  }

  // Use AI to structure the search results into trending topics
  const { serverChatCompletion } = await import("@/lib/server-ai-client");
  const searchContext = JSON.stringify(searchResults).slice(0, 4000);

  const response = await serverChatCompletion(
    [
      {
        role: "system",
        content: `Tu es un analyste de tendances LinkedIn B2B. À partir des résultats de recherche web ci-dessous, identifie ${maxTopics} sujets tendance pour du contenu LinkedIn B2B dans la niche: ${icpSectors.join(", ")}.

Pour chaque sujet, propose un angle spécifique et un hook.

Réponds en JSON strict (sans markdown):
[
  {
    "topic": "sujet en 3-5 mots",
    "angle": "angle spécifique à aborder",
    "heat": "hot|warm|rising",
    "suggestedHook": "première ligne du post",
    "sourceUrl": "URL de la source"
  }
]

Données de recherche web:
${searchContext}

Langue: français. AUCUN émoji.`,
      },
    ],
    { temperature: 0.7, maxTokens: 800 },
  );

  const jsonMatch = response.content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    log.warn("AI trending detection returned non-JSON", { userId, content: response.content });
    return { userId, topicsDetected: 0 };
  }

  let parsed: Array<{
    topic?: string;
    angle?: string;
    heat?: string;
    suggestedHook?: string;
    sourceUrl?: string;
  }>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    log.warn("Failed to parse trending topics JSON", { userId });
    return { userId, topicsDetected: 0 };
  }

  let created = 0;
  for (const t of parsed) {
    if (!t.topic || t.topic.trim().length === 0) continue;
    // Dedup: skip if a TrendingTopic with the same name exists in the last 7 days
    const existing = await db.trendingTopic.findFirst({
      where: {
        userId,
        topic: { equals: t.topic, mode: "insensitive" },
        detectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (existing) continue;

    await db.trendingTopic.create({
      data: {
        userId,
        topic: stripEmojis(t.topic).trim(),
        angle: stripEmojis(t.angle ?? "").trim(),
        heat: ["hot", "warm", "rising"].includes(t.heat ?? "") ? t.heat! : "warm",
        suggestedHook: stripEmojis(t.suggestedHook ?? "").trim(),
        sourceUrl: t.sourceUrl ?? null,
      },
    });
    created++;
  }

  log.info("Trending topics detected for user", { userId, created });
  return { userId, topicsDetected: created };
}

/**
 * Detect trending topics for all users with a LinkedInAuth row.
 * Called by the /api/cron/trending-detect route (daily at 6am UTC).
 */
export async function detectTrendingTopicsForAllUsers(): Promise<{
  totalUsers: number;
  totalTopicsDetected: number;
}> {
  const users = await db.linkedInAuth.findMany({ select: { userId: true } });

  let totalTopicsDetected = 0;
  for (const u of users) {
    try {
      const result = await detectTrendingTopicsForUser(u.userId);
      totalTopicsDetected += result.topicsDetected;
      // Be polite to the AI provider
      await new Promise((r) => setTimeout(r, 5000));
    } catch (err) {
      log.warn("Trending detection failed for user", {
        userId: u.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { totalUsers: users.length, totalTopicsDetected };
}
