/**
 * HERMÈS — Phase 4.2 — Quota tracking & enforcement
 *
 * Tracks per-user resource usage per billing period and enforces plan
 * quotas. When a user attempts an action that would exceed their plan's
 * quota, the action is rejected with a 402 Payment Required error.
 *
 * Usage tracking:
 *   - One UsageQuota row per user per billing period (calendar month)
 *   - Auto-created on first action of the period (lazy init)
 *   - Counts are incremented atomically via Prisma's update({ data: { x: { increment: 1 } } })
 *   - Reset to 0 at the start of each new period (handled by a cron job
 *     OR lazily when getUsageForCurrentPeriod() detects a stale period)
 *
 * Enforcement:
 *   - checkQuota(userId, resource) → { allowed, current, limit, remaining }
 *   - incrementUsage(userId, resource, amount) → throws QuotaExceededError if over limit
 *   - Used by API routes via the withQuotaGuard() wrapper
 *
 * Multi-tenant safety:
 *   - All queries are scoped by userId
 *   - The user's plan is read from UserSettings.plan (cached for the
 *     duration of the request via the request context)
 */

import { db } from "@/lib/db";
import { getPlan, type PlanQuotas } from "@/lib/billing/plans";
import { HttpError } from "@/lib/http-error";

export type QuotaResource = keyof Pick<PlanQuotas,
  | "postsPublished"
  | "commentsPosted"
  | "reactorsCaptured"
  | "aiGenerations"
  | "profileVisitors"
  | "crmContacts"
>;

export interface QuotaStatus {
  allowed: boolean;
  resource: QuotaResource;
  current: number;
  limit: number; // -1 = unlimited
  remaining: number; // -1 = unlimited
  planId: string;
  upgradeUrl: string;
}

/**
 * Get the current billing period for a user.
 * Defaults to calendar month (1st to last day).
 */
function getCurrentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

/**
 * Get or create the UsageQuota row for the current billing period.
 * If the user has a stale quota from a previous period, it's reset.
 */
export async function getUsageForCurrentPeriod(userId: string) {
  const { start, end } = getCurrentPeriod();

  // Try to find an existing quota for this period
  let quota = await db.usageQuota.findUnique({
    where: { userId_periodStart: { userId, periodStart: start } },
  });

  if (!quota) {
    // Create a new quota row for this period
    quota = await db.usageQuota.create({
      data: {
        userId,
        periodStart: start,
        periodEnd: end,
      },
    });
  }

  return quota;
}

/**
 * Check if a user can perform an action that consumes a quota resource.
 * Returns the quota status (allowed + current + limit + remaining).
 *
 * Does NOT increment the counter — use incrementUsage() for that.
 */
export async function checkQuota(
  userId: string,
  resource: QuotaResource,
): Promise<QuotaStatus> {
  // Read the user's plan
  const settings = await db.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { plan: true },
  });
  const plan = getPlan(settings.plan);
  const limit = plan.quotas[resource] as number;

  // Read current usage
  const usage = await getUsageForCurrentPeriod(userId);
  const current = usage[resource] as number;

  // Unlimited?
  if (limit === -1) {
    return {
      allowed: true,
      resource,
      current,
      limit: -1,
      remaining: -1,
      planId: plan.id,
      upgradeUrl: "/billing",
    };
  }

  const remaining = Math.max(0, limit - current);
  return {
    allowed: current < limit,
    resource,
    current,
    limit,
    remaining,
    planId: plan.id,
    upgradeUrl: "/billing",
  };
}

/**
 * Increment the usage counter for a resource.
 * Throws HttpError(402, QUOTA_EXCEEDED) if the quota would be exceeded.
 *
 * Use this in API routes that perform quota-gated actions:
 *
 *   await incrementUsage(user.id, "postsPublished");
 *   // ... perform the action ...
 *
 * If the action fails AFTER incrementing, you should decrement:
 *
 *   try {
 *     await incrementUsage(user.id, "postsPublished");
 *     await publishPost();
 *   } catch (err) {
 *     await decrementUsage(user.id, "postsPublished");
 *     throw err;
 *   }
 */
export async function incrementUsage(
  userId: string,
  resource: QuotaResource,
  amount: number = 1,
): Promise<void> {
  const status = await checkQuota(userId, resource);
  if (!status.allowed) {
    throw new HttpError(
      402,
      `Quota dépassé: ${resource} (${status.current}/${status.limit})`,
      "QUOTA_EXCEEDED",
      {
        resource,
        current: status.current,
        limit: status.limit,
        planId: status.planId,
        upgradeUrl: status.upgradeUrl,
      },
    );
  }

  // Increment atomically
  const { start, end } = getCurrentPeriod();
  await db.usageQuota.upsert({
    where: { userId_periodStart: { userId, periodStart: start } },
    create: {
      userId,
      periodStart: start,
      periodEnd: end,
      [resource]: amount,
    },
    update: {
      [resource]: { increment: amount },
    },
  });
}

/**
 * Decrement the usage counter (rollback after a failed action).
 */
export async function decrementUsage(
  userId: string,
  resource: QuotaResource,
  amount: number = 1,
): Promise<void> {
  const { start, end } = getCurrentPeriod();
  await db.usageQuota.upsert({
    where: { userId_periodStart: { userId, periodStart: start } },
    create: {
      userId,
      periodStart: start,
      periodEnd: end,
    },
    update: {
      [resource]: { decrement: amount },
    },
  });
}

/**
 * Get all quota statuses for a user (for the billing dashboard).
 */
export async function getAllQuotas(userId: string): Promise<QuotaStatus[]> {
  const resources: QuotaResource[] = [
    "postsPublished",
    "commentsPosted",
    "reactorsCaptured",
    "aiGenerations",
    "profileVisitors",
    "crmContacts",
  ];
  return Promise.all(resources.map((r) => checkQuota(userId, r)));
}
