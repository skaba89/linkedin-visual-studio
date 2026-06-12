// HERMÈS A/B Testing Engine — Statistical testing with Z-test and Wilson score
// Single source of truth: Prisma database (no in-memory duplicate stores)

import {
  ExperimentType,
  ExperimentStatus,
  OutcomeType,
  Variant,
  ExperimentConfig,
  ExperimentResult,
  ExperimentReport,
  VariantReport,
  ABTestAssignment,
} from "./types";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

/**
 * Convert a Prisma Experiment record to an ExperimentConfig by parsing
 * the JSON `variants` field into a Variant[] array.
 */
function experimentToConfig(exp: {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  targetAgentId: string | null;
  variants: string;
  trafficSplit: string;
  startDate: Date | null;
  endDate: Date | null;
  winnerId: string | null;
  confidence: number;
}): ExperimentConfig {
  return {
    id: exp.id,
    name: exp.name,
    description: exp.description,
    type: exp.type as ExperimentType,
    status: exp.status as ExperimentStatus,
    targetAgentId: exp.targetAgentId ?? undefined,
    variants: JSON.parse(exp.variants) as Variant[],
    trafficSplit: exp.trafficSplit,
    startDate: exp.startDate ?? undefined,
    endDate: exp.endDate ?? undefined,
    winnerId: exp.winnerId ?? undefined,
    confidence: exp.confidence,
  };
}

export class ABTestingEngine {
  // Session-level assignment cache for performance — NOT a source of truth
  private assignments: Map<string, ABTestAssignment> = new Map();

  async createExperiment(
    config: Omit<ExperimentConfig, "id" | "status" | "confidence">
  ): Promise<ExperimentConfig> {
    await ensureDefaultUser();

    const experiment = await db.experiment.create({
      data: {
        userId: DEFAULT_USER_ID,
        name: config.name,
        description: config.description || "",
        type: config.type || "ab",
        status: "draft",
        targetAgentId: config.targetAgentId ?? null,
        variants: JSON.stringify(config.variants),
        trafficSplit: config.trafficSplit || "50/50",
        startDate: config.startDate ?? null,
        endDate: config.endDate ?? null,
        confidence: 0,
      },
    });

    return experimentToConfig(experiment);
  }

  async startExperiment(experimentId: string): Promise<ExperimentConfig | null> {
    const existing = await db.experiment.findUnique({ where: { id: experimentId } });
    if (!existing || existing.status !== "draft") return null;

    const updated = await db.experiment.update({
      where: { id: experimentId },
      data: {
        status: "running",
        startDate: new Date(),
      },
    });

    return experimentToConfig(updated);
  }

  async assignVariant(experimentId: string, userId: string): Promise<Variant | null> {
    const existing = await db.experiment.findUnique({ where: { id: experimentId } });
    if (!existing || existing.status !== "running") return null;

    const variants = JSON.parse(existing.variants) as Variant[];

    // Check session cache for existing assignment
    const key = `${experimentId}:${userId}`;
    const cached = this.assignments.get(key);
    if (cached) {
      return variants.find((v) => v.id === cached.variantId) || null;
    }

    // Consistent hashing for deterministic assignment
    const hash = this.consistentHash(userId, experimentId);
    const variant = this.selectVariant(variants, hash);

    if (variant) {
      this.assignments.set(key, {
        experimentId,
        variantId: variant.id,
        userId,
        timestamp: new Date(),
      });
    }

    return variant;
  }

