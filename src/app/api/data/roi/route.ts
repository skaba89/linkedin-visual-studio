/**
 * HERMÈS — R-001 / R-002 — /api/data/roi
 * Migré vers requireUser() + ownerFilter.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isHttpError } from "@/lib/http-error";

export async function GET() {
  try {
    const user = await requireUser();

    const metrics = await db.metrics.findUnique({
      where: { userId: user.id },
    });

    const deals = await db.deal.findMany({
      where: { userId: user.id },
    });

    const activeDeals = deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
    const wonDeals = deals.filter((d) => d.stage === "closed_won");
    const lostDeals = deals.filter((d) => d.stage === "closed_lost");

    const totalPipelineValue = activeDeals.reduce((sum, d) => sum + d.valeur, 0);
    const weightedPipeline = activeDeals.reduce(
      (sum, d) => sum + d.valeur * (d.probabilite / 100),
      0,
    );
    const wonValue = wonDeals.reduce((sum, d) => sum + d.valeur, 0);

    const postsPublished = metrics?.postsPublished || 0;
    const messagesEnvoyes = metrics?.messagesEnvoyes || 0;
    const leadsQualifies = metrics?.leadsQualifies || 0;
    const rdvsGeneres = metrics?.rdvsGeneres || 0;

    // Estimated costs
    const costPerPost = 0.5;
    const costPerMessage = 0.1;
    const costPerLead = 2.0;
    const costPerRdv = 5.0;

    const totalCost =
      postsPublished * costPerPost +
      messagesEnvoyes * costPerMessage +
      leadsQualifies * costPerLead +
      rdvsGeneres * costPerRdv;

    const roi = totalCost > 0 ? ((wonValue - totalCost) / totalCost) * 100 : 0;
    const costPerQualifiedLead = leadsQualifies > 0 ? totalCost / leadsQualifies : 0;
    const costPerMeeting = rdvsGeneres > 0 ? totalCost / rdvsGeneres : 0;

    return NextResponse.json({
      totalCost: Math.round(totalCost * 100) / 100,
      wonValue,
      totalPipelineValue,
      weightedPipeline,
      roi: Math.round(roi * 10) / 10,
      costPerQualifiedLead: Math.round(costPerQualifiedLead * 100) / 100,
      costPerMeeting: Math.round(costPerMeeting * 100) / 100,
      dealsCount: {
        active: activeDeals.length,
        won: wonDeals.length,
        lost: lostDeals.length,
      },
      metrics: metrics
        ? {
            postsPublished: metrics.postsPublished,
            leadsQualifies: metrics.leadsQualifies,
            messagesEnvoyes: metrics.messagesEnvoyes,
            rdvsGeneres: metrics.rdvsGeneres,
            tauxReponse: metrics.tauxReponse,
          }
        : null,
    });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
