// HERMÈS Feedback Engine — Continuous improvement and agent optimization

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

// Default feedback rules
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

export class FeedbackEngine {
  private rules: FeedbackRule[] = [...DEFAULT_RULES];
  private feedbackHistory: Array<FeedbackEventData & { timestamp: Date; actionTaken: FeedbackAction; lesson?: string }> = [];

  recordFeedback(data: FeedbackEventData): FeedbackInsight {
    const improvement = data.metricValue - data.baselineValue;
    const rule = this.evaluateRules(data.metricType, data.metricValue);
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

    this.feedbackHistory.push({
      ...data,
      timestamp: new Date(),
      actionTaken: action,
      lesson: recommendation,
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

  evaluateRules(metricType: FeedbackMetricType, value: number): FeedbackRule | null {
    for (const rule of this.rules) {
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

  getInsights(limit: number = 10): FeedbackInsight[] {
    const recentFeedback = this.feedbackHistory.slice(-limit).reverse();

    return recentFeedback.map((fb) => ({
      agentId: fb.sourceAgentId,
      agentName: AGENT_NAMES[fb.sourceAgentId] || fb.sourceAgentId,
      metric: fb.metricType,
      currentValue: fb.metricValue,
      baselineValue: fb.baselineValue,
      improvement: fb.metricValue - fb.baselineValue,
      recommendation: fb.lesson || this.generateRecommendation(fb.metricType, fb.metricValue - fb.baselineValue),
      action: fb.actionTaken,
      priority: this.calculatePriority(fb.metricValue - fb.baselineValue, fb.metricType),
    }));
  }

  getRules(): FeedbackRule[] {
    return [...this.rules];
  }

  toggleRule(ruleId: string, enabled?: boolean): FeedbackRule | null {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) return null;
    rule.enabled = enabled ?? !rule.enabled;
    return rule;
  }

  getAgentPerformance(agentId: string): AgentPerformanceSummary {
    const agentFeedback = this.feedbackHistory.filter((fb) => fb.sourceAgentId === agentId);

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

  getDashboardData(): FeedbackDashboardData {
    const agentIds = ["contenu", "qualif", "prospection", "engagement", "veille", "nurturing", "analyse", "reseau"];
    const agentPerformances = agentIds.map((id) => this.getAgentPerformance(id));

    // Calculate overall health (0-100)
    const avgImprovement = agentPerformances.reduce((sum, a) => sum + a.avgImprovement, 0) / agentPerformances.length;
    const overallHealth = Math.max(0, Math.min(100, 50 + avgImprovement * 500));

    const topInsights = this.getInsights(5);

    const recentActions = this.feedbackHistory.slice(-10).reverse().map((fb) => ({
      agentId: fb.sourceAgentId,
      action: fb.actionTaken,
      reason: fb.lesson || "",
      timestamp: fb.timestamp,
    }));

    return {
      overallHealth,
      agentPerformances,
      topInsights,
      recentActions,
    };
  }

  loadFeedbackData(data: Array<FeedbackEventData & { timestamp: Date; actionTaken: FeedbackAction; lesson?: string }>): void {
    this.feedbackHistory = data;
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
