"use client";

/**
 * HERMÈS — Phase 4.2 — BillingView
 *
 * The billing & subscription page. Shows:
 *   1. Current plan card (plan name, price, status, renewal date)
 *   2. Usage progress bars (current vs quota for each resource)
 *   3. Plan picker (4 cards: Free / Pro / Business / Enterprise)
 *   4. Manage subscription button (Stripe Billing Portal)
 *
 * Premium UX:
 *   - "Recommended" badge on the Pro plan
 *   - Monthly/Yearly toggle (yearly shows ~2 months free)
 *   - Smooth transitions between plans
 *   - Loading states during checkout redirect
 *   - Toast notifications on success/error
 *   - Usage bars change color (green → yellow → red) as they approach the limit
 */

import { useState, useEffect, useCallback } from "react";
import { Check, Crown, Zap, Building2, Rocket, Loader2, CreditCard, TrendingUp } from "lucide-react";
import { toast } from "@/lib/toast";
import { PLAN_LIST, type Plan, type PlanId } from "@/lib/billing/plans";

interface SubscriptionInfo {
  plan: Plan;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  isStripeConfigured: boolean;
}

interface QuotaInfo {
  resource: string;
  current: number;
  limit: number;
  remaining: number;
  allowed: boolean;
  percentage: number;
}

interface UsageInfo {
  quotas: QuotaInfo[];
  periodStart: string;
  periodEnd: string;
}

const PLAN_ICONS: Record<PlanId, typeof Crown> = {
  free: Rocket,
  pro: Zap,
  business: Building2,
  enterprise: Crown,
};

const RESOURCE_LABELS: Record<string, string> = {
  postsPublished: "Posts publiés",
  commentsPosted: "Commentaires IA",
  reactorsCaptured: "Réacteurs capturés",
  aiGenerations: "Générations IA",
  profileVisitors: "Visiteurs importés",
  crmContacts: "Contacts CRM",
};

function usageColor(percentage: number): string {
  if (percentage < 0) return "bg-[#00D4FF]"; // unlimited
  if (percentage < 70) return "bg-[#00C48C]"; // green
  if (percentage < 90) return "bg-[#F4A100]"; // yellow
  return "bg-[#E5263A]"; // red
}

function formatNumber(n: number): string {
  if (n === -1) return "Illimité";
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString("fr-FR");
}

