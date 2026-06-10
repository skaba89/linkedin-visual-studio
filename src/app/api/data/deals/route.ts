import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const contactId = searchParams.get("contactId");

  const where: Record<string, unknown> = { userId: DEFAULT_USER_ID };
  if (stage) where.stage = stage;
  if (contactId) where.contactId = contactId;

  const deals = await db.deal.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();

  const deal = await db.deal.create({
    data: {
      userId: DEFAULT_USER_ID,
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
}

export async function PUT(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...updates };
  if (updates.dateCloturePrevue) data.dateCloturePrevue = new Date(updates.dateCloturePrevue);

  const deal = await db.deal.update({
    where: { id },
    data,
  });

  return NextResponse.json(deal);
}

export async function DELETE(req: NextRequest) {
  await ensureDefaultUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await db.deal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
