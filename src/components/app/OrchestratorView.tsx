"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Radio,
  Shield,
  Activity,
  Play,
  Pause,
  Square,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ArrowRight,
} from "lucide-react";

type Tab = "orchestrateur" | "compliance" | "evenements";

interface OrchestratorData {
  state: string;
  metrics: {
    totalEventsProcessed: number;
    totalRulesFired: number;
    averageProcessingTimeMs: number;
    eventsByAgent: Record<string, number>;
    eventsByType: Record<string, number>;
    uptimeMs: number;
  };
  rules: Array<{
    id: string;
    agentId: string;
    name: string;
    trigger: { type: string; cron?: string; eventType?: string; afterEvent?: string; delayMs?: number };
    enabled: boolean;
    lastFiredAt?: string;
  }>;
  recentEvents: Array<{
    id: string;
    type: string;
    agentId: string;
    agentName: string;
    timestamp: string;
    data?: Record<string, unknown>;
  }>;
}

interface ComplianceData {
  status: {
    level: string;
    isWarmupActive: boolean;
    warmupDay: number;
    currentLimits: Record<string, number>;
    usage: {
      invitationsToday: number;
      messagesToday: number;
      commentsToday: number;
      likesToday: number;
      postsToday: number;
    };
    violations: Array<{
      type: string;
      category: string;
      message: string;
      current: number;
      limit: number;
    }>;
  };
  warmupInfo: {
    active: boolean;
    day: number;
    totalDays: number;
  };
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
  system: "#7B8A9A",
};

