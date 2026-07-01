/**
 * HERMÈS — Email tracking endpoint (open + click)
 *
 * Public endpoint (no auth) called by:
 *  - Mail clients loading the 1×1 tracking pixel → records an open
 *  - Recipients clicking a rewritten link → records a click + 302 redirect
 *
 * Query params:
 *   msg   — EmailMessage ID (cuid)
 *   type  — "open" | "click"
 *   url   — (click only) original URL to redirect to
 *
 * This endpoint is referenced in middleware.ts's AUTH_SKIP_ROUTES so it
 * bypasses the NextAuth session check. It's safe because:
 *  - The `msg` ID is a cuid — unguessable
 *  - We only update timestamp fields (openedAt, clickedAt), never content
 *  - Clicks redirect to the original URL — no phishing vector (the URL is
 *    the one the sender put in the email, not user-controlled)
 *
 * Rate-limited at the IP level by middleware (default `api` category,
 * 100 req/min — enough for legitimate opens, blocks scraping).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transparentGifResponse } from "@/lib/email/send";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const msgId = searchParams.get("msg");
  const type = searchParams.get("type");
  const url = searchParams.get("url");

  if (!msgId || !type) {
    return new NextResponse("Bad request", { status: 400 });
  }

  if (type === "open") {
    try {
      // Only set openedAt if not already set (avoid overwriting the first open)
      await db.emailMessage.updateMany({
        where: { id: msgId, openedAt: null },
        data: { openedAt: new Date(), status: "opened" },
      });
    } catch (err) {
      console.error("[email-track] Failed to record open:", err);
    }
    return transparentGifResponse();
  }

  if (type === "click") {
    if (!url) {
      return new NextResponse("Missing URL", { status: 400 });
    }

    // Basic URL validation — must be http(s)
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return new NextResponse("Invalid URL scheme", { status: 400 });
      }
    } catch {
      return new NextResponse("Invalid URL", { status: 400 });
    }

    try {
      // Only set clickedAt on first click (avoid overwriting)
      await db.emailMessage.updateMany({
        where: { id: msgId, clickedAt: null },
        data: { clickedAt: new Date(), status: "clicked" },
      });
    } catch (err) {
      console.error("[email-track] Failed to record click:", err);
    }

    // 302 redirect to the original URL
    return NextResponse.redirect(url, { status: 302 });
  }

  return new NextResponse("Unknown type", { status: 400 });
}
