// HERMÈS A/B Testing Engine — Statistical testing with Z-test and Wilson score

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
  private experiments: Map<string, ExperimentConfig> = new Map();
  private results: Map<string, ExperimentResult[]> = new Map();
  private assignments: Map<string, ABTestAssignment> = new Map();

  createExperiment(config: Omit<ExperimentConfig, "id" | "status" | "confidence">): ExperimentConfig {
    const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const experiment: ExperimentConfig = {
      ...config,
      id,
      status: "draft",
      confidence: 0,
    };
    this.experiments.set(id, experiment);
    this.results.set(id, []);
    return experiment;
  }

  startExperiment(experimentId: string): ExperimentConfig | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "draft") return null;

    experiment.status = "running";
    experiment.startDate = new Date();
    return experiment;
  }

  assignVariant(experimentId: string, userId: string): Variant | null {
    const experiment = this.experiments.get(experimentId);
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

  recordOutcome(
    experimentId: string,
    variantId: string,
    outcome: OutcomeType,
    metricValue: number,
    metadata?: Record<string, unknown>
  ): ExperimentResult | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    const variant = experiment.variants.find((v) => v.id === variantId);
    if (!variant) return null;

    const result: ExperimentResult = {
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      experimentId,
      variantId,
      variantName: variant.name,
      impressionId: `imp-${Math.random().toString(36).slice(2, 8)}`,
      outcome,
      metricValue,
      metadata,
      timestamp: new Date(),
    };

    const results = this.results.get(experimentId) || [];
    results.push(result);
    this.results.set(experimentId, results);

    // Check significance after each result
    this.checkSignificance(experimentId);

    return result;
  }

  checkSignificance(experimentId: string): { isSignificant: boolean; confidence: number } {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return { isSignificant: false, confidence: 0 };

    const results = this.results.get(experimentId) || [];
    if (results.length < 20) {
      experiment.confidence = 0;
      return { isSignificant: false, confidence: 0 };
    }

    // Get results per variant
    const variantResults = new Map<string, ExperimentResult[]>();
    for (const result of results) {
      const existing = variantResults.get(result.variantId) || [];
      existing.push(result);
      variantResults.set(result.variantId, existing);
    }

    if (variantResults.size < 2) {
      experiment.confidence = 0;
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
      experiment.confidence = 0;
      return { isSignificant: false, confidence: 0 };
    }

    const zScore = Math.abs(pB - pA) / se;
    const confidence = this.zScoreToConfidence(zScore);

    experiment.confidence = confidence;

    const isSignificant = confidence >= 0.95;
    if (isSignificant && experiment.status === "running") {
      // Determine winner
      experiment.winnerId = pB > pA ? variantIds[1] : variantIds[0];
    }

    return { isSignificant, confidence };
  }

  getReport(experimentId: string): ExperimentReport | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    const results = this.results.get(experimentId) || [];
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

  updateStatus(experimentId: string, status: ExperimentStatus): ExperimentConfig | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    experiment.status = status;
    if (status === "completed") {
      experiment.endDate = new Date();
    }

    return experiment;
  }

  getExperiments(): ExperimentConfig[] {
    return Array.from(this.experiments.values());
  }

  loadExperiments(experiments: ExperimentConfig[]): void {
    for (const exp of experiments) {
      this.experiments.set(exp.id, exp);
      if (!this.results.has(exp.id)) {
        this.results.set(exp.id, []);
      }
    }
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
