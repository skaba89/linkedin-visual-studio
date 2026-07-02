/**
 * HERMÈS — Phase 4.2 — /api/billing/portal
 *
 * POST: create a Stripe Billing Portal session so the user can manage
 * their subscription (change payment method, cancel, view invoices).
 *
 * Response:
 *   { url: string }
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { createPortalSession, isStripeConfigured } from "@/lib/billing/stripe";

export async function POST() {
  try {
    const user = await requireUser();

    if (!isStripeConfigured()) {
      throw new HttpError(
        503,
        "Stripe n'est pas configuré. Contactez l'administrateur.",
        "SERVICE_UNAVAILABLE",
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const returnUrl = `${baseUrl}/billing`;

    const result = await createPortalSession(user.id, returnUrl);
    return NextResponse.json(result);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
