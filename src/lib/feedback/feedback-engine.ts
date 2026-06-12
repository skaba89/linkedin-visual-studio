// HERMÈS Feedback Engine — Continuous improvement and agent optimization

import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";
import {
  FeedbackMetricType,
  FeedbackAction,
  ContentType,
  FeedbackEventData,
  FeedbackInsight,
  FeedbackRule,
  AgentPerformanceSummary,
  FeedbackDashboardData,
} from "./types";

// Default feedback rules (used for seeding)
const DEFAULT_RULES: FeedbackRule[] = [
  {
    id: "low-engagement",
    name: "Engagement faible",
    metricType: "engagement_rate",
    condition: "below",
    threshold: 0.02,
    action: "modify_template",
    message: "Le taux d'engagement est inférieur à 2%. Ajustement des templates de contenu recommandé.",
    enabled: true,
  },
  {
    id: "low-reply-rate",
    name: "Taux de réponse faible",
    metricType: "reply_rate",
    condition: "below",
    threshold: 0.15,
    action: "change_timing",
    message: "Le taux de réponse est inférieur à 15%. Changement d'horaire d'envoi recommandé.",
    enabled: true,
  },
  {
    id: "high-conversion",
    name: "Conversion élevée",
    metricType: "conversion_rate",
    condition: "above",
    threshold: 0.10,
    action: "none",
    message: "Taux de conversion supérieur à 10%. Continuer sur cette lancée!",
    enabled: true,
  },
  {
    id: "low-qualification",
    name: "Qualification insuffisante",
    metricType: "qualification_rate",
    condition: "below",
    threshold: 0.20,
    action: "adjust_frequency",
    message: "Le taux de qualification est inférieur à 20%. Augmentation de la fréquence de collecte recommandée.",
    enabled: true,
  },
];

const AGENT_NAMES: Record<string, string> = {
  contenu: "Contenu",
  qualif: "Qualification",
  prospection: "Prospection",
  engagement: "Engagement",
  veille: "Veille",
  nurturing: "Nurturing",
  analyse: "Analyse",
  reseau: "Réseau",
};

/** Map a Prisma FeedbackRule row to the FeedbackRule interface */
function mapDbRuleToFeedbackRule(
  row: { ruleId: string; name: string; metricType: string; condition: string; threshold: number; action: string; message: string; enabled: boolean }
): FeedbackRule {
  return {
    id: row.ruleId,
    name: row.name,
    metricType: row.metricType as FeedbackMetricType,
    condition: row.condition as "above" | "below" | "equals",
    threshold: row.threshold,
    action: row.action as FeedbackAction,
    message: row.message,
    enabled: row.enabled,
  };
}

export class FeedbackEngine {
  async recordFeedback(data: FeedbackEventData): Promise<FeedbackInsight> {
    await ensureDefaultUser();
    const improvement = data.metricValue - data.baselineValue;
    const rules = await this.getRules();
    const rule = this.evaluateRules(data.metricType, data.metricValue, rules);
    const action = rule?.action || "none";
    const recommendation = rule?.message || this.generateRecommendation(data.metricType, improvement);

    const insight: FeedbackInsight = {
      agentId: data.sourceAgentId,
      agentName: AGENT_NAMES[data.sourceAgentId] || data.sourceAgentId,
      metric: data.metricType,
      currentValue: data.metricValue,
      baselineValue: data.baselineValue,
      improvement,
      recommendation,
      action,
      priority: this.calculatePriority(improvement, data.metricType),
    };

    await db.feedbackEvent.create({
      data: {
        userId: DEFAULT_USER_ID,
        sourceAgentId: data.sourceAgentId,
        contentType: data.contentType,
        contentId: data.contentId,
        metricType: data.metricType,
        metricValue: data.metricValue,
        baselineValue: data.baselineValue,
        improvement,
        actionTaken: action,
        lesson: recommendation,
      },
    });

    return insight;
  }

