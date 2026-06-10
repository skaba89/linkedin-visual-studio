import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function GET() {
  const leads = await db.lead.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { score: "desc" },
  });
  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();

  const lead = await db.lead.create({
    data: {
      userId: DEFAULT_USER_ID,
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
}

export async function PUT(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const lead = await db.lead.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json(lead);
}

export async function DELETE(req: NextRequest) {
  await ensureDefaultUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await db.lead.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