export default function OrchestratorView() {
  const [tab, setTab] = useState<Tab>("orchestrateur");
  const [orchData, setOrchData] = useState<OrchestratorData | null>(null);
  const [complianceData, setComplianceData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [orchRes, compRes] = await Promise.all([
        fetch("/api/data/orchestrator"),
        fetch("/api/data/compliance"),
      ]);
      if (orchRes.ok) setOrchData(await orchRes.json());
      if (compRes.ok) setComplianceData(await compRes.json());
    } catch (e) {
      console.error("Failed to fetch orchestrator data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  const getUsagePercent = (current: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min(100, Math.round((current / limit) * 100));
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return "#E5263A";
    if (percent >= 70) return "#F4A100";
    return "#00C48C";
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "orchestrateur", label: "Orchestrateur", icon: Radio },
    { id: "compliance", label: "Compliance", icon: Shield },
    { id: "evenements", label: "Événements", icon: Activity },
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Orchestrateur</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">
            Coordination des agents et compliance LinkedIn
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
            orchData?.state === "running"
              ? "bg-[#00C48C]/10 border-[#00C48C]/20 text-[#00C48C]"
              : orchData?.state === "paused"
              ? "bg-[#F4A100]/10 border-[#F4A100]/20 text-[#F4A100]"
              : "bg-[#7B8A9A]/10 border-[#7B8A9A]/20 text-[#7B8A9A]"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              orchData?.state === "running" ? "bg-[#00C48C]" : orchData?.state === "paused" ? "bg-[#F4A100]" : "bg-[#7B8A9A]"
            }`} />
            {orchData?.state === "running" ? "Actif" : orchData?.state === "paused" ? "En pause" : "Arrêté"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0F1520] p-1 rounded-lg border border-white/[0.06]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
              tab === t.id
                ? "bg-[#00D4FF]/10 text-[#00D4FF]"
                : "text-[#7B8A9A] hover:text-[#F0F4F8]"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "orchestrateur" && orchData && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
              <div className="text-[11px] text-[#7B8A9A] uppercase tracking-wide">Événements traités</div>
              <div className="text-xl font-semibold text-[#F0F4F8] mt-1">{orchData.metrics.totalEventsProcessed}</div>
            </div>
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
              <div className="text-[11px] text-[#7B8A9A] uppercase tracking-wide">Règles déclenchées</div>
              <div className="text-xl font-semibold text-[#F0F4F8] mt-1">{orchData.metrics.totalRulesFired}</div>
            </div>
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
              <div className="text-[11px] text-[#7B8A9A] uppercase tracking-wide">Temps moyen</div>
              <div className="text-xl font-semibold text-[#F0F4F8] mt-1">{orchData.metrics.averageProcessingTimeMs.toFixed(1)}ms</div>
            </div>
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
              <div className="text-[11px] text-[#7B8A9A] uppercase tracking-wide">Uptime</div>
              <div className="text-xl font-semibold text-[#F0F4F8] mt-1">{formatUptime(orchData.metrics.uptimeMs)}</div>
            </div>
          </div>

          {/* Agent Activity */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Activité par agent</h3>
            <div className="space-y-2">
              {Object.entries(orchData.metrics.eventsByAgent).map(([agent, count]) => (
                <div key={agent} className="flex items-center gap-3">
                  <div className="w-24 text-[12px] text-[#7B8A9A]">{agent}</div>
                  <div className="flex-1 h-2 bg-[#18212F] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (count / Math.max(1, orchData.metrics.totalEventsProcessed)) * 100 * 3)}%`,
                        backgroundColor: AGENT_COLORS[agent] || "#7B8A9A",
                      }}
                    />
                  </div>
                  <div className="text-[12px] text-[#F0F4F8] w-8 text-right">{count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rules */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Règles de heartbeat</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {orchData.rules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02]">
                  <button
                    className={`cursor-pointer ${rule.enabled ? "text-[#00C48C]" : "text-[#7B8A9A]"}`}
                    onClick={() => {
                      // Toggle rule via API would go here
                    }}
                  >
                    {rule.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#F0F4F8] truncate">{rule.name}</div>
                    <div className="text-[11px] text-[#7B8A9A] flex items-center gap-1">
                      <span style={{ color: AGENT_COLORS[rule.agentId] }}>{rule.agentId}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span>{rule.trigger.type === "schedule" ? rule.trigger.cron : rule.trigger.type}</span>
                    </div>
                  </div>
                  {rule.lastFiredAt && (
                    <div className="text-[10px] text-[#7B8A9A] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(rule.lastFiredAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "compliance" && complianceData && (
        <div className="space-y-4">
          {/* Warmup Status */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#F0F4F8]">Période de warmup</h3>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                complianceData.warmupInfo.active
                  ? "bg-[#00C48C]/10 text-[#00C48C]"
                  : "bg-[#7B8A9A]/10 text-[#7B8A9A]"
              }`}>
                {complianceData.warmupInfo.active ? `Jour ${complianceData.warmupInfo.day}/14` : "Inactif"}
              </span>
            </div>
            {complianceData.warmupInfo.active && (
              <div className="w-full h-2 bg-[#18212F] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00C48C] rounded-full transition-all"
                  style={{ width: `${(complianceData.warmupInfo.day / 14) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Usage */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Utilisation quotidienne</h3>
            <div className="space-y-3">
              {[
                { label: "Invitations", current: complianceData.status.usage.invitationsToday, limit: complianceData.status.currentLimits.dailyInvitations || 15 },
                { label: "Messages", current: complianceData.status.usage.messagesToday, limit: complianceData.status.currentLimits.dailyMessages || 25 },
                { label: "Commentaires", current: complianceData.status.usage.commentsToday, limit: complianceData.status.currentLimits.dailyComments || 12 },
                { label: "Likes", current: complianceData.status.usage.likesToday, limit: complianceData.status.currentLimits.dailyLikes || 30 },
                { label: "Posts", current: complianceData.status.usage.postsToday, limit: complianceData.status.currentLimits.dailyPosts || 2 },
              ].map((item) => {
                const pct = getUsagePercent(item.current, item.limit);
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="text-[#7B8A9A]">{item.label}</span>
                      <span className="text-[#F0F4F8]">{item.current}/{item.limit}</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#18212F] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: getUsageColor(pct),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Violations */}
          {complianceData.status.violations.length > 0 && (
            <div className="bg-[#0F1520] border border-[#F4A100]/20 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-[#F4A100] flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" />
                Violations récentes
              </h3>
              <div className="space-y-2">
                {complianceData.status.violations.map((v, i) => (
                  <div key={i} className="text-[12px] text-[#7B8A9A] p-2 bg-[#F4A100]/5 rounded-lg">
                    <span className="text-[#F4A100]">{v.category}</span>: {v.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Level */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Niveau de compliance</h3>
            <div className="flex gap-2">
              {(["strict", "moderate", "aggressive"] as const).map((level) => (
                <button
                  key={level}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-colors ${
                    complianceData.status.level === level
                      ? level === "strict"
                        ? "bg-[#00C48C]/10 text-[#00C48C] border border-[#00C48C]/20"
                        : level === "moderate"
                        ? "bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/20"
                        : "bg-[#F4A100]/10 text-[#F4A100] border border-[#F4A100]/20"
                      : "bg-[#18212F] text-[#7B8A9A] border border-white/[0.06]"
                  }`}
                >
                  {level === "strict" ? "Strict" : level === "moderate" ? "Modéré" : "Agressif"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "evenements" && orchData && (
        <div className="space-y-4">
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#F0F4F8]">Flux d'événements</h3>
              <button
                onClick={fetchData}
                className="text-[#7B8A9A] hover:text-[#00D4FF] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {orchData.recentEvents.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-[#7B8A9A]">
                  Aucun événement récent
                </div>
              ) : (
                orchData.recentEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.02]">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: AGENT_COLORS[event.agentId] || "#7B8A9A" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-[#F0F4F8]">{event.type}</div>
                      <div className="text-[11px] text-[#7B8A9A]">
                        {event.agentName} · {new Date(event.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </div>
                    </div>
                    <Zap className="w-3 h-3 text-[#7B8A9A] flex-shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
