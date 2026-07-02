/**
 * HERMÈS — Phase 4.2 — Billing plans & quotas
 *
 * Defines the 4 subscription tiers and their resource limits. Used by
 * the billing API routes and the quota enforcement middleware to gate
 * premium features behind the appropriate plan.
 *
 * Plan hierarchy:
 *   free       — Trial / evaluation. Limited to 1 LinkedIn account, 10 posts/mo.
 *   pro        — Solo founder / freelancer. 1 account, 100 posts/mo, AI comments.
 *   business   — Small team. 3 accounts, 500 posts/mo, priority support.
 *   enterprise — Custom. Unlimited accounts, custom AI models, SLA.
 *
 * Pricing (EUR, monthly):
 *   free       — €0
 *   pro        — €49/mo
 *   business   — €199/mo
 *   enterprise — €499/mo (or annual contract)
 *
 * Quotas are enforced per billing period (calendar month by default).
 * When a user hits a quota, the action is rejected with a 402 Payment
 * Required and the user is invited to upgrade.
 */

export type PlanId = "free" | "pro" | "business" | "enterprise";

export interface PlanQuotas {
  /** Max LinkedIn posts published per billing period. -1 = unlimited. */
  postsPublished: number;
  /** Max AI expert comments posted on trending topics. -1 = unlimited. */
  commentsPosted: number;
  /** Max reactors captured (likes + comments on user's posts). -1 = unlimited. */
  reactorsCaptured: number;
  /** Max AI API calls (chat completions, embeddings). -1 = unlimited. */
  aiGenerations: number;
  /** Max manual profile visitor imports per period. -1 = unlimited. */
  profileVisitors: number;
  /** Max CRM contacts created (synced from reactors/visitors). -1 = unlimited. */
  crmContacts: number;
  /** Max LinkedIn accounts connected. */
  linkedinAccounts: number;
  /** Whether the engagement auto-reply (AI commenting on trending) is allowed. */
  engagementAutoReply: boolean;
  /** Whether the realtime SSE feed is enabled. */
  realtimeFeed: boolean;
  /** Whether A/B testing is enabled. */
  abTesting: boolean;
  /** Whether external integrations (HubSpot, Slack, etc.) are enabled. */
  externalIntegrations: boolean;
  /** Whether team workspaces are enabled. */
  teamWorkspaces: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number; // EUR
  priceYearly: number; // EUR (per year, ~2 months free)
  highlight?: boolean; // show "Recommended" badge in UI
  features: string[]; // human-readable list for the pricing card
  quotas: PlanQuotas;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    description: "Pour tester HERMÈS et valider votre stratégie d'acquisition",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "1 compte LinkedIn",
      "10 posts générés / mois",
      "30 réacteurs capturés / mois",
      "50 générations IA / mois",
      "CRM jusqu'à 100 contacts",
      "Dashboard temps réel",
      "Support communautaire",
    ],
    quotas: {
      postsPublished: 10,
      commentsPosted: 0,
      reactorsCaptured: 30,
      aiGenerations: 50,
      profileVisitors: 10,
      crmContacts: 100,
      linkedinAccounts: 1,
      engagementAutoReply: false,
      realtimeFeed: true,
      abTesting: false,
      externalIntegrations: false,
      teamWorkspaces: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Pour les solopreneurs et freelances sérieux",
    priceMonthly: 49,
    priceYearly: 490, // ~2 months free
    highlight: true,
    features: [
      "1 compte LinkedIn",
      "100 posts générés / mois",
      "500 réacteurs capturés / mois",
      "1 000 générations IA / mois",
      "CRM jusqu'à 5 000 contacts",
      "Commentaires IA experts sur tendances",
      "Feed temps réel illimité",
      "A/B testing",
      "Support prioritaire (48h)",
    ],
    quotas: {
      postsPublished: 100,
      commentsPosted: 50,
      reactorsCaptured: 500,
      aiGenerations: 1000,
      profileVisitors: 200,
      crmContacts: 5000,
      linkedinAccounts: 1,
      engagementAutoReply: true,
      realtimeFeed: true,
      abTesting: true,
      externalIntegrations: false,
      teamWorkspaces: false,
    },
  },
  business: {
    id: "business",
    name: "Business",
    description: "Pour les petites équipes (jusqu'à 3 membres)",
    priceMonthly: 199,
    priceYearly: 1990,
    features: [
      "3 comptes LinkedIn",
      "500 posts générés / mois",
      "2 500 réacteurs capturés / mois",
      "5 000 générations IA / mois",
      "CRM illimité",
      "Commentaires IA experts sur tendances",
      "Feed temps réel illimité",
      "A/B testing avancé",
      "Intégrations HubSpot, Pipedrive, Slack",
      "Workspaces équipe (3 sièges)",
      "Support prioritaire (24h)",
    ],
    quotas: {
      postsPublished: 500,
      commentsPosted: 250,
      reactorsCaptured: 2500,
      aiGenerations: 5000,
      profileVisitors: 1000,
      crmContacts: -1, // unlimited
      linkedinAccounts: 3,
      engagementAutoReply: true,
      realtimeFeed: true,
      abTesting: true,
      externalIntegrations: true,
      teamWorkspaces: true,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Pour les équipes qui scalent leur acquisition",
    priceMonthly: 499,
    priceYearly: 4990,
    features: [
      "Comptes LinkedIn illimités",
      "Posts illimités",
      "Réacteurs illimités",
      "Générations IA illimitées",
      "CRM illimité",
      "Commentaires IA experts sur tendances",
      "Feed temps réel illimité",
      "A/B testing avancé",
      "Toutes les intégrations",
      "Workspaces équipe illimités",
      "Modèles IA personnalisés",
      "SLA 99.9% + support dédié",
      "Onboarding personnalisé",
    ],
    quotas: {
      postsPublished: -1,
      commentsPosted: -1,
      reactorsCaptured: -1,
      aiGenerations: -1,
      profileVisitors: -1,
      crmContacts: -1,
      linkedinAccounts: -1,
      engagementAutoReply: true,
      realtimeFeed: true,
      abTesting: true,
      externalIntegrations: true,
      teamWorkspaces: true,
    },
  },
};

export const PLAN_LIST: Plan[] = [PLANS.free, PLANS.pro, PLANS.business, PLANS.enterprise];

/**
 * Get a plan by ID. Returns the free plan if the ID is invalid.
 */
export function getPlan(id: string): Plan {
  return PLANS[id as PlanId] ?? PLANS.free;
}

/**
 * Check if a plan allows a specific feature.
 */
export function planAllows(planId: string, feature: keyof PlanQuotas): boolean {
  const plan = getPlan(planId);
  const value = plan.quotas[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === -1 || value > 0;
  return false;
}

/**
 * Compare two plans: returns -1, 0, or 1 based on price.
 */
export function comparePlans(a: PlanId, b: PlanId): number {
  const order: PlanId[] = ["free", "pro", "business", "enterprise"];
  return order.indexOf(a) - order.indexOf(b);
}

/**
 * Is plan `a` >= plan `b`? Used to check if a user's plan includes a feature
 * that requires at least plan `b`.
 */
export function planAtLeast(a: string, b: PlanId): boolean {
  return comparePlans(a as PlanId, b) >= 0;
}
