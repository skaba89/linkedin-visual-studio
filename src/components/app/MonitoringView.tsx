"use client";

import { useState } from "react";
import { useAppStore, type ActivityLog } from "@/store/appStore";
import { formatNumber } from "@/lib/format";
import {
  BarChart3,
  FileText,
  TrendingUp,
  Users,
  MessageSquare,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Trash2,
  Filter,
  Info,
  Circle,
} from "lucide-react";

const activityTypeColors: Record<ActivityLog["type"], string> = {
  info: "#00D4FF",
  success: "#00C48C",
  warning: "#F4A100",
  error: "#E5263A",
};

const activityTypeLabels: Record<ActivityLog["type"], string> = {
  info: "Info",
  success: "Succès",
  warning: "Alerte",
  error: "Erreur",
};

const activityTypeIcons: Record<ActivityLog["type"], React.ElementType> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

export default function MonitoringView() {
  const { metrics, agents, activityLogs, clearActivityLogs } = useAppStore();
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterType, setFilterType] = useState<ActivityLog["type"] | "all">("all");

  const benchmarks = [
    { label: "Posts publiés", value: metrics.postsPublished, target: "5/semaine", met: metrics.postsPublished >= 5 },
    { label: "Impressions moy.", value: formatNumber(metrics.impressionsMoy), target: "2 000+", met: metrics.impressionsMoy >= 2000 },
    { label: "Taux engagement", value: `${metrics.tauxEngagement}%`, target: "3%+", met: metrics.tauxEngagement >= 3 },
    { label: "Profils collectés", value: metrics.profilsCollectes.toString(), target: "—", met: true },
    { label: "Leads qualifiés", value: metrics.leadsQualifies.toString(), target: "20-40/sem", met: metrics.leadsQualifies >= 20 },
    { label: "Taux qualif.", value: `${Math.round((metrics.leadsQualifies / metrics.profilsCollectes) * 100)}%`, target: "15-25%", met: true },
    { label: "Messages envoyés", value: metrics.messagesEnvoyes.toString(), target: "—", met: true },
    { label: "Taux réponse", value: `${metrics.tauxReponse}%`, target: "20-35%", met: metrics.tauxReponse >= 20 },
    { label: "RDVs générés", value: metrics.rdvsGeneres.toString(), target: "8-12/sem", met: metrics.rdvsGeneres >= 8 },
  ];

  const complianceRules = [
    { label: "Messages limités à 30-50/jour", met: true },
    { label: "Uniquement connexions 1er degré", met: true },
    { label: "Mécanisme de désabonnement intégré", met: true },
    { label: "RGPD : suppression après 90 jours", met: false },
    { label: "Pas de contact sans interaction préalable", met: true },
    { label: "Pas de message commercial au 1er contact", met: true },
  ];

  // Filter activity logs
  const filteredLogs = activityLogs.filter((log) => {
    if (filterAgent !== "all" && log.agentId !== filterAgent) return false;
    if (filterType !== "all" && log.type !== filterType) return false;
    return true;
  });

  // Unique agent IDs from logs for filter
  const agentFilterOptions = [
    { id: "all", name: "Tous les agents" },
    { id: "system", name: "HERMÈS (système)" },
    ...agents.map((a) => ({ id: a.id, name: a.name })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Monitoring</h1>
        <p className="text-sm text-[#7B8A9A] mt-1">Suivez les métriques clés et la conformité LinkedIn en temps réel</p>
      </div>

      {/* Agent Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#7B8A9A] tracking-[1px]">{agent.num}</span>
              <div className={`w-2 h-2 rounded-full ${
                agent.status === "active" ? "bg-[#00C48C] animate-pulse" :
                agent.status === "paused" ? "bg-[#F4A100]" :
                agent.status === "error" ? "bg-[#E5263A]" : "bg-[#7B8A9A]"
              }`} />
            </div>
            <h3 className="text-sm font-semibold text-[#F0F4F8]">{agent.name}</h3>
            <p className="text-[11px] text-[#7B8A9A] mt-1">{agent.role}</p>
          </div>
        ))}
      </div>

      {/* Benchmarks Table */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Métriques vs Benchmarks</h3>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {benchmarks.map((b, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                {b.met ? (
                  <CheckCircle2 className="w-4 h-4 text-[#00C48C]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#F4A100]" />
                )}
                <span className="text-[13px] text-[#F0F4F8]">{b.label}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-medium text-[#F0F4F8]">{b.value}</span>
                <span className="text-[11px] text-[#7B8A9A]">/ {b.target}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns: Compliance + Weekly breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Compliance */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-[#00D4FF]" />
            <h3 className="text-sm font-semibold text-[#F0F4F8]">Conformité LinkedIn</h3>
          </div>
          <div className="space-y-2">
            {complianceRules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[13px]">
                {rule.met ? (
                  <CheckCircle2 className="w-4 h-4 text-[#00C48C] flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-[#E5263A] flex-shrink-0" />
                )}
                <span className={rule.met ? "text-[#7B8A9A]" : "text-[#E5263A]"}>{rule.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Data format reference */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Format data/qualified.json</h3>
          <pre className="bg-[#080C10] border border-white/[0.06] rounded-lg p-4 text-[12px] leading-relaxed text-[#F0F4F8] font-mono overflow-x-auto">
{`[
  {
    "id": "linkedin_abc123",
    "prenom": "Marie",
    "poste": "CMO",
    "entreprise": "Startup SaaS B2B",
    "score": 82,
    "action": "commented",
    "post_sujet": "automation LinkedIn",
    "statut": "new"
  }
]`}
          </pre>
          <p className="text-[11px] text-[#7B8A9A] mt-2">
            Le statut progresse : new → contacted → replied → booked
          </p>
        </div>
      </div>

      {/* Journal d'activité */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#00D4FF]" />
              <h3 className="text-sm font-semibold text-[#F0F4F8]">Journal d&apos;activité</h3>
              {activityLogs.length > 0 && (
                <span className="text-[11px] text-[#7B8A9A] bg-[#18212F] px-2 py-0.5 rounded-full">
                  {activityLogs.length} entrée{activityLogs.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Agent filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-[#7B8A9A]" />
                <select
                  value={filterAgent}
                  onChange={(e) => setFilterAgent(e.target.value)}
                  className="bg-[#18212F] border border-white/[0.06] text-[12px] text-[#F0F4F8] rounded-lg px-2 py-1 focus:outline-none focus:border-[#00D4FF]/30 cursor-pointer"
                >
                  {agentFilterOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>

              {/* Type filter */}
              <div className="flex items-center gap-1 bg-[#18212F] border border-white/[0.06] rounded-lg p-0.5">
                <button
                  onClick={() => setFilterType("all")}
                  className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer ${
                    filterType === "all" ? "bg-[#00D4FF]/15 text-[#00D4FF]" : "text-[#7B8A9A] hover:text-[#F0F4F8]"
                  }`}
                >
                  Tout
                </button>
                {(["info", "success", "warning", "error"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer ${
                      filterType === type
                        ? "text-white"
                        : "text-[#7B8A9A] hover:text-[#F0F4F8]"
                    }`}
                    style={filterType === type ? { backgroundColor: `${activityTypeColors[type]}22`, color: activityTypeColors[type] } : {}}
                  >
                    {activityTypeLabels[type]}
                  </button>
                ))}
              </div>

              {/* Clear logs */}
              <button
                onClick={clearActivityLogs}
                className="flex items-center gap-1 text-[11px] text-[#7B8A9A] hover:text-[#E5263A] bg-[#18212F] border border-white/[0.04] rounded-lg px-2 py-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Effacer le journal
              </button>
            </div>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <Circle className="w-10 h-10 text-[#7B8A9A]/20 mx-auto mb-3" />
            <p className="text-[13px] text-[#7B8A9A]">Aucune activité enregistrée</p>
            <p className="text-[11px] text-[#7B8A9A]/60 mt-1">
              Les actions des agents apparaîtront ici automatiquement
            </p>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
            <div className="divide-y divide-white/[0.03]">
              {filteredLogs.map((log) => {
                const time = new Date(log.timestamp);
                const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}`;
                const dateStr = `${time.getDate().toString().padStart(2, "0")}/${(time.getMonth() + 1).toString().padStart(2, "0")}/${time.getFullYear()}`;
                const typeColor = activityTypeColors[log.type];
                const TypeIcon = activityTypeIcons[log.type];

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Type icon */}
                    <TypeIcon
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      style={{ color: typeColor }}
                    />

                    {/* Timestamp */}
                    <div className="flex-shrink-0 text-right" style={{ minWidth: "90px" }}>
                      <div className="font-mono text-[11px] text-[#7B8A9A]">{dateStr}</div>
                      <div className="font-mono text-[11px] text-[#F0F4F8]/60">{timeStr}</div>
                    </div>

                    {/* Agent badge */}
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                      style={{
                        color: typeColor,
                        backgroundColor: `${typeColor}11`,
                        border: `1px solid ${typeColor}22`,
                      }}
                    >
                      {log.agentName}
                    </span>

                    {/* Type badge */}
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase flex-shrink-0 mt-0.5"
                      style={{
                        color: typeColor,
                        backgroundColor: `${typeColor}08`,
                      }}
                    >
                      {activityTypeLabels[log.type]}
                    </span>

                    {/* Message */}
                    <span className="text-[13px] text-[#F0F4F8] flex-1 min-w-0">{log.message}</span>

                    {/* Details */}
                    {log.details && (
                      <span className="text-[11px] text-[#7B8A9A] flex-shrink-0 max-w-[200px] truncate">{log.details}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
