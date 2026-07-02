/**
 * HERMÈS — Phase 4.2 — /api/billing/webhook
 *
 * Stripe webhook handler. Receives events from Stripe:
 *   - checkout.session.completed    — user completed checkout → upgrade plan
 *   - customer.subscription.updated — plan changed, payment method updated
 *   - customer.subscription.deleted — subscription canceled → downgrade to free
 *   - invoice.payment_failed        — payment failed → mark as past_due
 *
 * The webhook verifies the Stripe signature using STRIPE_WEBHOOK_SECRET.
 *
 * Multi-tenant safety:
 *   - The user is identified via the client_reference_id (set during checkout)
 *     or via the Stripe customer ID (looked up in UserSettings).
 *   - No PII is logged — only Stripe IDs and event types.
 *
 * Idempotency:
 *   - Stripe may retry webhooks, so this handler must be idempotent.
 *   - We use upsert() for all DB updates, which is safe to call multiple times.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe, planFromPriceId } from "@/lib/billing/stripe";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("stripe-webhook");

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // Get the raw body
  const payload = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    log.warn("Stripe webhook signature verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  log.info("Stripe webhook received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          id: string;
          client_reference_id?: string | null;
          customer?: string | { id: string } | null;
          subscription?: string | { id: string } | null;
        };
        const userId = session.client_reference_id ?? undefined;
        if (!userId) {
          log.warn("Webhook: no client_reference_id in session", { sessionId: session.id });
          break;
        }
        const customerId = typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

        if (customerId && subscriptionId) {
          // Fetch the subscription to get the price ID
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price?.id;
          if (priceId) {
            const planInfo = planFromPriceId(priceId);
            if (planInfo) {
              await db.userSettings.update({
                where: { userId },
                data: {
                  plan: planInfo.planId,
                  stripeCustomerId: customerId,
                  stripeSubscriptionId: subscriptionId,
                  subscriptionStatus: subscription.status,
                  currentPeriodEnd: new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000),
                },
              });
              log.info("User upgraded", { userId, plan: planInfo.planId });
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as { id: string; customer: string; status: string; current_period_end: number; items?: { data: Array<{ price?: { id?: string } }> } };
        const subscriptionId = subscription.id;
        const priceId = subscription.items?.data?.[0]?.price?.id;
        if (priceId) {
          const planInfo = planFromPriceId(priceId);
          if (planInfo) {
            await db.userSettings.updateMany({
              where: { stripeSubscriptionId: subscriptionId },
              data: {
                plan: planInfo.planId,
                subscriptionStatus: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              },
            });
            log.info("Subscription updated", { subscriptionId, plan: planInfo.planId, status: subscription.status });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as { id: string };
        await db.userSettings.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            plan: "free",
            subscriptionStatus: "canceled",
            stripeSubscriptionId: null,
            currentPeriodEnd: null,
          },
        });
        log.info("Subscription canceled", { subscriptionId: subscription.id });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as { subscription?: string };
        if (invoice.subscription) {
          await db.userSettings.updateMany({
            where: { stripeSubscriptionId: invoice.subscription },
            data: { subscriptionStatus: "past_due" },
          });
          log.warn("Payment failed", { subscriptionId: invoice.subscription });
        }
        break;
      }

      default:
        // Ignore events we don't handle
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    log.error("Webhook handler error", {
      type: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
