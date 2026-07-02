"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  FlaskConical,
  Heart,
  TrendingUp,
  DollarSign,
  Users,
  Mail,
  Calendar,
  Plus,
  Play,
  Pause,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { toast } from "@/lib/toast";

type Tab = "roi" | "ab-testing" | "feedback" | "leads";

interface ROIData {
  totalCost: number;
  wonValue: number;
  totalPipelineValue: number;
  weightedPipeline: number;
  roi: number;
  costPerQualifiedLead: number;
  costPerMeeting: number;
  dealsCount: { active: number; won: number; lost: number };
  metrics: {
    postsPublished: number;
    leadsQualifies: number;
    messagesEnvoyes: number;
    rdvsGeneres: number;
    tauxReponse: number;
  } | null;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  targetAgentId?: string;
  variants: any[];
  trafficSplit: string;
  startDate?: string;
  endDate?: string;
  winnerId?: string;
  confidence: number;
  createdAt: string;
}

interface FeedbackData {
  dashboard: {
    overallHealth: number;
    agentPerformances: Array<{
      agentId: string;
      agentName: string;
      totalEvents: number;
      avgImprovement: number;
      recommendations: string[];
    }>;
    topInsights: Array<{
      agentId: string;
      agentName: string;
      metric: string;
      currentValue: number;
      baselineValue: number;
      improvement: number;
      recommendation: string;
      action: string;
      priority: string;
    }>;
  };
  rules: Array<{
    id: string;
    name: string;
    metricType: string;
    condition: string;
    threshold: number;
    action: string;
    message: string;
    enabled: boolean;
  }>;
}

const AGENT_COLORS: Record<string, string> = {
  contenu: "#00D4FF",
  qualif: "#A78BFA",
  prospection: "#00C48C",
  engagement: "#F4A100",
  veille: "#7B8A9A",
  nurturing: "#FF6B8A",
  analyse: "#4ADE80",
  reseau: "#60A5FA",
};

