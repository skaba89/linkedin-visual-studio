import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function GET() {
  let metrics = await db.metrics.findUnique({
    where: { userId: DEFAULT_USER_ID },
  });

  if (!metrics) {
    await ensureDefaultUser();
    metrics = await db.metrics.create({
      data: {
        userId: DEFAULT_USER_ID,
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
}

export async function PUT(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();

  const metrics = await db.metrics.upsert({
    where: { userId: DEFAULT_USER_ID },
    update: body,
    create: {
      userId: DEFAULT_USER_ID,
      ...body,
    },
  });

  return NextResponse.json(metrics);
}