export default function BillingView() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval_] = useState<"monthly" | "yearly">("monthly");
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/subscription");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSubscription(data);
    } catch {
      // Use defaults
      setSubscription({
        plan: PLAN_LIST[0],
        subscriptionStatus: "none",
        trialEndsAt: null,
        currentPeriodEnd: null,
        stripeCustomerId: null,
        isStripeConfigured: false,
      });
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/usage");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsage(data);
    } catch {
      setUsage(null);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchSubscription(), fetchUsage()]).finally(() => setLoading(false));
  }, [fetchSubscription, fetchUsage]);

  const handleSubscribe = async (planId: PlanId) => {
    if (planId === "free") {
      toast.info("Le plan Free est actif par défaut");
      return;
    }
    if (!subscription?.isStripeConfigured) {
      toast.error("Stripe n'est pas configuré", {
        description: "Contactez l'administrateur pour activer les paiements",
      });
      return;
    }
    if (planId === subscription.plan.id) {
      toast.info("Vous êtes déjà sur ce plan");
      return;
    }

    setCheckoutPlan(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, interval }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error("Échec de la redirection Stripe", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setCheckoutPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error("Échec de l'ouverture du portail", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#00D4FF] animate-spin" />
      </div>
    );
  }

  const currentPlan = subscription?.plan ?? PLAN_LIST[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-[#00D4FF]" />
          Facturation & Abonnement
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Gérez votre abonnement, consultez votre usage, et changez de plan.
        </p>
      </div>

      {/* Current plan + Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current Plan Card */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-medium text-[#7B8A9A] uppercase tracking-wider">Plan actuel</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              subscription?.subscriptionStatus === "active"
                ? "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]/30"
                : subscription?.subscriptionStatus === "trialing"
                ? "bg-[#F4A100]/10 text-[#F4A100] border-[#F4A100]/30"
                : subscription?.subscriptionStatus === "past_due"
                ? "bg-[#E5263A]/10 text-[#E5263A] border-[#E5263A]/30"
                : "bg-[#7B8A9A]/10 text-[#7B8A9A] border-[#7B8A9A]/30"
            }`}>
              {subscription?.subscriptionStatus === "none" ? "Free" : subscription?.subscriptionStatus}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            {(() => {
              const Icon = PLAN_ICONS[currentPlan.id];
              return <Icon className="w-8 h-8 text-[#00D4FF]" />;
            })()}
            <div>
              <div className="text-2xl font-bold text-white">{currentPlan.name}</div>
              <div className="text-xs text-[#7B8A9A]">{currentPlan.description}</div>
            </div>
          </div>
          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-[#7B8A9A]">Prix</span>
              <span className="text-[#F0F4F8] font-medium">
                {currentPlan.priceMonthly === 0 ? "Gratuit" : `${currentPlan.priceMonthly} € / mois`}
              </span>
            </div>
            {subscription?.currentPeriodEnd && (
              <div className="flex justify-between">
                <span className="text-[#7B8A9A]">Renouvellement</span>
                <span className="text-[#F0F4F8] font-medium">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString("fr-FR")}
                </span>
              </div>
            )}
            {subscription?.trialEndsAt && (
              <div className="flex justify-between">
                <span className="text-[#7B8A9A]">Fin d'essai</span>
                <span className="text-[#F4A100] font-medium">
                  {new Date(subscription.trialEndsAt).toLocaleDateString("fr-FR")}
                </span>
              </div>
            )}
          </div>
          {subscription?.stripeCustomerId && (
            <button
              onClick={handleManageSubscription}
              className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium text-[#F0F4F8] bg-[#18212F] hover:bg-[#1F2A3A] border border-white/[0.06] transition-colors cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Gérer l'abonnement (Stripe)
            </button>
          )}
        </div>

        {/* Usage Card */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-medium text-[#7B8A9A] uppercase tracking-wider">Usage ce mois</span>
            {usage && (
              <span className="text-[10px] text-[#7B8A9A]">
                jusqu'au {new Date(usage.periodEnd).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>
          {!usage || usage.quotas.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="w-6 h-6 text-[#7B8A9A]/40 mx-auto mb-2" />
              <p className="text-[12px] text-[#7B8A9A]">Aucune utilisation enregistrée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {usage.quotas.map((q) => (
                <div key={q.resource}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-[#F0F4F8]">
                      {RESOURCE_LABELS[q.resource] ?? q.resource}
                    </span>
                    <span className="text-[11px] text-[#7B8A9A] font-mono">
                      {formatNumber(q.current)} / {formatNumber(q.limit)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#0A0E14] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${usageColor(q.percentage)}`}
                      style={{
                        width: q.percentage < 0 ? "100%" : `${Math.min(100, q.percentage)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Plans */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Changer de plan</h2>
          {/* Monthly / Yearly toggle */}
          <div className="flex items-center bg-[#0F1419] border border-white/[0.06] rounded-lg p-1">
            <button
              onClick={() => setInterval_("monthly")}
              className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                interval === "monthly" ? "bg-[#00D4FF] text-black" : "text-[#7B8A9A] hover:text-white"
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setInterval_("yearly")}
              className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                interval === "yearly" ? "bg-[#00D4FF] text-black" : "text-[#7B8A9A] hover:text-white"
              }`}
            >
              Annuel
              <span className="ml-1 text-[10px] text-[#00C48C]">-17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLAN_LIST.map((plan) => {
            const Icon = PLAN_ICONS[plan.id];
            const isCurrent = plan.id === currentPlan.id;
            const isCheckoutLoading = checkoutPlan === plan.id;
            const price = interval === "monthly" ? plan.priceMonthly : Math.round(plan.priceYearly / 12);

            return (
              <div
                key={plan.id}
                className={`relative bg-[#0F1520] border rounded-xl p-5 flex flex-col ${
                  plan.highlight
                    ? "border-[#00D4FF]/40 ring-1 ring-[#00D4FF]/20"
                    : "border-white/[0.06]"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#00D4FF] text-black text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Recommandé
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-5 h-5 ${plan.highlight ? "text-[#00D4FF]" : "text-[#7B8A9A]"}`} />
                  <span className="text-sm font-semibold text-white">{plan.name}</span>
                </div>
                <div className="mb-1">
                  <span className="text-2xl font-bold text-white">
                    {price === 0 ? "0 €" : `${price} €`}
                  </span>
                  <span className="text-[11px] text-[#7B8A9A]">/mois</span>
                </div>
                <p className="text-[11px] text-[#7B8A9A] mb-4 min-h-[32px]">{plan.description}</p>

                <ul className="space-y-2 mb-5 flex-1">
                  {plan.features.slice(0, 6).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-[#F0F4F8]">
                      <Check className="w-3 h-3 text-[#00C48C] mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isCurrent || isCheckoutLoading}
                  className={`w-full px-3 py-2 rounded-md text-[12px] font-medium transition-colors ${
                    isCurrent
                      ? "bg-[#18212F] text-[#7B8A9A] cursor-not-allowed"
                      : plan.highlight
                      ? "bg-[#00D4FF] text-black hover:bg-[#00D4FF]/90 cursor-pointer"
                      : "bg-[#18212F] text-[#F0F4F8] hover:bg-[#1F2A3A] cursor-pointer"
                  } ${isCheckoutLoading ? "opacity-50 cursor-wait" : ""}`}
                >
                  {isCheckoutLoading ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Redirection…
                    </span>
                  ) : isCurrent ? (
                    "Plan actuel"
                  ) : plan.priceMonthly === 0 ? (
                    "Plan gratuit"
                  ) : (
                    `Passer à ${plan.name}`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {!subscription?.isStripeConfigured && (
          <div className="mt-4 text-center text-[11px] text-[#7B8A9A]/70">
            Stripe n'est pas configuré — les paiements sont désactivés. Contactez l'administrateur.
          </div>
        )}
      </div>
    </div>
  );
}