  async recordOutcome(
    experimentId: string,
    variantId: string,
    outcome: OutcomeType,
    metricValue: number,
    metadata?: Record<string, unknown>
  ): Promise<ExperimentResult | null> {
    const existing = await db.experiment.findUnique({ where: { id: experimentId } });
    if (!existing) return null;

    const variants = JSON.parse(existing.variants) as Variant[];
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return null;

    await ensureDefaultUser();

    const created = await db.experimentResult.create({
      data: {
        userId: DEFAULT_USER_ID,
        experimentId,
        variantId,
        variantName: variant.name,
        impressionId: `imp-${Math.random().toString(36).slice(2, 8)}`,
        outcome,
        metricValue,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    // Check significance after each result
    await this.checkSignificance(experimentId);

    return {
      id: created.id,
      experimentId: created.experimentId,
      variantId: created.variantId,
      variantName: created.variantName,
      impressionId: created.impressionId ?? undefined,
      outcome: created.outcome as OutcomeType,
      metricValue: created.metricValue,
      metadata: created.metadata ? JSON.parse(created.metadata) : undefined,
      timestamp: created.createdAt,
    };
  }

  async checkSignificance(
    experimentId: string
  ): Promise<{ isSignificant: boolean; confidence: number }> {
    const existing = await db.experiment.findUnique({ where: { id: experimentId } });
    if (!existing) return { isSignificant: false, confidence: 0 };

    const results = await db.experimentResult.findMany({
      where: { experimentId, userId: DEFAULT_USER_ID },
    });

    if (results.length < 20) {
      await db.experiment.update({
        where: { id: experimentId },
        data: { confidence: 0 },
      });
      return { isSignificant: false, confidence: 0 };
    }

    // Get results per variant
    const variantResults = new Map<string, typeof results>();
    for (const result of results) {
      const arr = variantResults.get(result.variantId) || [];
      arr.push(result);
      variantResults.set(result.variantId, arr);
    }

    if (variantResults.size < 2) {
      await db.experiment.update({
        where: { id: experimentId },
        data: { confidence: 0 },
      });
      return { isSignificant: false, confidence: 0 };
    }

    // Compare first two variants using Z-test
    const variantIds = Array.from(variantResults.keys());
    const groupA = variantResults.get(variantIds[0])!;
    const groupB = variantResults.get(variantIds[1])!;

    const conversionsA = groupA.filter((r) => r.metricValue > 0).length;
    const conversionsB = groupB.filter((r) => r.metricValue > 0).length;
    const nA = groupA.length;
    const nB = groupB.length;

    const pA = conversionsA / nA;
    const pB = conversionsB / nB;

    // Z-test for two proportions
    const pPool = (conversionsA + conversionsB) / (nA + nB);
    const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB));

    if (se === 0) {
      await db.experiment.update({
        where: { id: experimentId },
        data: { confidence: 0 },
      });
      return { isSignificant: false, confidence: 0 };
    }

    const zScore = Math.abs(pB - pA) / se;
    const confidence = this.zScoreToConfidence(zScore);

    const isSignificant = confidence >= 0.95;
    const updateData: Record<string, unknown> = { confidence };
    if (isSignificant && existing.status === "running") {
      updateData.winnerId = pB > pA ? variantIds[1] : variantIds[0];
    }

    await db.experiment.update({
      where: { id: experimentId },
      data: updateData,
    });

    return { isSignificant, confidence };
  }

  async getReport(experimentId: string): Promise<ExperimentReport | null> {
    const existing = await db.experiment.findUnique({ where: { id: experimentId } });
    if (!existing) return null;

    const experiment = experimentToConfig(existing);
    const dbResults = await db.experimentResult.findMany({
      where: { experimentId, userId: DEFAULT_USER_ID },
    });

    // Convert DB results to typed results
    const results: ExperimentResult[] = dbResults.map((r) => ({
      id: r.id,
      experimentId: r.experimentId,
      variantId: r.variantId,
      variantName: r.variantName,
      impressionId: r.impressionId ?? undefined,
      outcome: r.outcome as OutcomeType,
      metricValue: r.metricValue,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      timestamp: r.createdAt,
    }));

    const variantReports: VariantReport[] = [];

    for (const variant of experiment.variants) {
      const variantResults = results.filter((r) => r.variantId === variant.id);
      const participants = variantResults.length;
      const conversions = variantResults.filter((r) => r.metricValue > 0).length;
      const conversionRate = participants > 0 ? conversions / participants : 0;

      const [lower, upper] = this.wilsonScoreInterval(conversions, participants);

      variantReports.push({
        variantId: variant.id,
        variantName: variant.name,
        participants,
        conversions,
        conversionRate,
        confidence95: [lower, upper],
        isWinner: experiment.winnerId === variant.id,
      });
    }

    const winner = variantReports.find((v) => v.isWinner);

    // Calculate duration
    let duration = "N/A";
    if (experiment.startDate) {
      const end = experiment.endDate || new Date();
      const days = Math.ceil(
        (end.getTime() - experiment.startDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      duration = `${days} jour${days > 1 ? "s" : ""}`;
    }

    return {
      experimentId,
      experimentName: experiment.name,
      status: experiment.status,
      variants: variantReports,
      winner,
      confidence: experiment.confidence,
      isSignificant: experiment.confidence >= 0.95,
      totalParticipants: results.length,
      duration,
    };
  }

  async updateStatus(
    experimentId: string,
    status: ExperimentStatus
  ): Promise<ExperimentConfig | null> {
    const existing = await db.experiment.findUnique({ where: { id: experimentId } });
    if (!existing) return null;

    const updateData: Record<string, unknown> = { status };
    if (status === "completed") {
      updateData.endDate = new Date();
    }

    const updated = await db.experiment.update({
      where: { id: experimentId },
      data: updateData,
    });

    return experimentToConfig(updated);
  }

  async getExperiments(): Promise<ExperimentConfig[]> {
    const experiments = await db.experiment.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
    });

    return experiments.map(experimentToConfig);
  }

  // Consistent hashing for deterministic variant assignment
  private consistentHash(userId: string, experimentId: string): number {
    const str = `${userId}:${experimentId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }

  // Weighted random variant selection
  private selectVariant(variants: Variant[], hash: number): Variant | null {
    if (variants.length === 0) return null;

    const totalTraffic = variants.reduce((sum, v) => sum + v.trafficPercent, 0);
    let cumulative = 0;

    for (const variant of variants) {
      cumulative += variant.trafficPercent / totalTraffic;
      if (hash <= cumulative) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  // Wilson score interval for binomial proportion
  private wilsonScoreInterval(successes: number, trials: number): [number, number] {
    if (trials === 0) return [0, 0];

    const z = 1.96; // 95% confidence
    const p = successes / trials;
    const n = trials;

    const denominator = 1 + (z * z) / n;
    const centre = (p + (z * z) / (2 * n)) / denominator;
    const spread = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denominator;

    return [
      Math.max(0, centre - spread),
      Math.min(1, centre + spread),
    ];
  }

  // Convert Z-score to confidence level
  private zScoreToConfidence(z: number): number {
    // Approximate using the normal CDF
    const absZ = Math.abs(z);
    // Simple approximation: confidence ≈ 1 - 2 * (1 - Φ(|z|))
    // Using an approximation of the normal CDF
    const t = 1 / (1 + 0.2316419 * absZ);
    const d = 0.3989422804014327; // 1/sqrt(2*pi)
    const p = d * Math.exp(-absZ * absZ / 2) *
      (0.319381530 * t + -0.356563782 * t * t + 1.781477937 * t * t * t +
        -1.821255978 * t * t * t * t + 1.330274429 * t * t * t * t * t);

    return Math.max(0, Math.min(1, 1 - 2 * p));
  }
}

// Singleton
export const abEngine = new ABTestingEngine();
