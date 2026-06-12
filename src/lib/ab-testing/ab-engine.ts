// HERMÈS A/B Testing Engine — Prisma-persisted (BUG-H2 fix)
// Uses existing Experiment + ExperimentResult Prisma models

import { db, DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/db";
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

export class ABTestingEngine {
  private assignments: Map<string, ABTestAssignment> = new Map();

  async createExperiment(config: Omit<ExperimentConfig, "id" | "status" | "confidence">): Promise<ExperimentConfig> {
    await ensureDefaultUser();
    const row = await db.experiment.create({
      data: {
        userId: DEFAULT_USER_ID,
        name: config.name,
        description: config.description,
        type: config.type,
        status: "draft",
        targetAgentId: config.targetAgentId ?? null,
        variants: JSON.stringify(config.variants),
        trafficSplit: config.trafficSplit,
        confidence: 0,
      },
    });
    return this.dbToConfig(row);
  }

  async startExperiment(experimentId: string): Promise<ExperimentConfig | null> {
    const existing = await db.experiment.findUnique({ where: { id: experimentId } });
    if (!existing || existing.status !== "draft") return null;

    const row = await db.experiment.update({
      where: { id: experimentId },
      data: { status: "running", startDate: new Date() },
    });
    return this.dbToConfig(row);
  }

  async assignVariant(experimentId: string, userId: string): Promise<Variant | null> {
    const experiment = await this.getConfig(experimentId);
    if (!experiment || experiment.status !== "running") return null;

    // Check if already assigned
    const key = `${experimentId}:${userId}`;
    const existing = this.assignments.get(key);
    if (existing) {
      return experiment.variants.find((v) => v.id === existing.variantId) || null;
    }

    // Consistent hashing for deterministic assignment
    const hash = this.consistentHash(userId, experimentId);
    const variant = this.selectVariant(experiment.variants, hash);

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
    const experiment = await this.getConfig(experimentId);
    if (!experiment) return null;

    const variant = experiment.variants.find((v) => v.id === variantId);
    if (!variant) return null;

    const row = await db.experimentResult.create({
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

    const result: ExperimentResult = {
      id: row.id,
      experimentId: row.experimentId,
      variantId: row.variantId,
      variantName: row.variantName,
      impressionId: row.impressionId ?? undefined,
      outcome: row.outcome as OutcomeType,
      metricValue: row.metricValue,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      timestamp: row.createdAt,
    };

    // Check significance after each result
    await this.checkSignificance(experimentId);

    return result;
  }

  async checkSignificance(experimentId: string): Promise<{ isSignificant: boolean; confidence: number }> {
    const experiment = await this.getConfig(experimentId);
    if (!experiment) return { isSignificant: false, confidence: 0 };

    const dbResults = await db.experimentResult.findMany({
      where: { userId: DEFAULT_USER_ID, experimentId },
    });

    if (dbResults.length < 20) {
      await db.experiment.update({
        where: { id: experimentId },
        data: { confidence: 0 },
      });
      return { isSignificant: false, confidence: 0 };
    }

    // Get results per variant
    const variantResults = new Map<string, ExperimentResult[]>();
    for (const r of dbResults) {
      const result: ExperimentResult = {
        id: r.id,
        experimentId: r.experimentId,
        variantId: r.variantId,
        variantName: r.variantName,
        impressionId: r.impressionId ?? undefined,
        outcome: r.outcome as OutcomeType,
        metricValue: r.metricValue,
        metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
        timestamp: r.createdAt,
      };
      const existing = variantResults.get(r.variantId) || [];
      existing.push(result);
      variantResults.set(r.variantId, existing);
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
    const winnerId = isSignificant ? (pB > pA ? variantIds[1] : variantIds[0]) : null;

    await db.experiment.update({
      where: { id: experimentId },
      data: {
        confidence,
        ...(winnerId ? { winnerId } : {}),
      },
    });

    return { isSignificant, confidence };
  }

  async getReport(experimentId: string): Promise<ExperimentReport | null> {
    const experiment = await this.getConfig(experimentId);
    if (!experiment) return null;

    const dbResults = await db.experimentResult.findMany({
      where: { userId: DEFAULT_USER_ID, experimentId },
    });

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

    let duration = "N/A";
    if (experiment.startDate) {
      const end = experiment.endDate || new Date();
      const days = Math.ceil((end.getTime() - experiment.startDate.getTime()) / (24 * 60 * 60 * 1000));
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

  async updateStatus(experimentId: string, status: ExperimentStatus): Promise<ExperimentConfig | null> {
    const existing = await db.experiment.findUnique({ where: { id: experimentId } });
    if (!existing) return null;

    const data: Record<string, unknown> = { status };
    if (status === "completed") {
      data.endDate = new Date();
    }

    const row = await db.experiment.update({ where: { id: experimentId }, data });
    return this.dbToConfig(row);
  }

  async getExperiments(): Promise<ExperimentConfig[]> {
    const rows = await db.experiment.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.dbToConfig(r));
  }

  loadExperiments(_experiments: ExperimentConfig[]): void {
    // No-op — DB is the source of truth
  }

  // ─── Private helpers ────────────────────────────────────────────────

  private async getConfig(id: string): Promise<ExperimentConfig | null> {
    const row = await db.experiment.findUnique({ where: { id } });
    if (!row) return null;
    return this.dbToConfig(row);
  }

  private dbToConfig(row: {
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
    createdAt: Date;
    updatedAt: Date;
  }): ExperimentConfig {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type as ExperimentType,
      status: row.status as ExperimentStatus,
      targetAgentId: row.targetAgentId ?? undefined,
      variants: JSON.parse(row.variants || "[]"),
      trafficSplit: row.trafficSplit,
      startDate: row.startDate ?? undefined,
      endDate: row.endDate ?? undefined,
      winnerId: row.winnerId ?? undefined,
      confidence: row.confidence,
    };
  }

  private consistentHash(userId: string, experimentId: string): number {
    const str = `${userId}:${experimentId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) / 2147483647;
  }

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

  private wilsonScoreInterval(successes: number, trials: number): [number, number] {
    if (trials === 0) return [0, 0];

    const z = 1.96;
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

  private zScoreToConfidence(z: number): number {
    const absZ = Math.abs(z);
    const t = 1 / (1 + 0.2316419 * absZ);
    const d = 0.3989422804014327;
    const p = d * Math.exp(-absZ * absZ / 2) *
      (0.319381530 * t + -0.356563782 * t * t + 1.781477937 * t * t * t +
        -1.821255978 * t * t * t * t + 1.330274429 * t * t * t * t * t);

    return Math.max(0, Math.min(1, 1 - 2 * p));
  }
}

// Singleton
export const abEngine = new ABTestingEngine();
