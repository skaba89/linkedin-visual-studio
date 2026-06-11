import { NextResponse } from "next/server";
import { db, DEFAULT_USER_ID } from "@/lib/db";
import { DEAL_STAGES } from "@/lib/crm/types";

export async function GET() {
  const deals = await db.deal.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { createdAt: "desc" },
  });

  const contacts = await db.contact.findMany({
    where: { userId: DEFAULT_USER_ID },
  });

  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const stages = DEAL_STAGES.map((stage) => {
    const stageDeals = deals
      .filter((d) => d.stage === stage.id)
      .map((d) => ({
        ...d,
        contact: contactMap.get(d.contactId) || null,
      }));

    return {
      ...stage,
      deals: stageDeals,
      totalValue: stageDeals.reduce((sum, d) => sum + d.valeur, 0),
      count: stageDeals.length,
    };
  });

  const totalPipelineValue = deals
    .filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")
    .reduce((sum, d) => sum + d.valeur, 0);

  const weightedPipeline = deals
    .filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")
    .reduce((sum, d) => sum + d.valeur * (d.probabilite / 100), 0);

  return NextResponse.json({
    stages,
    totalPipelineValue,
    weightedPipeline,
    totalDeals: deals.length,
  });
}
