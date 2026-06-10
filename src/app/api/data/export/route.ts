import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/data/export — Export all data as JSON
export async function GET(request: NextRequest) {
  try {
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

    const userId = "default";

    const data: Record<string, unknown[]> = {};

    for (const table of tablesToExport) {
      try {
        switch (table) {
          case "leads":
            data[table] = await prisma.lead.findMany({ where: { userId } });
            break;
          case "contacts":
            data[table] = await prisma.contact.findMany({ where: { userId } });
            break;
          case "deals":
            data[table] = await prisma.deal.findMany({ where: { userId } });
            break;
          case "generatedPosts":
            data[table] = await prisma.generatedPost.findMany({ where: { userId } });
            break;
          case "generatedMessages":
            data[table] = await prisma.generatedMessage.findMany({ where: { userId } });
            break;
          case "generatedComments":
            data[table] = await prisma.generatedComment.findMany({ where: { userId } });
            break;
          case "marketBriefings":
            data[table] = await prisma.marketBriefing.findMany({ where: { userId } });
            break;
          case "nurturingActions":
            data[table] = await prisma.nurturingAction.findMany({ where: { userId } });
            break;
          case "performanceInsights":
            data[table] = await prisma.performanceInsight.findMany({ where: { userId } });
            break;
          case "connectionRequests":
            data[table] = await prisma.connectionRequest.findMany({ where: { userId } });
            break;
          case "emailSequences":
            data[table] = await prisma.emailSequence.findMany({ where: { userId } });
            break;
          case "emailMessages":
            data[table] = await prisma.emailMessage.findMany({ where: { userId } });
            break;
          case "scheduledPosts":
            data[table] = await prisma.scheduledPost.findMany({ where: { userId } });
            break;
          case "metrics":
            data[table] = await prisma.metrics.findMany({ where: { userId } });
            break;
          case "activityLogs":
            data[table] = await prisma.activityLog.findMany({ where: { userId } });
            break;
          case "experiments":
            data[table] = await prisma.experiment.findMany({ where: { userId } });
            break;
          case "experimentResults":
            data[table] = await prisma.experimentResult.findMany({ where: { userId } });
            break;
          case "feedbackEvents":
            data[table] = await prisma.feedbackEvent.findMany({ where: { userId } });
            break;
          case "contentMetrics":
            data[table] = await prisma.contentMetric.findMany({ where: { userId } });
            break;
        }
      } catch {
        data[table] = [];
      }
    }

    if (format === "csv") {
      // Return first table as CSV (simplified)
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

    // Default: JSON
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=hermes_export.json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Export failed", details: String(error) },
      { status: 500 }
    );
  }
}