export default function AnalyticsView() {
  const [tab, setTab] = useState<Tab>("roi");
  const [roiData, setRoiData] = useState<ROIData | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateExp, setShowCreateExp] = useState(false);
  const [newExp, setNewExp] = useState({ name: "", description: "", targetAgentId: "", type: "ab" });

  const fetchData = useCallback(async () => {
    try {
      const [roiRes, expRes, fbRes] = await Promise.all([
        fetch("/api/data/roi"),
        fetch("/api/data/experiments"),
        fetch("/api/data/feedback"),
      ]);
      if (roiRes.ok) setRoiData(await roiRes.json());
      if (expRes.ok) setExperiments(await expRes.json());
      if (fbRes.ok) setFeedbackData(await fbRes.json());
    } catch (e) {
      console.error("Failed to fetch analytics data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createExperiment = async () => {
    if (!newExp.name) return;
    try {
      const res = await fetch("/api/data/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newExp,
          variants: [
            { id: "control", name: "Contrôle", description: "Version actuelle", config: {}, trafficPercent: 50 },
            { id: "variant-a", name: "Variante A", description: "Nouvelle version", config: {}, trafficPercent: 50 },
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? `Erreur ${res.status}`);
      }
      setNewExp({ name: "", description: "", targetAgentId: "", type: "ab" });
      setShowCreateExp(false);
      fetchData();
      toast.success("Expérience créée", { description: newExp.name });
    } catch (err) {
      toast.error("Échec de la création de l'expérience", {
        description: err instanceof Error ? err.message : "Erreur réseau",
      });
    }
  };

  const getHealthColor = (health: number) => {
    if (health >= 80) return "#00C48C";
    if (health >= 50) return "#F4A100";
    return "#E5263A";
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-[#7B8A9A]/10 text-[#7B8A9A] border-[#7B8A9A]/20",
      running: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]/20",
      paused: "bg-[#F4A100]/10 text-[#F4A100] border-[#F4A100]/20",
      completed: "bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20",
    };
    const labels: Record<string, string> = {
      draft: "Brouillon",
      running: "En cours",
      paused: "En pause",
      completed: "Terminé",
    };
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "roi", label: "ROI", icon: BarChart3 },
    { id: "ab-testing", label: "A/B Testing", icon: FlaskConical },
    { id: "feedback", label: "Feedback Loop", icon: Heart },
    { id: "leads", label: "Lead Trends", icon: TrendingUp },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-[#00D4FF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Analytics & ROI</h1>
        <p className="text-sm text-[#7B8A9A] mt-1">Performance, expérimentations et boucle de feedback</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0F1520] p-1 rounded-lg border border-white/[0.06]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
              tab === t.id ? "bg-[#00D4FF]/10 text-[#00D4FF]" : "text-[#7B8A9A] hover:text-[#F0F4F8]"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ROI Tab */}
      {tab === "roi" && roiData && (
        <div className="space-y-4">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[11px] text-[#7B8A9A] uppercase tracking-wide">
                <DollarSign className="w-3.5 h-3.5" />
                Coût total
              </div>
              <div className="text-xl font-semibold text-[#F0F4F8] mt-1">{roiData.totalCost.toFixed(2)}€</div>
            </div>
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[11px] text-[#7B8A9A] uppercase tracking-wide">
                <Trophy className="w-3.5 h-3.5" />
                Revenus gagnés
              </div>
              <div className="text-xl font-semibold text-[#00C48C] mt-1">{roiData.wonValue.toFixed(0)}€</div>
            </div>
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[11px] text-[#7B8A9A] uppercase tracking-wide">
                <TrendingUp className="w-3.5 h-3.5" />
                ROI
              </div>
              <div className={`text-xl font-semibold mt-1 flex items-center gap-1 ${roiData.roi >= 0 ? "text-[#00C48C]" : "text-[#E5263A]"}`}>
                {roiData.roi >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {roiData.roi.toFixed(1)}%
              </div>
            </div>
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[11px] text-[#7B8A9A] uppercase tracking-wide">
                <Users className="w-3.5 h-3.5" />
                Pipeline estimé
              </div>
              <div className="text-xl font-semibold text-[#00D4FF] mt-1">{roiData.weightedPipeline.toFixed(0)}€</div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Coût par lead qualifié</h3>
              <div className="text-3xl font-bold text-[#00D4FF]">{roiData.costPerQualifiedLead.toFixed(2)}€</div>
              <div className="text-[12px] text-[#7B8A9A] mt-1">
                {roiData.metrics?.leadsQualifies || 0} leads qualifiés
              </div>
            </div>
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Coût par rendez-vous</h3>
              <div className="text-3xl font-bold text-[#A78BFA]">{roiData.costPerMeeting.toFixed(2)}€</div>
              <div className="text-[12px] text-[#7B8A9A] mt-1">
                {roiData.metrics?.rdvsGeneres || 0} RDV générés
              </div>
            </div>
          </div>

          {/* Metrics Summary */}
          {roiData.metrics && (
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Métriques clés</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Posts", value: roiData.metrics.postsPublished, icon: "📝" },
                  { label: "Leads", value: roiData.metrics.leadsQualifies, icon: "🎯" },
                  { label: "Messages", value: roiData.metrics.messagesEnvoyes, icon: "✉️" },
                  { label: "RDV", value: roiData.metrics.rdvsGeneres, icon: "📅" },
                  { label: "Taux rép.", value: `${roiData.metrics.tauxReponse}%`, icon: "💬" },
                ].map((m) => (
                  <div key={m.label} className="text-center">
                    <div className="text-lg">{m.icon}</div>
                    <div className="text-lg font-semibold text-[#F0F4F8]">{m.value}</div>
                    <div className="text-[11px] text-[#7B8A9A]">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deals Summary */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Pipeline deals</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#00D4FF]" />
                <span className="text-[12px] text-[#7B8A9A]">Actifs: <span className="text-[#F0F4F8]">{roiData.dealsCount.active}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#00C48C]" />
                <span className="text-[12px] text-[#7B8A9A]">Gagnés: <span className="text-[#F0F4F8]">{roiData.dealsCount.won}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#E5263A]" />
                <span className="text-[12px] text-[#7B8A9A]">Perdus: <span className="text-[#F0F4F8]">{roiData.dealsCount.lost}</span></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A/B Testing Tab */}
      {tab === "ab-testing" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#F0F4F8]">Expériences</h3>
            <button
              onClick={() => setShowCreateExp(!showCreateExp)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-3 py-1.5 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouvelle expérience
            </button>
          </div>

          {/* Create Experiment Dialog */}
          {showCreateExp && (
            <div className="bg-[#0F1520] border border-[#00D4FF]/20 rounded-xl p-5 space-y-4">
              <h4 className="text-sm font-semibold text-[#F0F4F8]">Nouvelle expérience A/B</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={newExp.name}
                  onChange={(e) => setNewExp({ ...newExp, name: e.target.value })}
                  placeholder="Nom de l'expérience *"
                  className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
                />
                <select
                  value={newExp.targetAgentId}
                  onChange={(e) => setNewExp({ ...newExp, targetAgentId: e.target.value })}
                  className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30"
                >
                  <option value="">Agent cible (optionnel)</option>
                  <option value="contenu">Agent Contenu</option>
                  <option value="prospection">Agent Prospection</option>
                  <option value="engagement">Agent Engagement</option>
                  <option value="nurturing">Agent Nurturing</option>
                </select>
              </div>
              <textarea
                value={newExp.description}
                onChange={(e) => setNewExp({ ...newExp, description: e.target.value })}
                placeholder="Description de l'expérience"
                rows={2}
                className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={createExperiment}
                  className="text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-4 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer"
                >
                  Créer
                </button>
                <button
                  onClick={() => setShowCreateExp(false)}
                  className="text-[13px] font-medium text-[#7B8A9A] bg-[#18212F] px-4 py-2 rounded-lg hover:text-[#F0F4F8] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Experiments List */}
          {experiments.length === 0 ? (
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-8 text-center">
              <FlaskConical className="w-8 h-8 text-[#7B8A9A] mx-auto mb-2" />
              <p className="text-[13px] text-[#7B8A9A]">Aucune expérience créée</p>
              <p className="text-[11px] text-[#7B8A9A]/60 mt-1">Créez votre première expérience A/B pour optimiser vos agents</p>
            </div>
          ) : (
            <div className="space-y-3">
              {experiments.map((exp) => {
                const variants: Array<{ id: string; name: string; trafficPercent: number }> = exp.variants || [];
                return (
                  <div key={exp.id} className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-[14px] font-medium text-[#F0F4F8]">{exp.name}</div>
                        {exp.description && <div className="text-[12px] text-[#7B8A9A] mt-0.5">{exp.description}</div>}
                      </div>
                      {getStatusBadge(exp.status)}
                    </div>

                    {/* Variants */}
                    <div className="grid grid-cols-2 gap-2">
                      {variants.map((v) => (
                        <div
                          key={v.id}
                          className={`p-3 rounded-lg border ${
                            exp.winnerId === v.id
                              ? "bg-[#00C48C]/5 border-[#00C48C]/20"
                              : "bg-[#18212F] border-white/[0.06]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-medium text-[#F0F4F8]">{v.name}</span>
                            {exp.winnerId === v.id && <Trophy className="w-3.5 h-3.5 text-[#00C48C]" />}
                          </div>
                          <div className="text-[11px] text-[#7B8A9A] mt-0.5">{v.trafficPercent}% du trafic</div>
                        </div>
                      ))}
                    </div>

                    {/* Confidence */}
                    {exp.confidence > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#18212F] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00D4FF] rounded-full"
                            style={{ width: `${Math.min(100, exp.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-[#7B8A9A]">{(exp.confidence * 100).toFixed(1)}% confiance</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Feedback Tab */}
      {tab === "feedback" && feedbackData && (
        <div className="space-y-4">
          {/* Health Gauge */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#F0F4F8]">Santé globale du système</h3>
              <span
                className="text-2xl font-bold"
                style={{ color: getHealthColor(feedbackData.dashboard.overallHealth) }}
              >
                {feedbackData.dashboard.overallHealth.toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-3 bg-[#18212F] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${feedbackData.dashboard.overallHealth}%`,
                  backgroundColor: getHealthColor(feedbackData.dashboard.overallHealth),
                }}
              />
            </div>
          </div>

          {/* Agent Performance Grid */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Performance des agents</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {feedbackData.dashboard.agentPerformances.map((agent) => (
                <div
                  key={agent.agentId}
                  className="p-3 rounded-lg border border-white/[0.06] bg-[#18212F]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: AGENT_COLORS[agent.agentId] || "#7B8A9A" }}
                    />
                    <span className="text-[12px] font-medium text-[#F0F4F8]">{agent.agentName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {agent.avgImprovement >= 0 ? (
                      <ArrowUpRight className="w-3 h-3 text-[#00C48C]" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-[#E5263A]" />
                    )}
                    <span className={`text-[13px] font-semibold ${agent.avgImprovement >= 0 ? "text-[#00C48C]" : "text-[#E5263A]"}`}>
                      {(agent.avgImprovement * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-[10px] text-[#7B8A9A] mt-0.5">{agent.totalEvents} événements</div>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Insights récents</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {feedbackData.dashboard.topInsights.length === 0 ? (
                <div className="text-center py-4 text-[13px] text-[#7B8A9A]">
                  Aucun insight pour le moment
                </div>
              ) : (
                feedbackData.dashboard.topInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#18212F]">
                    {insight.priority === "high" ? (
                      <AlertTriangle className="w-4 h-4 text-[#E5263A] flex-shrink-0 mt-0.5" />
                    ) : insight.improvement >= 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-[#00C48C] flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-[#F4A100] flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-[#F0F4F8]">
                        <span style={{ color: AGENT_COLORS[insight.agentId] || "#7B8A9A" }}>{insight.agentName}</span>
                        {" · "}
                        {insight.metric.replace(/_/g, " ")}
                      </div>
                      <div className="text-[11px] text-[#7B8A9A] mt-0.5">{insight.recommendation}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Rules */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Règles de feedback</h3>
            <div className="space-y-2">
              {feedbackData.rules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02]">
                  <div className={`w-2 h-2 rounded-full ${rule.enabled ? "bg-[#00C48C]" : "bg-[#7B8A9A]"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-[#F0F4F8]">{rule.name}</div>
                    <div className="text-[11px] text-[#7B8A9A]">
                      {rule.metricType.replace(/_/g, " ")} {rule.condition === "below" ? "<" : ">"} {(rule.threshold * 100).toFixed(0)}%
                    </div>
                  </div>
                  <span className="text-[10px] text-[#7B8A9A]">{rule.action.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lead Trends Tab — Phase 6.4 */}
      {tab === "leads" && (
        <LeadTrendsTab />
      )}
    </div>
  );
}

/**
 * Phase 6.4 — LeadTrendsTab
 *
 * Visualizes the /api/data/analytics endpoint with 6 chart blocks:
 *   1. Score distribution histogram (5 buckets)
 *   2. Source breakdown (horizontal bars)
 *   3. Weekly acquisition trend (12 weeks line chart)
 *   4. Conversion funnel (5 stages)
 *   5. Engagement trend (8 weeks — likes + comments)
 *   6. Top performing posts (table)
 *
 * All charts are pure CSS/SVG (no chart library dependency), keeping the
 * bundle lean and the visuals on-brand.
 */
function LeadTrendsTab() {
  const [data, setData] = useState<LeadTrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/data/analytics");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          toast.error("Échec du chargement des analytics", {
            description: err instanceof Error ? err.message : "Erreur inconnue",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-[#00D4FF] animate-spin" />
      </div>
    );
  }

  const maxScoreCount = Math.max(...data.scoreDistribution.map((b) => b.count), 1);
  const maxSourceCount = Math.max(...data.sourceBreakdown.map((b) => b.count), 1);
  const maxWeeklyCount = Math.max(...data.weeklyAcquisition.map((w) => w.count), 1);
  const maxEngagement = Math.max(
    ...data.engagementTrend.map((w) => Math.max(w.likes, w.comments)),
    1,
  );
  const funnelMax = data.funnel.contacts || 1;
  const SOURCE_LABELS: Record<string, string> = {
    manual: "Manuel",
    profile_visitor: "Visiteur profil",
    reactor: "Réacteur",
    linkedin: "LinkedIn",
    email: "Email",
    referral: "Référence",
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total contacts" value={data.summary.totalContacts} accent="text-[#00D4FF]" />
        <SummaryCard label="Score moyen" value={data.summary.avgScore} accent="text-emerald-400" />
        <SummaryCard label="Qualifiés (60+)" value={data.summary.qualifiedContacts} accent="text-yellow-400" />
        <SummaryCard label="Hot leads (80+)" value={data.summary.hotContacts} accent="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Score distribution */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#F0F4F8] mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#00D4FF]" />
            Distribution des scores
          </h3>
          <div className="space-y-3">
            {data.scoreDistribution.map((bucket) => (
              <div key={bucket.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[#7B8A9A]">{bucket.label}</span>
                  <span className="text-[#F0F4F8] font-medium">{bucket.count}</span>
                </div>
                <div className="h-2 bg-[#1F2937] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00D4FF] to-[#00C48C] rounded-full transition-all"
                    style={{ width: `${(bucket.count / maxScoreCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source breakdown */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#F0F4F8] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#00D4FF]" />
            Sources des contacts
          </h3>
          {data.sourceBreakdown.length === 0 ? (
            <p className="text-xs text-[#7B8A9A] text-center py-8">Aucune donnée</p>
          ) : (
            <div className="space-y-2">
              {data.sourceBreakdown.map((src) => (
                <div key={src.source} className="flex items-center gap-3">
                  <span className="text-xs text-[#7B8A9A] w-28 flex-shrink-0">
                    {SOURCE_LABELS[src.source] ?? src.source}
                  </span>
                  <div className="flex-1 h-2 bg-[#1F2937] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00D4FF] rounded-full"
                      style={{ width: `${(src.count / maxSourceCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#F0F4F8] w-8 text-right">{src.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly acquisition trend */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#F0F4F8] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#00D4FF]" />
            Acquisition hebdomadaire (12 sem)
          </h3>
          {maxWeeklyCount === 0 ? (
            <p className="text-xs text-[#7B8A9A] text-center py-8">Aucune acquisition récente</p>
          ) : (
            <svg viewBox="0 0 320 120" className="w-full h-32">
              <polyline
                points={data.weeklyAcquisition
                  .map((w, i) => {
                    const x = (i / (data.weeklyAcquisition.length - 1)) * 300 + 10;
                    const y = 110 - (w.count / maxWeeklyCount) * 90;
                    return `${x},${y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="#00D4FF"
                strokeWidth="2"
              />
              {data.weeklyAcquisition.map((w, i) => {
                const x = (i / (data.weeklyAcquisition.length - 1)) * 300 + 10;
                const y = 110 - (w.count / maxWeeklyCount) * 90;
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r="3" fill="#00D4FF" />
                    {w.count > 0 && (
                      <text x={x} y={y - 8} textAnchor="middle" className="fill-[#F0F4F8]" fontSize="9">
                        {w.count}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Conversion funnel */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#F0F4F8] mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#00D4FF]" />
            Entonnoir de conversion
          </h3>
          <div className="space-y-2">
            {[
              { label: "Contacts", value: data.funnel.contacts, color: "#00D4FF" },
              { label: "Leads", value: data.funnel.leads, color: "#00B8D9" },
              { label: "Contactés", value: data.funnel.contacted, color: "#00C48C" },
              { label: "Ont répondu", value: data.funnel.replied, color: "#F4A100" },
              { label: "RDV obtenus", value: data.funnel.booked, color: "#FF6B6B" },
              { label: "Gagnés", value: data.funnel.won, color: "#00FF88" },
            ].map((stage) => (
              <div key={stage.label} className="flex items-center gap-3">
                <span className="text-xs text-[#7B8A9A] w-24 flex-shrink-0">{stage.label}</span>
                <div className="flex-1 h-6 bg-[#1F2937] rounded-md overflow-hidden relative">
                  <div
                    className="h-full rounded-md flex items-center px-2"
                    style={{
                      width: `${(stage.value / funnelMax) * 100}%`,
                      backgroundColor: stage.color,
                      minWidth: stage.value > 0 ? "32px" : "0",
                    }}
                  >
                    <span className="text-[10px] font-bold text-black">{stage.value}</span>
                  </div>
                </div>
                <span className="text-xs text-[#7B8A9A] w-12 text-right">
                  {data.funnel.contacts > 0 ? ((stage.value / data.funnel.contacts) * 100).toFixed(0) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Engagement trend (full width) */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[#F0F4F8] mb-4 flex items-center gap-2">
          <Heart className="w-4 h-4 text-[#00D4FF]" />
          Engagement capturé (8 sem) — likes & commentaires
        </h3>
        {maxEngagement === 0 ? (
          <p className="text-xs text-[#7B8A9A] text-center py-8">Aucun engagement capturé récemment</p>
        ) : (
          <svg viewBox="0 0 320 120" className="w-full h-32">
            {/* Comments line (yellow) */}
            <polyline
              points={data.engagementTrend
                .map((w, i) => {
                  const x = (i / (data.engagementTrend.length - 1)) * 300 + 10;
                  const y = 110 - (w.comments / maxEngagement) * 90;
                  return `${x},${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#F4A100"
              strokeWidth="2"
            />
            {/* Likes line (cyan) */}
            <polyline
              points={data.engagementTrend
                .map((w, i) => {
                  const x = (i / (data.engagementTrend.length - 1)) * 300 + 10;
                  const y = 110 - (w.likes / maxEngagement) * 90;
                  return `${x},${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#00D4FF"
              strokeWidth="2"
            />
            {data.engagementTrend.map((w, i) => {
              const x = (i / (data.engagementTrend.length - 1)) * 300 + 10;
              const yLikes = 110 - (w.likes / maxEngagement) * 90;
              const yComments = 110 - (w.comments / maxEngagement) * 90;
              return (
                <g key={i}>
                  <circle cx={x} cy={yLikes} r="3" fill="#00D4FF" />
                  <circle cx={x} cy={yComments} r="3" fill="#F4A100" />
                </g>
              );
            })}
          </svg>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#00D4FF]"></span>
            <span className="text-[#7B8A9A]">Likes</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#F4A100]"></span>
            <span className="text-[#7B8A9A]">Commentaires</span>
          </span>
        </div>
      </div>

      {/* Top performing posts */}
      {data.topPerformingPosts.length > 0 && (
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            Top 5 posts par engagement
          </h3>
          <div className="space-y-2">
            {data.topPerformingPosts.map((post, idx) => (
              <div key={post.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02]">
                <span className="text-xs font-bold text-[#7B8A9A] w-6">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#F0F4F8] truncate">
                    {post.contentType} · {post.agentId || "agent"}
                  </p>
                  <p className="text-[11px] text-[#7B8A9A]">
                    {post.likes} likes · {post.comments} commentaires · {post.impressions} impressions
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-400">
                  {(post.engagementRate * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface LeadTrendsData {
  scoreDistribution: { label: string; count: number }[];
  sourceBreakdown: { source: string; count: number }[];
  weeklyAcquisition: { weekStart: string; count: number }[];
  funnel: {
    contacts: number;
    leads: number;
    contacted: number;
    replied: number;
    booked: number;
    won: number;
  };
  engagementTrend: { weekStart: string; likes: number; comments: number }[];
  topPerformingPosts: {
    id: string;
    contentType: string;
    contentId: string;
    agentId: string;
    likes: number;
    comments: number;
    impressions: number;
    engagementRate: number;
    recordedAt: string;
  }[];
  summary: {
    totalContacts: number;
    avgScore: number;
    qualifiedContacts: number;
    hotContacts: number;
  };
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
      <p className="text-[11px] text-[#7B8A9A] uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}
