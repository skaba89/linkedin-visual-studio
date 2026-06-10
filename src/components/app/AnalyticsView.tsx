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

type Tab = "roi" | "ab-testing" | "feedback";

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
  variants: string;
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
    await fetch("/api/data/experiments", {
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
    setNewExp({ name: "", description: "", targetAgentId: "", type: "ab" });
    setShowCreateExp(false);
    fetchData();
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
                const variants: Array<{ id: string; name: string; trafficPercent: number }> = JSON.parse(exp.variants || "[]");
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
    </div>
  );
}
