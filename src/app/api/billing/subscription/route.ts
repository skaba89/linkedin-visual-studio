/**
 * HERMÈS — Phase 4.2 — /api/billing/subscription
 *
 * GET: return the current user's subscription status + plan details.
 *
 * Response shape:
 *   {
 *     plan: { id, name, description, priceMonthly, features, quotas },
 *     subscriptionStatus: "none" | "trialing" | "active" | "past_due" | "canceled",
 *     trialEndsAt: ISO string | null,
 *     currentPeriodEnd: ISO string | null,
 *     stripeCustomerId: string | null,
 *     isStripeConfigured: boolean,
 *   }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import { getPlan } from "@/lib/billing/plans";
import { isStripeConfigured } from "@/lib/billing/stripe";

export async function GET() {
  try {
    const user = await requireUser();
    const settings = await db.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });

    const plan = getPlan(settings.plan);

    return NextResponse.json({
      plan: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        features: plan.features,
        quotas: plan.quotas,
        highlight: plan.highlight,
      },
      subscriptionStatus: settings.subscriptionStatus,
      trialEndsAt: settings.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: settings.currentPeriodEnd?.toISOString() ?? null,
      stripeCustomerId: settings.stripeCustomerId,
      isStripeConfigured: isStripeConfigured(),
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
}
