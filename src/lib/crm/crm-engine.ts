// ============================================================
// CRM Engine — Phase 3: Multi-canal
// Scoring, Pipeline Management, Contact Intelligence
// ============================================================

import {
  type ContactData,
  type ContactScoreInput,
  type DealData,
  type DealStage,
  type DealStageConfig,
  type PipelineStageView,
  type PipelineSummary,
  type CRMFilter,
  type DealFilter,
  type ContactActivity,
  DEAL_STAGES,
  DEAL_STAGE_MAP,
  isDealActive,
} from "./types";

// ---- Contact Scoring ----

const ICP_TITLES = ["ceo", "co-fondateur", "fondateur", "cmo", "directeur marketing", "head of growth", "vp sales", "directeur commercial", "directrice commerciale"];
const ICP_SECTORS = ["saas", "b2b", "conseil", "agence", "formation", "marTech", "logiciel"];
const ICP_COMPANY_SIZE_KEYWORDS = ["startup", "scale-up", "pme", "sme"];

export function calculateContactScore(input: ContactScoreInput): number {
  let score = 0;

  // Title match (0-35 pts)
  const titleLower = input.poste.toLowerCase();
  const titleMatch = ICP_TITLES.some((t) => titleLower.includes(t));
  if (titleMatch) score += 35;
  else if (ICP_TITLES.some((t) => titleLower.split(" ").some((w) => t.includes(w)))) score += 15;

  // Sector match (0-25 pts)
  const sectorLower = input.secteur.toLowerCase();
  const sectorMatch = ICP_SECTORS.some((s) => sectorLower.includes(s));
  if (sectorMatch) score += 25;
  else score += 5;

  // Company keywords (0-15 pts)
  const companyLower = input.entreprise.toLowerCase();
  const companyMatch = ICP_COMPANY_SIZE_KEYWORDS.some((k) => companyLower.includes(k));
  if (companyMatch) score += 15;

  // Contact completeness (0-15 pts)
  if (input.hasEmail) score += 5;
  if (input.hasLinkedin) score += 5;
  if (input.hasPhone) score += 5;

  // Source quality (0-10 pts)
  const sourceScores: Record<string, number> = {
    "agent-qualif": 10,
    "agent-prospection": 8,
    linkedin: 7,
    email: 6,
    "agent-engagement": 5,
    website: 4,
    import: 3,
    manual: 2,
  };
  score += sourceScores[input.source] ?? 2;

  return Math.min(100, Math.max(0, score));
}

// ---- Pipeline Computation ----

export function computePipelineSummary(
  deals: DealData[],
  stages?: DealStageConfig[]
): PipelineSummary {
  const stageConfigs = stages ?? DEAL_STAGES;

  const stageViews: PipelineStageView[] = stageConfigs.map((stageConfig) => {
    const stageDeals = deals.filter((d) => d.stage === stageConfig.id);
    const totalValue = stageDeals.reduce((sum, d) => sum + d.valeur, 0);
    const weightedValue = stageDeals.reduce(
      (sum, d) => sum + d.valeur * (d.probabilite / 100),
      0
    );

    return {
      stage: stageConfig,
      deals: stageDeals,
      totalValue,
      weightedValue,
      count: stageDeals.length,
    };
  });

  const activeDeals = deals.filter((d) => isDealActive(d.stage));
  const wonDeals = deals.filter((d) => d.stage === "closed_won");
  const lostDeals = deals.filter((d) => d.stage === "closed_lost");

  const totalPipelineValue = activeDeals.reduce((sum, d) => sum + d.valeur, 0);
  const weightedPipeline = activeDeals.reduce(
    (sum, d) => sum + d.valeur * (d.probabilite / 100),
    0
  );

  const closedDeals = wonDeals.length + lostDeals.length;
  const winRate = closedDeals > 0 ? (wonDeals.length / closedDeals) * 100 : 0;
  const avgDealSize = deals.length > 0
    ? deals.reduce((sum, d) => sum + d.valeur, 0) / deals.length
    : 0;

  return {
    stages: stageViews,
    totalPipelineValue,
    weightedPipeline,
    totalDeals: deals.length,
    activeDeals: activeDeals.length,
    wonDeals: wonDeals.length,
    lostDeals: lostDeals.length,
    winRate,
    avgDealSize,
  };
}

// ---- Deal Stage Probabilities ----

const DEFAULT_PROBABILITIES: Record<DealStage, number> = {
  prospect: 10,
  qualification: 25,
  proposition: 50,
  negociation: 75,
  closed_won: 100,
  closed_lost: 0,
};

