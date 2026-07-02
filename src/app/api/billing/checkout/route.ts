/**
 * HERMÈS — Phase 4.2 — /api/billing/checkout
 *
 * POST: create a Stripe Checkout Session for a plan subscription.
 *
 * Request body:
 *   { planId: "pro" | "business" | "enterprise", interval: "monthly" | "yearly" }
 *
 * Response:
 *   { url: string, sessionId: string }
 *
 * The user is redirected to the Stripe-hosted checkout page. After
 * successful payment, Stripe redirects back to the success URL, and
 * the webhook (/api/billing/webhook) updates the user's subscription.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { createCheckoutSession, isStripeConfigured } from "@/lib/billing/stripe";

const VALID_PLANS = ["pro", "business", "enterprise"] as const;
const VALID_INTERVALS = ["monthly", "yearly"] as const;

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    if (!isStripeConfigured()) {
      throw new HttpError(
        503,
        "Stripe n'est pas configuré. Contactez l'administrateur.",
        "SERVICE_UNAVAILABLE",
      );
    }

    const body = await req.json();
    const planId = body.planId as (typeof VALID_PLANS)[number];
    const interval = body.interval as (typeof VALID_INTERVALS)[number];

    if (!VALID_PLANS.includes(planId)) {
      throw new HttpError(400, "Plan invalide", "VALIDATION_ERROR");
    }
    if (!VALID_INTERVALS.includes(interval)) {
      throw new HttpError(400, "Intervalle invalide", "VALIDATION_ERROR");
    }

    // Build success/cancel URLs
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const successUrl = `${baseUrl}/billing?checkout=success&plan=${planId}`;
    const cancelUrl = `${baseUrl}/billing?checkout=canceled`;

    const result = await createCheckoutSession(
      user.id,
      user.email,
      planId,
      interval,
      successUrl,
      cancelUrl,
    );

    return NextResponse.json(result);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
