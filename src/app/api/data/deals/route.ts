/**
 * HERMÈS — R-001 / R-002 — /api/data/deals
 * Migré vers requireUser() + assertOwnership.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage");
    const contactId = searchParams.get("contactId");

    const where: Record<string, unknown> = { userId: user.id };
    if (stage) where.stage = stage;
    if (contactId) where.contactId = contactId;

    const deals = await db.deal.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(deals);
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const deal = await db.deal.create({
      data: {
        userId: user.id,
        contactId: body.contactId,
        titre: body.titre || "",
        valeur: body.valeur || 0,
        devise: body.devise || "EUR",
        stage: body.stage || "prospect",
        probabilite: body.probabilite || 20,
        dateCloturePrevue: body.dateCloturePrevue ? new Date(body.dateCloturePrevue) : undefined,
        sourceCanal: body.sourceCanal,
        notes: body.notes,
      },
    });

    return NextResponse.json(deal, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      throw new HttpError(422, "id is required", "VALIDATION_ERROR", { field: "id" });
    }

    const existing = await db.deal.findUnique({ where: { id } });
    assertOwnership(existing, user.id);

    const data: Record<string, unknown> = { ...updates };
    if (updates.dateCloturePrevue) data.dateCloturePrevue = new Date(updates.dateCloturePrevue);

    const deal = await db.deal.update({
      where: { id },
      data,
    });

    return NextResponse.json(deal);
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      throw new HttpError(422, "id is required", "VALIDATION_ERROR", { field: "id" });
    }

    const existing = await db.deal.findUnique({ where: { id } });
    assertOwnership(existing, user.id);

    await db.deal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
