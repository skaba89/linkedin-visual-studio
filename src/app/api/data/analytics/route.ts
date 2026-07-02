/**
 * HERMÈS — Phase 6.4 — /api/data/analytics
 *
 * Aggregated analytics for the AnalyticsView dashboard.
 *
 * Returns:
 *   - scoreDistribution: histogram of contacts by score bucket
 *   - sourceBreakdown: count of contacts per source
 *   - weeklyAcquisition: new contacts created per ISO week (last 12 weeks)
 *   - funnel: stage-by-stage conversion (contact → replied → booked)
 *   - engagementTrend: weekly likes + comments captured (last 8 weeks)
 *   - topPerformingPosts: posts with highest engagement rate (top 5)
 *
 * All metrics are scoped to the authenticated user (multi-tenant safe).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleRouteError } from "@/lib/http-error";

export async function GET() {
  try {
    const user = await requireUser();

    // 1. Score distribution (5 buckets: 0-20, 20-40, 40-60, 60-80, 80-100)
    const contacts = await db.contact.findMany({
      where: { userId: user.id },
      select: { score: true, source: true, createdAt: true },
    });

    const scoreBuckets = [
      { label: "0-20", min: 0, max: 20, count: 0 },
      { label: "20-40", min: 20, max: 40, count: 0 },
      { label: "40-60", min: 40, max: 60, count: 0 },
      { label: "60-80", min: 60, max: 80, count: 0 },
      { label: "80-100", min: 80, max: 101, count: 0 },
    ];
    for (const c of contacts) {
      const bucket = scoreBuckets.find((b) => c.score >= b.min && c.score < b.max);
      if (bucket) bucket.count++;
    }

    // 2. Source breakdown
    const sourceMap = new Map<string, number>();
    for (const c of contacts) {
      const src = c.source || "manual";
      sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
    }
    const sourceBreakdown = Array.from(sourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // 3. Weekly acquisition (last 12 weeks)
    const now = new Date();
    const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
    const recentContacts = contacts.filter((c) => c.createdAt >= twelveWeeksAgo);
    const weeklyBuckets: { weekStart: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      // Get ISO week start (Monday)
      const day = weekStart.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diff);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const count = recentContacts.filter(
        (c) => c.createdAt >= weekStart && c.createdAt < weekEnd,
      ).length;
      weeklyBuckets.push({
        weekStart: weekStart.toISOString().split("T")[0],
        count,
      });
    }

    // 4. Funnel (contact → lead → replied → booked)
    // We need the Lead model for the full funnel
    const leads = await db.lead.findMany({
      where: { userId: user.id },
      select: { statut: true },
    });
    const funnel = {
      contacts: contacts.length,
      leads: leads.length,
      contacted: leads.filter((l) =>
        ["contacted", "replied", "booked", "won"].includes(l.statut),
      ).length,
      replied: leads.filter((l) =>
        ["replied", "booked", "won"].includes(l.statut),
      ).length,
      booked: leads.filter((l) => ["booked", "won"].includes(l.statut)).length,
      won: leads.filter((l) => l.statut === "won").length,
    };

    // 5. Engagement trend (last 8 weeks) — reactors captured per week
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    const reactors = await db.linkedInReactor.findMany({
      where: {
        userId: user.id,
        capturedAt: { gte: eightWeeksAgo },
      },
      select: { capturedAt: true, action: true },
    });
    const engagementBuckets: { weekStart: string; likes: number; comments: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      const day = weekStart.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diff);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const weekReactors = reactors.filter(
        (r) => r.capturedAt >= weekStart && r.capturedAt < weekEnd,
      );
      engagementBuckets.push({
        weekStart: weekStart.toISOString().split("T")[0],
        likes: weekReactors.filter((r) => r.action === "like").length,
        comments: weekReactors.filter((r) => r.action === "comment").length,
      });
    }

    // 6. Top performing content (by engagement rate)
    const topPosts = await db.contentMetric.findMany({
      where: { userId: user.id },
      orderBy: { engagementRate: "desc" },
      take: 5,
      select: {
        id: true,
        contentType: true,
        contentId: true,
        agentId: true,
        likes: true,
        comments: true,
        impressions: true,
        engagementRate: true,
        recordedAt: true,
      },
    });

    return NextResponse.json({
      scoreDistribution: scoreBuckets,
      sourceBreakdown,
      weeklyAcquisition: weeklyBuckets,
      funnel,
      engagementTrend: engagementBuckets,
      topPerformingPosts: topPosts,
      summary: {
        totalContacts: contacts.length,
        avgScore: contacts.length > 0
          ? Math.round(contacts.reduce((s, c) => s + c.score, 0) / contacts.length)
          : 0,
        qualifiedContacts: contacts.filter((c) => c.score >= 60).length,
        hotContacts: contacts.filter((c) => c.score >= 80).length,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
