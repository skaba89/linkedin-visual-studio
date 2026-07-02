/**
 * HERMÈS — Phase 3.8 — /api/data/profile-visitors
 *
 * GET: list profile visitors for the authenticated user.
 * POST: manually add a profile visitor (LinkedIn Premium dashboard copy).
 * DELETE: hard-delete a profile visitor.
 *
 * LinkedIn does NOT expose profile visitors via the standard API for
 * personal accounts. Users on LinkedIn Premium can see the "Who viewed
 * your profile" list in the LinkedIn UI. This route lets them manually
 * paste those visitors into HERMÈS so they can be tracked as warm leads
 * (score=60) and synced into the CRM.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleRouteError } from "@/lib/http-error";
import { stripEmojis } from "@/lib/sanitize-text";
import { stringifyJsonField } from "@/lib/json-field";

const VISITOR_SCORE = 60;

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const unsynced = searchParams.get("unsynced") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

    const where: Record<string, unknown> = { userId: user.id };
    if (unsynced) {
      where.syncedToCrmAt = null;
      where.ignored = false;
    }

    const visitors = await db.profileVisitor.findMany({
      where,
      orderBy: { visitedAt: "desc" },
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

    return NextResponse.json(visitors);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    if (!body.visitorName || typeof body.visitorName !== "string" || body.visitorName.trim().length === 0) {
      return NextResponse.json(
        { error: "Le champ 'visitorName' est requis" },
        { status: 400 },
      );
    }

    // Parse the visitor name into prenom/nom for the eventual CRM sync
    const nameParts = body.visitorName.trim().split(/\s+/);
    const prenom = nameParts[0] || body.visitorName;
    const nom = nameParts.slice(1).join(" ");

    // Optionally create the CRM contact at the same time as the visitor
    // (saves a click in the UI)
    let contactId: string | undefined;
    if (body.syncToCrm !== false) {
      // Check for existing contact by LinkedIn URL
      const existing = body.visitorProfileUrl
        ? await db.contact.findFirst({
            where: { userId: user.id, linkedinUrl: body.visitorProfileUrl },
            select: { id: true },
          })
        : null;

      if (existing) {
        contactId = existing.id;
      } else {
        const contact = await db.contact.create({
          data: {
            userId: user.id,
            prenom,
            nom,
            entreprise: "",
            poste: body.visitorHeadline ?? "",
            linkedinUrl: body.visitorProfileUrl ?? null,
            source: "profile_visitor",
            notes: body.note ?? "Visité votre profil LinkedIn",
            tags: stringifyJsonField(["linkedin", "profile_visitor"]),
            score: VISITOR_SCORE,
          },
        });
        contactId = contact.id;
      }
    }

    const visitor = await db.profileVisitor.create({
      data: {
        userId: user.id,
        visitorName: stripEmojis(body.visitorName).trim(),
        visitorHeadline: body.visitorHeadline ? stripEmojis(body.visitorHeadline).trim() : null,
        visitorProfileUrl: body.visitorProfileUrl ?? null,
        visitedAt: body.visitedAt ? new Date(body.visitedAt) : new Date(),
        source: body.source ?? "manual",
        note: body.note ?? null,
        contactId,
        syncedToCrmAt: contactId ? new Date() : null,
      },
    });

    return NextResponse.json(visitor, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
