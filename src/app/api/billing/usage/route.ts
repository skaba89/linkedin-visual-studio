/**
 * HERMÈS — Phase 4.2 — /api/billing/usage
 *
 * GET: return the user's current usage vs quota for all resources.
 * Used by the billing dashboard to show progress bars.
 *
 * Response:
 *   {
 *     quotas: Array<{
 *       resource: string,
 *       current: number,
 *       limit: number,  // -1 = unlimited
 *       remaining: number,
 *       allowed: boolean,
 *       percentage: number,  // 0-100, or -1 if unlimited
 *     }>,
 *     periodStart: ISO string,
 *     periodEnd: ISO string,
 *   }
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { getAllQuotas } from "@/lib/billing/quota";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireUser();
    const quotas = await getAllQuotas(user.id);

    // Get the period dates
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Ensure a UsageQuota row exists for this period
    await db.usageQuota.upsert({
      where: { userId_periodStart: { userId: user.id, periodStart } },
      create: { userId: user.id, periodStart, periodEnd },
      update: {},
    });

    return NextResponse.json({
      quotas: quotas.map((q) => ({
        resource: q.resource,
        current: q.current,
        limit: q.limit,
        remaining: q.remaining,
        allowed: q.allowed,
        percentage: q.limit === -1 ? -1 : Math.min(100, Math.round((q.current / q.limit) * 100)),
      })),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
