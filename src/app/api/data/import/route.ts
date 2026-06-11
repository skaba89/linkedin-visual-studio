import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// POST /api/data/import — Import data from JSON
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, mode = "merge" } = body; // mode: "merge" | "replace"

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "data object is required" },
        { status: 400 }
      );
    }

    const userId = "default";
    const results: Record<string, { imported: number; errors: number }> = {};

    for (const [table, rows] of Object.entries(data)) {
      if (!Array.isArray(rows)) continue;

      let imported = 0;
      let errors = 0;

      // In replace mode, delete existing data first
      if (mode === "replace") {
        try {
          await deleteTableData(table, userId);
        } catch {
          // Continue even if delete fails
        }
      }

      for (const row of rows) {
        try {
          const record = row as Record<string, unknown>;
          record.userId = userId;

          const result = await upsertRecord(table, record);
          if (result) {
            imported++;
          } else {
            errors++;
          }
        } catch {
          errors++;
        }
      }

      results[table] = { imported, errors };
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: "Import failed", details: String(error) },
      { status: 500 }
    );
  }
}

async function deleteTableData(table: string, userId: string): Promise<void> {
  switch (table) {
    case "leads":
      await prisma.lead.deleteMany({ where: { userId } });
      break;
    case "contacts":
      await prisma.contact.deleteMany({ where: { userId } });
      break;
    case "deals":
      await prisma.deal.deleteMany({ where: { userId } });
      break;
    case "activityLogs":
      await prisma.activityLog.deleteMany({ where: { userId } });
      break;
    case "metrics":
      await prisma.metrics.deleteMany({ where: { userId } });
      break;
  }
}

async function upsertRecord(table: string, record: Record<string, unknown>): Promise<boolean> {
  switch (table) {
    case "leads":
      await prisma.lead.create({ data: record as never });
      return true;
    case "contacts":
      await prisma.contact.create({ data: record as never });
      return true;
    case "deals":
      await prisma.deal.create({ data: record as never });
      return true;
    case "activityLogs":
      await prisma.activityLog.create({ data: record as never });
      return true;
    default:
      return false;
  }
}
