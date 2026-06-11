// HERMÈS A/B Testing Types

export type ExperimentType = "ab" | "multivariate" | "sequential";
export type ExperimentStatus = "draft" | "running" | "paused" | "completed" | "archived";
export type OutcomeType = "conversion" | "engagement" | "reply_rate" | "click_through" | "custom";

export interface Variant {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  trafficPercent: number;
}

export interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  type: ExperimentType;
  status: ExperimentStatus;
  targetAgentId?: string;
  variants: Variant[];
  trafficSplit: string;
  startDate?: Date;
  endDate?: Date;
  winnerId?: string;
  confidence: number;
}

export interface ExperimentResult {
  id: string;
  experimentId: string;
  variantId: string;
  variantName: string;
  impressionId?: string;
  outcome: OutcomeType;
  metricValue: number;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface ExperimentReport {
  experimentId: string;
  experimentName: string;
  status: ExperimentStatus;
  variants: VariantReport[];
  winner?: VariantReport;
  confidence: number;
  isSignificant: boolean;
  totalParticipants: number;
  duration: string;
}

export interface VariantReport {
  variantId: string;
  variantName: string;
  participants: number;
  conversions: number;
  conversionRate: number;
  confidence95: [number, number]; // Wilson score interval
  isWinner: boolean;
}

export interface ABTestAssignment {
  experimentId: string;
  variantId: string;
  userId: string;
  timestamp: Date;
}
