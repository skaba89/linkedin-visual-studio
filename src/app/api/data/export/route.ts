/**
 * HERMÈS — R-001 / R-002 — /api/data/export
 *
 * Réécriture complète :
 *  - Remplace `new PrismaClient()` (memory leak — une nouvelle instance à chaque
 *    requête) par l'instance partagée `db` de `@/lib/db`.
 *  - Remplace `userId = "default"` (hardcoded) par `requireUser()` qui garantit
 *    l'authentification ET l'isolation multi-tenant.
 *  - Toutes les requêtes Prisma sont désormais scoppées par user.id.
 *
 * TODO (R-008) : remapper les `NextResponse.json({ error }, { status: 500 })`
 * vers des `HttpError` une fois le global error handler en place.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isHttpError } from "@/lib/http-error";

// GET /api/data/export — Export all data as JSON
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";
    const tables = searchParams.get("tables")?.split(",") ?? [];

    const availableTables = [
      "leads", "contacts", "deals", "generatedPosts", "generatedMessages",
      "generatedComments", "marketBriefings", "nurturingActions",
      "performanceInsights", "connectionRequests", "emailSequences",
      "emailMessages", "scheduledPosts", "metrics", "activityLogs",
      "experiments", "experimentResults", "feedbackEvents", "contentMetrics",
    ];

    const tablesToExport = tables.length > 0
      ? tables.filter((t) => availableTables.includes(t))
      : availableTables;

    const userId = user.id;
    const data: Record<string, unknown[]> = {};

    for (const table of tablesToExport) {
      try {
        switch (table) {
          case "leads":
            data[table] = await db.lead.findMany({ where: { userId } });
            break;
          case "contacts":
            data[table] = await db.contact.findMany({ where: { userId } });
            break;
          case "deals":
            data[table] = await db.deal.findMany({ where: { userId } });
            break;
          case "generatedPosts":
            data[table] = await db.generatedPost.findMany({ where: { userId } });
            break;
          case "generatedMessages":
            data[table] = await db.generatedMessage.findMany({ where: { userId } });
            break;
          case "generatedComments":
            data[table] = await db.generatedComment.findMany({ where: { userId } });
            break;
          case "marketBriefings":
            data[table] = await db.marketBriefing.findMany({ where: { userId } });
            break;
          case "nurturingActions":
            data[table] = await db.nurturingAction.findMany({ where: { userId } });
            break;
          case "performanceInsights":
            data[table] = await db.performanceInsight.findMany({ where: { userId } });
            break;
          case "connectionRequests":
            data[table] = await db.connectionRequest.findMany({ where: { userId } });
            break;
          case "emailSequences":
            data[table] = await db.emailSequence.findMany({ where: { userId } });
            break;
          case "emailMessages":
            data[table] = await db.emailMessage.findMany({ where: { userId } });
            break;
          case "scheduledPosts":
            data[table] = await db.scheduledPost.findMany({ where: { userId } });
            break;
          case "metrics":
            data[table] = await db.metrics.findMany({ where: { userId } });
            break;
          case "activityLogs":
            data[table] = await db.activityLog.findMany({ where: { userId } });
            break;
          case "experiments":
            data[table] = await db.experiment.findMany({ where: { userId } });
            break;
          case "experimentResults":
            data[table] = await db.experimentResult.findMany({ where: { userId } });
            break;
          case "feedbackEvents":
            data[table] = await db.feedbackEvent.findMany({ where: { userId } });
            break;
          case "contentMetrics":
            data[table] = await db.contentMetric.findMany({ where: { userId } });
            break;
        }
      } catch {
        data[table] = [];
      }
    }

    if (format === "csv") {
      const firstTable = tablesToExport[0];
      const rows = data[firstTable] ?? [];
      if (rows.length === 0) {
        return NextResponse.json({ error: "No data to export" }, { status: 404 });
      }
      const headers = Object.keys(rows[0] as Record<string, unknown>);
      const csvRows = [
        headers.join(","),
        ...rows.map((row) => {
          const r = row as Record<string, unknown>;
          return headers.map((h) => JSON.stringify(r[h] ?? "")).join(",");
        }),
      ];
      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${firstTable}_export.csv"`,
        },
      });
    }

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=hermes_export.json",
      },
    });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Export failed", details: String(err) },
      { status: 500 },
    );
  }
}