  calculateBaseline(metricType: FeedbackMetricType, agentId?: string): number {
    // Return default baselines based on metric type
    const baselines: Record<FeedbackMetricType, number> = {
      engagement_rate: 0.035,
      reply_rate: 0.25,
      conversion_rate: 0.05,
      click_through_rate: 0.03,
      qualification_rate: 0.30,
      meeting_rate: 0.10,
      connection_rate: 0.25,
    };

    // Could be enhanced to calculate from historical data
    return baselines[metricType] || 0.05;
  }

  evaluateRules(metricType: FeedbackMetricType, value: number, rules: FeedbackRule[]): FeedbackRule | null {
    for (const rule of rules) {
      if (!rule.enabled || rule.metricType !== metricType) continue;

      switch (rule.condition) {
        case "below":
          if (value < rule.threshold) return rule;
          break;
        case "above":
          if (value > rule.threshold) return rule;
          break;
        case "equals":
          if (Math.abs(value - rule.threshold) < 0.001) return rule;
          break;
      }
    }
    return null;
  }

  generateRecommendation(metricType: FeedbackMetricType, improvement: number): string {
    const metricLabels: Record<FeedbackMetricType, string> = {
      engagement_rate: "taux d'engagement",
      reply_rate: "taux de réponse",
      conversion_rate: "taux de conversion",
      click_through_rate: "taux de clic",
      qualification_rate: "taux de qualification",
      meeting_rate: "taux de rendez-vous",
      connection_rate: "taux de connexion",
    };

    const label = metricLabels[metricType] || metricType;

    if (improvement > 0.05) {
      return `Excellent! Le ${label} s'est amélioré de ${(improvement * 100).toFixed(1)}%. Continuez sur cette stratégie.`;
    } else if (improvement > 0) {
      return `Le ${label} s'est légèrement amélioré de ${(improvement * 100).toFixed(1)}%. Des ajustements mineurs pourraient accélérer la progression.`;
    } else if (improvement > -0.05) {
      return `Le ${label} a légèrement diminué de ${(Math.abs(improvement) * 100).toFixed(1)}%. Surveillez cette métrique et ajustez si la tendance se confirme.`;
    } else {
      return `Le ${label} a significativement diminué de ${(Math.abs(improvement) * 100).toFixed(1)}%. Action corrective recommandée immédiatement.`;
    }
  }

  async getInsights(limit: number = 10): Promise<FeedbackInsight[]> {
    await ensureDefaultUser();
    const events = await db.feedbackEvent.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return events.map((fb) => ({
      agentId: fb.sourceAgentId,
      agentName: AGENT_NAMES[fb.sourceAgentId] || fb.sourceAgentId,
      metric: fb.metricType as FeedbackMetricType,
      currentValue: fb.metricValue,
      baselineValue: fb.baselineValue,
      improvement: fb.improvement,
      recommendation: fb.lesson || this.generateRecommendation(fb.metricType as FeedbackMetricType, fb.improvement),
      action: (fb.actionTaken || "none") as FeedbackAction,
      priority: this.calculatePriority(fb.improvement, fb.metricType as FeedbackMetricType),
    }));
  }

  async getRules(): Promise<FeedbackRule[]> {
    await ensureDefaultUser();
    const dbRules = await db.feedbackRule.findMany({
      where: { userId: DEFAULT_USER_ID },
    });

    if (dbRules.length === 0) {
      // Seed from DEFAULT_RULES
      await db.feedbackRule.createMany({
        data: DEFAULT_RULES.map((r) => ({
          userId: DEFAULT_USER_ID,
          ruleId: r.id,
          name: r.name,
          metricType: r.metricType,
          condition: r.condition,
          threshold: r.threshold,
          action: r.action,
          message: r.message,
          enabled: r.enabled,
        })),
      });

      const seeded = await db.feedbackRule.findMany({
        where: { userId: DEFAULT_USER_ID },
      });
      return seeded.map(mapDbRuleToFeedbackRule);
    }

    return dbRules.map(mapDbRuleToFeedbackRule);
  }

