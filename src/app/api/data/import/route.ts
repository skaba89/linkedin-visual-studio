/**
 * HERMÈS — R-001 / R-002 — /api/data/import
 *
 * Réécriture complète :
 *  - Remplace `new PrismaClient()` (memory leak) par l'instance partagée `db`.
 *  - Remplace `userId = "default"` (hardcoded) par `requireUser()`.
 *  - Toutes les insertions sont scoppées à user.id (le `record.userId = userId`
 *    est conservé mais `userId` vient désormais de la session).
 *
 * TODO (R-008) : remapper les erreurs vers HttpError une fois le global error
 * handler en place.
 * TODO (R-002 deep) : vérifier que les `record.userId` imposés ne écrasent pas
 * un userId légitime déjà présent dans `record` (aujourd'hui on l'écrase ce qui
 * est OK car on ne fait jamais confiance au client sur ce champ).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isHttpError } from "@/lib/http-error";

// POST /api/data/import — Import data from JSON
// Multi-tenant safe: all imported rows are scoped to the authenticated user.
// Previously this route used `userId = "default"` which bypassed tenant
// isolation entirely — any authenticated user could overwrite another
// user's data via the "replace" mode.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const userId = user.id;

    const body = await request.json();
    const { data, mode = "merge" } = body; // mode: "merge" | "replace"

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "data object is required" },
        { status: 400 },
      );
    }


    const results: Record<string, { imported: number; errors: number }> = {};

    for (const [table, rows] of Object.entries(data)) {
      if (!Array.isArray(rows)) continue;

      let imported = 0;
      let errors = 0;

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
          // Always override userId with the authenticated user's id
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
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Import failed", details: String(err) },
      { status: 500 }
    );
  }
}

async function deleteTableData(table: string, userId: string): Promise<void> {
  switch (table) {
    case "leads":
      await db.lead.deleteMany({ where: { userId } });
      break;
    case "contacts":
      await db.contact.deleteMany({ where: { userId } });
      break;
    case "deals":
      await db.deal.deleteMany({ where: { userId } });
      break;
    case "activityLogs":
      await db.activityLog.deleteMany({ where: { userId } });
      break;
    case "metrics":
      await db.metrics.deleteMany({ where: { userId } });
      break;
  }
}

async function upsertRecord(
  table: string,
  record: Record<string, unknown>,
): Promise<boolean> {
  switch (table) {
    case "leads":
      await db.lead.create({ data: record as never });
      return true;
    case "contacts":
      await db.contact.create({ data: record as never });
      return true;
    case "deals":
      await db.deal.create({ data: record as never });
      return true;
    case "activityLogs":
      await db.activityLog.create({ data: record as never });
      return true;
    default:
      return false;
  }
}
