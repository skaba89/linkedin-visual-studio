/**
 * HERMÈS — Phase 3.7 — /api/data/engagement-settings
 *
 * GET: read the authenticated user's engagement preferences.
 * PUT: update them.
 *
 * Preferences:
 *   - engagementAutoReply (Boolean) — opt-in toggle for auto-reply on trending topics
 *   - engagementMaxDailyComments (Int) — hard cap (also bounded by compliance)
 *   - engagementTone (String) — expert | analytical | contrarian | casual
 *   - engagementMinHoursBetween (Float) — min hours between AI comments
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleRouteError } from "@/lib/http-error";

const VALID_TONES = ["expert", "analytical", "contrarian", "casual"];

export async function GET() {
  try {
    const user = await requireUser();
    const settings = await db.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });

    return NextResponse.json({
      engagementAutoReply: settings.engagementAutoReply,
      engagementMaxDailyComments: settings.engagementMaxDailyComments,
      engagementTone: settings.engagementTone,
      engagementMinHoursBetween: settings.engagementMinHoursBetween,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const data: Record<string, unknown> = {};

    if (typeof body.engagementAutoReply === "boolean") {
      data.engagementAutoReply = body.engagementAutoReply;
    }

    if (typeof body.engagementMaxDailyComments === "number") {
      // Clamp to a safe range — must not exceed 5 (LinkedIn dailyComments limit
      // at moderate level is 12, we cap at 5 to leave headroom for human comments)
      data.engagementMaxDailyComments = Math.max(1, Math.min(5, Math.floor(body.engagementMaxDailyComments)));
    }

    if (typeof body.engagementTone === "string" && VALID_TONES.includes(body.engagementTone)) {
      data.engagementTone = body.engagementTone;
    }

    if (typeof body.engagementMinHoursBetween === "number") {
      // Clamp between 1 and 24 hours
      data.engagementMinHoursBetween = Math.max(1, Math.min(24, body.engagementMinHoursBetween));
    }

    const settings = await db.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });

    return NextResponse.json({
      engagementAutoReply: settings.engagementAutoReply,
      engagementMaxDailyComments: settings.engagementMaxDailyComments,
      engagementTone: settings.engagementTone,
      engagementMinHoursBetween: settings.engagementMinHoursBetween,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
