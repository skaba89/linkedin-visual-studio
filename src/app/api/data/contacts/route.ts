/**
 * HERMÈS — R-001 / R-002 — /api/data/contacts
 *
 * Refactored to use `requireUser()` instead of the legacy `DEFAULT_USER_ID`.
 * Demonstrates the pattern on a route with search filters and a tag array.
 *
 * Same multi-tenant pattern as `/api/data/leads`:
 *  - `GET` scoped to the authenticated user
 *  - `POST` creates with `userId = user.id`
 *  - `PUT`/`DELETE` use `assertOwnership` to enforce isolation
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const entreprise = searchParams.get("entreprise");

    const where: Record<string, unknown> = { userId: user.id };
    if (entreprise) where.entreprise = { contains: entreprise, mode: "insensitive" };

    if (search) {
      where.OR = [
        { prenom: { contains: search, mode: "insensitive" } },
        { nom: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { entreprise: { contains: search, mode: "insensitive" } },
      ];
    }

    const contacts = await db.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contacts);
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

    const contact = await db.contact.create({
      data: {
        userId: user.id,
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
        tags: body.tags || [],
        score: body.score || 0,
      },
    });

    return NextResponse.json({ ...contact, tags: body.tags || [] }, { status: 201 });
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

    const existing = await db.contact.findUnique({ where: { id } });
    assertOwnership(existing, user.id);

    const data: Record<string, unknown> = { ...updates };
    if (updates.tags) data.tags = updates.tags;

    const contact = await db.contact.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ...contact, tags: updates.tags || [] });
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

    const existing = await db.contact.findUnique({ where: { id } });
    assertOwnership(existing, user.id);

    await db.contact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
