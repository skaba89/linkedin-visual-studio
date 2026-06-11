import { NextResponse } from "next/server";
import { db, DEFAULT_USER_ID } from "@/lib/db";

export async function GET() {
  // Get metrics
  const metrics = await db.metrics.findUnique({
    where: { userId: DEFAULT_USER_ID },
  });

  // Get pipeline stats
  const deals = await db.deal.findMany({
    where: { userId: DEFAULT_USER_ID },
  });

  const activeDeals = deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const wonDeals = deals.filter((d) => d.stage === "closed_won");
  const lostDeals = deals.filter((d) => d.stage === "closed_lost");

  const totalPipelineValue = activeDeals.reduce((sum, d) => sum + d.valeur, 0);
  const weightedPipeline = activeDeals.reduce((sum, d) => sum + d.valeur * (d.probabilite / 100), 0);
  const wonValue = wonDeals.reduce((sum, d) => sum + d.valeur, 0);

  // Calculate costs (estimated based on usage)
  const postsPublished = metrics?.postsPublished || 0;
  const messagesEnvoyes = metrics?.messagesEnvoyes || 0;
  const leadsQualifies = metrics?.leadsQualifies || 0;
  const rdvsGeneres = metrics?.rdvsGeneres || 0;

  // Estimated costs
  const costPerPost = 0.5; // API costs
  const costPerMessage = 0.1;
  const costPerLead = 2.0; // Including scraping, qualification
  const costPerRdv = 5.0; // Including nurturing, follow-ups

  const totalCost =
    postsPublished * costPerPost +
    messagesEnvoyes * costPerMessage +
    leadsQualifies * costPerLead +
    rdvsGeneres * costPerRdv;

  // ROI calculation
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
    metrics: metrics ? {
      postsPublished: metrics.postsPublished,
      leadsQualifies: metrics.leadsQualifies,
      messagesEnvoyes: metrics.messagesEnvoyes,
      rdvsGeneres: metrics.rdvsGeneres,
      tauxReponse: metrics.tauxReponse,
    } : null,
  });
}
