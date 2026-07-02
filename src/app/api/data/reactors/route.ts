/**
 * HERMÈS — Phase 3.7 — /api/data/reactors
 *
 * Multi-tenant CRUD for LinkedInReactor rows.
 *
 * GET /api/data/reactors?action=like|comment&unsynced=true&limit=100
 *   - List reactors for the authenticated user
 *   - Filter by action (like/comment), sync status, ignored status
 *
 * POST /api/data/reactors/sync-crm
 *   - Trigger CRM sync for unsynced reactors (separate route)
 *
 * PATCH /api/data/reactors/{id}
 *   - Update ignored flag (mark as "not a lead")
 *
 * DELETE /api/data/reactors/{id}
 *   - Hard delete a reactor (rarely needed — prefer PATCH ignored=true)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action"); // like | comment
    const unsynced = searchParams.get("unsynced") === "true";
    const ignored = searchParams.get("ignored"); // "true" | "false" | undefined
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

    const where: Record<string, unknown> = { userId: user.id };
    if (action === "like" || action === "comment") {
      where.action = action;
    }
    if (unsynced) {
      where.syncedToCrmAt = null;
      where.ignored = false;
    }
    if (ignored === "true") where.ignored = true;
    if (ignored === "false") where.ignored = false;

    const reactors = await db.linkedInReactor.findMany({
      where,
      orderBy: { capturedAt: "desc" },
      take: limit,
      include: {
        contact: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            entreprise: true,
            poste: true,
            score: true,
          },
        },
      },
    });

    return NextResponse.json(reactors);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
