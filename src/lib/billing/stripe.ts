/**
 * HERMÈS — Phase 4.2 — Stripe client
 *
 * Lazy-loaded Stripe client. Returns null if STRIPE_SECRET_KEY is not set,
 * allowing the app to boot in development without a Stripe account.
 *
 * In production, set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET + STRIPE_PRICE_*
 * env vars to enable billing.
 *
 * Price IDs (configurable via env vars to support multiple Stripe accounts):
 *   STRIPE_PRICE_PRO_MONTHLY       — Pro plan, monthly billing
 *   STRIPE_PRICE_PRO_YEARLY        — Pro plan, yearly billing
 *   STRIPE_PRICE_BUSINESS_MONTHLY  — Business plan, monthly billing
 *   STRIPE_PRICE_BUSINESS_YEARLY   — Business plan, yearly billing
 *   STRIPE_PRICE_ENTERPRISE_MONTHLY — Enterprise plan, monthly billing
 *   STRIPE_PRICE_ENTERPRISE_YEARLY  — Enterprise plan, yearly billing
 *
 * The free plan has no Stripe price (it's the default when no subscription exists).
 */

import Stripe from "stripe";

let stripeInstance: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (stripeInstance !== undefined) return stripeInstance;
  if (!process.env.STRIPE_SECRET_KEY) {
    stripeInstance = null;
    return null;
  }
  stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
    maxNetworkRetries: 3,
  });
  return stripeInstance;
}

export function isStripeConfigured(): boolean {
  return getStripe() !== null;
}

/**
 * Map a (planId, interval) tuple to the corresponding Stripe Price ID.
 * Returns null if the price isn't configured (e.g., free plan).
 */
export function getPriceId(
  planId: "pro" | "business" | "enterprise",
  interval: "monthly" | "yearly",
): string | null {
  const envKey = `STRIPE_PRICE_${planId.toUpperCase()}_${interval.toUpperCase()}`;
  return process.env[envKey] ?? null;
}

/**
 * Map a Stripe Price ID back to a (planId, interval) tuple.
 * Used by the webhook handler to know which plan the user subscribed to.
 */
export function planFromPriceId(
  priceId: string,
): { planId: "pro" | "business" | "enterprise"; interval: "monthly" | "yearly" } | null {
  const plans: Array<"pro" | "business" | "enterprise"> = ["pro", "business", "enterprise"];
  const intervals: Array<"monthly" | "yearly"> = ["monthly", "yearly"];
  for (const planId of plans) {
    for (const interval of intervals) {
      const configured = getPriceId(planId, interval);
      if (configured && configured === priceId) {
        return { planId, interval };
      }
    }
  }
  return null;
}

/**
 * Create a Stripe Checkout Session for a plan subscription.
 *
 * @param userId         The HERMÈS user ID
 * @param userEmail      The user's email (for Stripe customer creation)
 * @param planId         The plan to subscribe to
 * @param interval       Monthly or yearly billing
 * @param successUrl     URL to redirect to after successful payment
 * @param cancelUrl      URL to redirect to if the user cancels
 * @returns              The Checkout Session URL
 */
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  planId: "pro" | "business" | "enterprise",
  interval: "monthly" | "yearly",
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const priceId = getPriceId(planId, interval);
  if (!priceId) {
    throw new Error(`No Stripe price configured for plan=${planId} interval=${interval}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: userEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
    metadata: {
      userId,
      planId,
      interval,
    },
    subscription_data: {
      metadata: { userId, planId, interval },
      trial_period_days: 7, // 7-day free trial
    },
    allow_promotion_codes: true,
  });

  return { url: session.url ?? "", sessionId: session.id };
}

/**
 * Create a Stripe Billing Portal session (lets the user manage their
 * subscription: change payment method, cancel, view invoices).
 */
export async function createPortalSession(
  userId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  // Look up the user's Stripe customer ID
  const settings = await import("@/lib/db").then((m) => m.db.userSettings.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  }));
  if (!settings?.stripeCustomerId) {
    throw new Error("User has no Stripe customer ID");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: settings.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}
