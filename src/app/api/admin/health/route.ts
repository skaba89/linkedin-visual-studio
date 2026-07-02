/**
 * HERMÈS — R-008 — GET /api/admin/health
 *
 * Admin-only health check that demonstrates the `withApiHandler` pattern.
 * Eliminates the boilerplate `try/catch { if (isHttpError(err)) ... }` that
 * 26+ routes currently repeat.
 *
 * The handler body throws HttpError directly — the wrapper catches them and
 * serializes the response with the correct status, body, and headers
 * (including `X-Request-Id` for log correlation).
 *
 * Errors from `requireAdmin()` (401/403) and Prisma (P2002/P2025/...) are
 * also handled automatically by the wrapper.
 *
 * Responses:
 *   200 OK              — { status, uptime, db, requestId }
 *   401 Unauthorized    — not authenticated (from requireUser)
 *   403 Forbidden       — authenticated but not admin (from requireAdmin)
 *   500 Internal error  — unexpected
 */

import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";

export const GET = withApiHandler(async (_req, ctx) => {
  // requireAdmin throws HttpError(401) or HttpError(403) — the wrapper
  // catches them and serializes the response automatically.
  const admin = await requireAdmin();

  // DB health check — Prisma errors (P1001 connection lost, etc.) are
  // caught and mapped to 500 INTERNAL_ERROR by the wrapper.
  const userCount = await db.user.count();

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "hermes",
    admin: { id: admin.id, email: admin.email },
    db: { connected: true, userCount },
    requestId: ctx.requestId,
  });
});