export function getDefaultProbability(stage: DealStage): number {
  return DEFAULT_PROBABILITIES[stage] ?? 20;
}

export function advanceDealStage(currentStage: DealStage): DealStage | null {
  const stageOrder: DealStage[] = [
    "prospect",
    "qualification",
    "proposition",
    "negociation",
    "closed_won",
  ];
  const idx = stageOrder.indexOf(currentStage);
  if (idx === -1 || idx >= stageOrder.length - 1) return null;
  return stageOrder[idx + 1];
}

// ---- Filtering ----

export function filterContacts(contacts: ContactData[], filter: CRMFilter): ContactData[] {
  let result = [...contacts];

  if (filter.search) {
    const s = filter.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.prenom.toLowerCase().includes(s) ||
        c.nom.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        c.entreprise.toLowerCase().includes(s) ||
        c.poste.toLowerCase().includes(s)
    );
  }

  if (filter.entreprise) {
    const e = filter.entreprise.toLowerCase();
    result = result.filter((c) => c.entreprise.toLowerCase().includes(e));
  }

  if (filter.secteur) {
    const s = filter.secteur.toLowerCase();
    result = result.filter((c) => c.secteur.toLowerCase().includes(s));
  }

  if (filter.source) {
    result = result.filter((c) => c.source === filter.source);
  }

  if (filter.minScore !== undefined) {
    result = result.filter((c) => c.score >= (filter.minScore ?? 0));
  }

  if (filter.tags && filter.tags.length > 0) {
    result = result.filter((c) =>
      filter.tags!.some((tag) => c.tags.includes(tag))
    );
  }

  return result;
}

export function filterDeals(deals: DealData[], filter: DealFilter): DealData[] {
  let result = [...deals];

  if (filter.stage) {
    result = result.filter((d) => d.stage === filter.stage);
  }

  if (filter.contactId) {
    result = result.filter((d) => d.contactId === filter.contactId);
  }

  if (filter.sourceCanal) {
    result = result.filter((d) => d.sourceCanal === filter.sourceCanal);
  }

  if (filter.minValue !== undefined) {
    result = result.filter((d) => d.valeur >= (filter.minValue ?? 0));
  }

  return result;
}

// ---- Activity Timeline ----

export function buildContactTimeline(
  contactId: string,
  emailMessages: Array<{
    id: string;
    subject: string;
    status: string;
    sentAt: string | null;
    openedAt: string | null;
    repliedAt: string | null;
    createdAt: string;
  }>,
  deals: Array<{
    id: string;
    titre: string;
    stage: string;
    createdAt: string;
    updatedAt: string;
  }>
): ContactActivity[] {
  const activities: ContactActivity[] = [];

  // Email activities
  for (const msg of emailMessages) {
    if (msg.sentAt) {
      activities.push({
        id: `email-sent-${msg.id}`,
        type: "email_sent",
        description: `Email envoye: ${msg.subject}`,
        timestamp: msg.sentAt,
        metadata: { subject: msg.subject },
      });
    }
    if (msg.openedAt) {
      activities.push({
        id: `email-opened-${msg.id}`,
        type: "email_opened",
        description: `Email ouvert: ${msg.subject}`,
        timestamp: msg.openedAt,
        metadata: { subject: msg.subject },
      });
    }
    if (msg.repliedAt) {
      activities.push({
        id: `email-replied-${msg.id}`,
        type: "email_replied",
        description: `Reponse recue: ${msg.subject}`,
        timestamp: msg.repliedAt,
        metadata: { subject: msg.subject },
      });
    }
  }

  // Deal activities
  for (const deal of deals) {
    activities.push({
      id: `deal-created-${deal.id}`,
      type: "deal_created",
      description: `Deal cree: ${deal.titre}`,
      timestamp: deal.createdAt,
      metadata: { titre: deal.titre, stage: deal.stage },
    });
    if (deal.updatedAt !== deal.createdAt) {
      activities.push({
        id: `deal-updated-${deal.id}`,
        type: "deal_stage_changed",
        description: `Deal mis a jour: ${deal.titre} -> ${DEAL_STAGE_MAP.get(deal.stage as DealStage)?.label ?? deal.stage}`,
        timestamp: deal.updatedAt,
        metadata: { titre: deal.titre, stage: deal.stage },
      });
    }
  }

  // Sort by timestamp descending
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return activities;
}

// ---- Format Helpers ----

export function formatCurrency(value: number, devise: string = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: devise,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPipelineValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M EUR`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K EUR`;
  return `${value.toFixed(0)} EUR`;
}
