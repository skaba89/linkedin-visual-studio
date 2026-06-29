/**
 * HERMÈS — R-001 / R-002 — /api/data/pipeline
 * Migré vers requireUser() + ownerFilter.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isHttpError } from "@/lib/http-error";
import { DEAL_STAGES } from "@/lib/crm/types";

export async function GET() {
  try {
    const user = await requireUser();

    const deals = await db.deal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const contacts = await db.contact.findMany({
      where: { userId: user.id },
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
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