  async toggleRule(ruleId: string, enabled?: boolean): Promise<FeedbackRule | null> {
    await ensureDefaultUser();
    const existing = await db.feedbackRule.findUnique({
      where: { userId_ruleId: { userId: DEFAULT_USER_ID, ruleId } },
    });
    if (!existing) return null;

    const newEnabled = enabled ?? !existing.enabled;
    const updated = await db.feedbackRule.update({
      where: { userId_ruleId: { userId: DEFAULT_USER_ID, ruleId } },
      data: { enabled: newEnabled },
    });

    return mapDbRuleToFeedbackRule(updated);
  }

  async getAgentPerformance(agentId: string): Promise<AgentPerformanceSummary> {
    await ensureDefaultUser();
    const agentFeedback = await db.feedbackEvent.findMany({
      where: { userId: DEFAULT_USER_ID, sourceAgentId: agentId },
    });

    const metrics: Record<string, { values: number[]; baselines: number[] }> = {};
    for (const fb of agentFeedback) {
      if (!metrics[fb.metricType]) {
        metrics[fb.metricType] = { values: [], baselines: [] };
      }
      metrics[fb.metricType].values.push(fb.metricValue);
      metrics[fb.metricType].baselines.push(fb.baselineValue);
    }

    const metricsSummary: AgentPerformanceSummary["metrics"] = {} as any;
    const recommendations: string[] = [];

    for (const [metricType, data] of Object.entries(metrics)) {
      const avgValue = data.values.reduce((a, b) => a + b, 0) / data.values.length;
      const avgBaseline = data.baselines.reduce((a, b) => a + b, 0) / data.baselines.length;
      const improvement = avgValue - avgBaseline;

      metricsSummary[metricType as FeedbackMetricType] = {
        value: avgValue,
        baseline: avgBaseline,
        improvement,
      };

      if (improvement < -0.02) {
        recommendations.push(
          this.generateRecommendation(metricType as FeedbackMetricType, improvement)
        );
      }
    }

    const totalImprovement = Object.values(metricsSummary).reduce((sum, m) => sum + m.improvement, 0);
    const avgImprovement = Object.keys(metricsSummary).length > 0
      ? totalImprovement / Object.keys(metricsSummary).length
      : 0;

    return {
      agentId,
      agentName: AGENT_NAMES[agentId] || agentId,
      totalEvents: agentFeedback.length,
      avgImprovement,
      metrics: metricsSummary,
      recommendations,
    };
  }

  async getDashboardData(): Promise<FeedbackDashboardData> {
    await ensureDefaultUser();
    const agentIds = ["contenu", "qualif", "prospection", "engagement", "veille", "nurturing", "analyse", "reseau"];
    const agentPerformances = await Promise.all(
      agentIds.map((id) => this.getAgentPerformance(id))
    );

    // Calculate overall health (0-100)
    const avgImprovement = agentPerformances.reduce((sum, a) => sum + a.avgImprovement, 0) / agentPerformances.length;
    const overallHealth = Math.max(0, Math.min(100, 50 + avgImprovement * 500));

    const topInsights = await this.getInsights(5);

    const recentEvents = await db.feedbackEvent.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const recentActions = recentEvents.map((fb) => ({
      agentId: fb.sourceAgentId,
      action: (fb.actionTaken || "none") as FeedbackAction,
      reason: fb.lesson || "",
      timestamp: fb.createdAt,
    }));

    return {
      overallHealth,
      agentPerformances,
      topInsights,
      recentActions,
    };
  }

  private calculatePriority(improvement: number, metricType: FeedbackMetricType): "high" | "medium" | "low" {
    const criticalMetrics: FeedbackMetricType[] = ["conversion_rate", "meeting_rate", "reply_rate"];

    if (criticalMetrics.includes(metricType) && improvement < -0.05) return "high";
    if (improvement < -0.03) return "high";
    if (improvement < -0.01) return "medium";
    return "low";
  }
}

// Singleton
export const feedbackEngine = new FeedbackEngine();
