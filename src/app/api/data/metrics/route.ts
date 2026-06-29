/**
 * HERMÈS — R-001 / R-002 — /api/data/metrics
 * Migré vers requireUser(). Garde l'upsert sur userId unique.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isHttpError } from "@/lib/http-error";

export async function GET() {
  try {
    const user = await requireUser();
    let metrics = await db.metrics.findUnique({
      where: { userId: user.id },
    });

    if (!metrics) {
      metrics = await db.metrics.create({
        data: {
          userId: user.id,
          postsPublished: 12,
          impressionsMoy: 2340,
          tauxEngagement: 3.8,
          profilsCollectes: 156,
          leadsQualifies: 34,
          messagesEnvoyes: 28,
          tauxReponse: 28.5,
          rdvsGeneres: 8,
        },
      });
    }

    return NextResponse.json(metrics);
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const metrics = await db.metrics.upsert({
      where: { userId: user.id },
      update: body,
      create: {
        userId: user.id,
        ...body,
      },
    });

    return NextResponse.json(metrics);
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
