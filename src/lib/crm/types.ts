// HERMÈS CRM Types

export interface CRMContact {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  entreprise: string;
  poste: string;
  secteur: string;
  siteWeb?: string;
  linkedinUrl?: string;
  source: string;
  notes?: string;
  tags: string[];
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CRMDeal {
  id: string;
  contactId: string;
  titre: string;
  valeur: number;
  devise: string;
  stage: DealStage;
  probabilite: number;
  dateCloturePrevue?: Date;
  sourceCanal?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DealStage =
  | "prospect"
  | "qualification"
  | "proposition"
  | "negociation"
  | "closed_won"
  | "closed_lost";

export const DEAL_STAGES: { id: DealStage; label: string; color: string; order: number }[] = [
  { id: "prospect", label: "Prospect", color: "#7B8A9A", order: 0 },
  { id: "qualification", label: "Qualification", color: "#00D4FF", order: 1 },
  { id: "proposition", label: "Proposition", color: "#A78BFA", order: 2 },
  { id: "negociation", label: "Négociation", color: "#F4A100", order: 3 },
  { id: "closed_won", label: "Closed Won", color: "#00C48C", order: 4 },
  { id: "closed_lost", label: "Closed Lost", color: "#E5263A", order: 5 },
];

export interface PipelineConfig {
  stages: typeof DEAL_STAGES;
}

export interface PipelineStats {
  dealsByStage: Record<DealStage, { count: number; totalValue: number }>;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  averageDealSize: number;
  winRate: number;
}

export interface ContactTimelineEntry {
  type: "email" | "message" | "activity" | "note";
  date: Date;
  content: string;
  metadata?: Record<string, unknown>;
}
