import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const entreprise = searchParams.get("entreprise");

  const where: Record<string, unknown> = { userId: DEFAULT_USER_ID };
  if (entreprise) where.entreprise = { contains: entreprise };

  if (search) {
    where.OR = [
      { prenom: { contains: search } },
      { nom: { contains: search } },
      { email: { contains: search } },
      { entreprise: { contains: search } },
    ];
  }

  const contacts = await db.contact.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Parse JSON fields
  const mapped = contacts.map((c) => ({
    ...c,
    tags: typeof c.tags === "string" ? JSON.parse(c.tags) : c.tags,
  }));

  return NextResponse.json(mapped);
}

export async function POST(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();

  const contact = await db.contact.create({
    data: {
      userId: DEFAULT_USER_ID,
      prenom: body.prenom || "",
      nom: body.nom || "",
      email: body.email || "",
      telephone: body.telephone,
      entreprise: body.entreprise || "",
      poste: body.poste || "",
      secteur: body.secteur || "",
      siteWeb: body.siteWeb,
      linkedinUrl: body.linkedinUrl,
      source: body.source || "manual",
      notes: body.notes,
      tags: JSON.stringify(body.tags || []),
      score: body.score || 0,
    },
  });

  return NextResponse.json({ ...contact, tags: body.tags || [] }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...updates };
  if (updates.tags) data.tags = JSON.stringify(updates.tags);

  const contact = await db.contact.update({
    where: { id },
    data,
  });

  return NextResponse.json({ ...contact, tags: updates.tags || [] });
}

export async function DELETE(req: NextRequest) {
  await ensureDefaultUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await db.contact.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
