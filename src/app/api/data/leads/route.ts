/**
 * HERMÈS — R-001 / R-002 — /api/data/leads
 *
 * Refactored to use `requireUser()` instead of the legacy `DEFAULT_USER_ID`.
 * Every Prisma query is now scoped by the authenticated user's id, enforcing
 * multi-tenant isolation at the data layer.
 *
 * Migration notes:
 *  - `GET /api/data/leads` now returns 401 if not authenticated.
 *  - `PUT`/`DELETE` use `assertOwnership` so a user cannot touch another
 *    tenant's leads (returns 404 — not 403 — to avoid leaking existence).
 *  - The `DEFAULT_USER_ID` import is removed; `ensureDefaultUser()` is no
 *    longer needed (the demo account is now seeded by `auth-config.ts`).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function GET() {
  try {
    const user = await requireUser();
    const leads = await db.lead.findMany({
      where: { userId: user.id },
      orderBy: { score: "desc" },
    });
    return NextResponse.json(leads);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const lead = await db.lead.create({
      data: {
        userId: user.id,
        prenom: body.prenom || "",
        poste: body.poste || "",
        entreprise: body.entreprise || "",
        secteur: body.secteur || "",
        score: body.score || 0,
        action: body.action || "viewed",
        postSujet: body.postSujet || "",
        statut: body.statut || "new",
        dateCollected: body.dateCollected || new Date().toISOString().split("T")[0],
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      throw new HttpError(422, "id is required", "VALIDATION_ERROR", {
        field: "id",
      });
    }

    const existing = await db.lead.findUnique({ where: { id } });
    assertOwnership(existing, user.id);

    const lead = await db.lead.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json(lead);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      throw new HttpError(422, "id is required", "VALIDATION_ERROR", {
        field: "id",
      });
    }

    const existing = await db.lead.findUnique({ where: { id } });
    assertOwnership(existing, user.id);

    await db.lead.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
