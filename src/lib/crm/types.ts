// ============================================================
// CRM Types & Constants — Phase 3: Multi-canal
// ============================================================

export interface ContactData {
  id: string;
  userId: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string | null;
  entreprise: string;
  poste: string;
  secteur: string;
  siteWeb?: string | null;
  linkedinUrl?: string | null;
  source: ContactSource;
  notes?: string | null;
  tags: string[];
  score: number;
  createdAt: string;
  updatedAt: string;
}

export type ContactSource =
  | "manual"
  | "linkedin"
  | "email"
  | "import"
  | "agent-qualif"
  | "agent-prospection"
  | "agent-engagement"
  | "website";

export interface DealData {
  id: string;
  userId: string;
  contactId: string;
  contact?: ContactData | null;
  titre: string;
  valeur: number;
  devise: string;
  stage: DealStage;
  probabilite: number;
  dateCloturePrevue?: string | null;
  sourceCanal?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DealStage =
  | "prospect"
  | "qualification"
  | "proposition"
  | "negociation"
  | "closed_won"
  | "closed_lost";

export interface DealStageConfig {
  id: DealStage;
  label: string;
  color: string;
  order: number;
}

export const DEAL_STAGES: DealStageConfig[] = [
  { id: "prospect", label: "Prospect", color: "#7B8A9A", order: 0 },
  { id: "qualification", label: "Qualification", color: "#60A5FA", order: 1 },
  { id: "proposition", label: "Proposition", color: "#A78BFA", order: 2 },
  { id: "negociation", label: "Negociation", color: "#F4A100", order: 3 },
  { id: "closed_won", label: "Gagne", color: "#00C48C", order: 4 },
  { id: "closed_lost", label: "Perdu", color: "#E5263A", order: 5 },
];

export const DEAL_STAGE_MAP = new Map(DEAL_STAGES.map((s) => [s.id, s]));

export function getDealStageLabel(stage: DealStage): string {
  return DEAL_STAGE_MAP.get(stage)?.label ?? stage;
}

export function getDealStageColor(stage: DealStage): string {
  return DEAL_STAGE_MAP.get(stage)?.color ?? "#7B8A9A";
}

export function isDealActive(stage: DealStage): boolean {
  return !["closed_won", "closed_lost"].includes(stage);
}

// Pipeline aggregated view
export interface PipelineStageView {
  stage: DealStageConfig;
  deals: DealData[];
  totalValue: number;
  weightedValue: number;
  count: number;
}

export interface PipelineSummary {
  stages: PipelineStageView[];
  totalPipelineValue: number;
  weightedPipeline: number;
  totalDeals: number;
  activeDeals: number;
  wonDeals: number;
  lostDeals: number;
  winRate: number;
  avgDealSize: number;
}

// Contact scoring
export interface ContactScoreInput {
  poste: string;
  secteur: string;
  entreprise: string;
  source: ContactSource;
  tags: string[];
  hasEmail: boolean;
  hasLinkedin: boolean;
  hasPhone: boolean;
}

export interface CRMFilter {
  search?: string;
  entreprise?: string;
  secteur?: string;
  source?: ContactSource;
  minScore?: number;
  tags?: string[];
}

export interface DealFilter {
  stage?: DealStage;
  contactId?: string;
  sourceCanal?: string;
  minValue?: number;
}

// Activity timeline for a contact
export interface ContactActivity {
  id: string;
  type: "email_sent" | "email_opened" | "email_replied" | "linkedin_message" | "linkedin_connection" | "call" | "note" | "deal_created" | "deal_stage_changed";
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
