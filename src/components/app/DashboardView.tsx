"use client";

import { useAppStore, type AgentStatus, type ActivityLog } from "@/store/appStore";
import { formatNumber } from "@/lib/format";
import {
  Play,
  Pause,
  AlertCircle,
  Settings,
  ArrowUpRight,
  TrendingUp,
  FileText,
  Users,
  MessageSquare,
  CalendarCheck,
  Zap,
  FastForward,
  ChevronRight,
  Circle,
  Sparkles,
} from "lucide-react";

const statusConfig: Record<AgentStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Actif", color: "text-[#00C48C]", bg: "bg-[#00C48C]/10 border-[#00C48C]/20" },
  paused: { label: "En pause", color: "text-[#F4A100]", bg: "bg-[#F4A100]/10 border-[#F4A100]/20" },
  error: { label: "Erreur", color: "text-[#E5263A]", bg: "bg-[#E5263A]/10 border-[#E5263A]/20" },
  setup: { label: "À configurer", color: "text-[#7B8A9A]", bg: "bg-[#7B8A9A]/10 border-[#7B8A9A]/20" },
};

const activityTypeColors: Record<ActivityLog["type"], string> = {
  info: "#00D4FF",
  success: "#00C48C",
  warning: "#F4A100",
  error: "#E5263A",
};

export default function DashboardView() {
  const { agents, metrics, leads, setCurrentView, isSimulating, setIsSimulating, simulationSpeed, setSimulationSpeed, activityLogs, runAgentNow, generatedPosts, generatedMessages, executingAgent } = useAppStore();

  const newLeads = leads.filter((l) => l.statut === "new").length;
  const contactedLeads = leads.filter((l) => l.statut === "contacted").length;
  const repliedLeads = leads.filter((l) => l.statut === "replied").length;
  const bookedLeads = leads.filter((l) => l.statut === "booked").length;

  const activeAgentCount = agents.filter((a) => a.status === "active").length;
  const recentLogs = activityLogs.slice(0, 8);

  const handleRunAll = () => {
    agents.forEach((agent) => {
      if (agent.status === "active") {
        runAgentNow(agent.id);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Dashboard</h1>
        <p className="text-sm text-[#7B8A9A] mt-1">Vue d&apos;ensemble de votre système HERMÈS</p>
      </div>

      {/* Simulation Control Bar */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Play/Pause button */}
          {isSimulating ? (
            <button
              onClick={() => setIsSimulating(false)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#F4A100] bg-[#F4A100]/10 border border-[#F4A100]/20 px-3 py-1.5 rounded-lg hover:bg-[#F4A100]/15 transition-colors cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" /> Pause simulation
            </button>
          ) : (
            <button
              onClick={() => setIsSimulating(true)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20 px-3 py-1.5 rounded-lg hover:bg-[#00C48C]/15 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" /> Lancer la simulation
            </button>
          )}

          {/* Speed selector */}
          <div className="flex items-center gap-1 bg-[#18212F] border border-white/[0.04] rounded-lg p-0.5">
            {[1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => setSimulationSpeed(speed)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  simulationSpeed === speed
                    ? "bg-[#00D4FF]/15 text-[#00D4FF]"
                    : "text-[#7B8A9A] hover:text-[#F0F4F8]"
                }`}
              >
                x{speed}
              </button>
            ))}
          </div>

          {/* Run all agents */}
          <button
            onClick={handleRunAll}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-3 py-1.5 rounded-lg hover:bg-[#00D4FF]/15 transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" /> Run all agents
          </button>

          {/* Status indicator */}
          <div className="flex items-center gap-2 ml-auto text-[12px]">
            {isSimulating ? (
              <>
                <div className="w-2 h-2 rounded-full bg-[#00C48C] animate-pulse" />
                <span className="text-[#00C48C] font-medium">Simulation en cours</span>
                <span className="text-[#7B8A9A]">— {activeAgentCount} agent{activeAgentCount !== 1 ? "s" : ""} actif{activeAgentCount !== 1 ? "s" : ""}</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-[#7B8A9A]" />
                <span className="text-[#7B8A9A] font-medium">Simulation arrêtée</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Agent Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const status = statusConfig[agent.status];
          return (
            <div
              key={agent.id}
              className={`bg-[#0F1520] border border-white/[0.06] rounded-xl p-5 hover:border-[#00D4FF]/15 transition-colors ${
                agent.status === "active" ? "ring-1 ring-[#00C48C]/20" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[11px] text-[#00D4FF] tracking-[1px]">{agent.num}</span>
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                  {agent.status === "active" ? <Play className="w-2.5 h-2.5" /> :
                   agent.status === "paused" ? <Pause className="w-2.5 h-2.5" /> :
                   agent.status === "error" ? <AlertCircle className="w-2.5 h-2.5" /> :
                   <Settings className="w-2.5 h-2.5" />}
                  {status.label}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-[#F0F4F8] mb-1">{agent.name}</h3>
              <p className="text-xs text-[#7B8A9A] mb-4">{agent.role}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#7B8A9A]">
                  {agent.lastRun ? `Dernier run : ${agent.lastRun}` : "Pas encore exécuté"}
                </span>
                {agent.nextRun && (
                  <span className="text-[#00D4FF]">
                    Prochain : {agent.nextRun}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={FileText}
          label="Posts publiés"
          value={metrics.postsPublished.toString()}
          sub="/semaine"
          trend="+2"
        />
        <MetricCard
          icon={TrendingUp}
          label="Taux engagement"
          value={`${metrics.tauxEngagement}%`}
          sub="impressions moy."
          trend="+0.4%"
        />
        <MetricCard
          icon={Users}
          label="Leads qualifiés"
          value={metrics.leadsQualifies.toString()}
          sub={`+${newLeads} nouveaux`}
          trend="+8"
        />
        <MetricCard
          icon={CalendarCheck}
          label="RDVs générés"
          value={metrics.rdvsGeneres.toString()}
          sub="/semaine"
          trend="+3"
        />
      </div>

      {/* Two columns: Pipeline + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#F0F4F8] mb-4">Pipeline de prospection</h3>
          <div className="grid grid-cols-4 gap-3">
            <PipelineStep label="Nouveau" count={newLeads} color="#00D4FF" />
            <PipelineStep label="Contacté" count={contactedLeads} color="#F4A100" />
            <PipelineStep label="Répondu" count={repliedLeads} color="#A78BFA" />
            <PipelineStep label="RDV pris" count={bookedLeads} color="#00C48C" />
          </div>
          {/* Progress bar */}
          <div className="mt-4 flex h-2 rounded-full overflow-hidden bg-[#18212F]">
            {newLeads > 0 && <div className="bg-[#00D4FF]" style={{ width: `${(newLeads / leads.length) * 100}%` }} />}
            {contactedLeads > 0 && <div className="bg-[#F4A100]" style={{ width: `${(contactedLeads / leads.length) * 100}%` }} />}
            {repliedLeads > 0 && <div className="bg-[#A78BFA]" style={{ width: `${(repliedLeads / leads.length) * 100}%` }} />}
            {bookedLeads > 0 && <div className="bg-[#00C48C]" style={{ width: `${(bookedLeads / leads.length) * 100}%` }} />}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#F0F4F8] mb-4">Actions rapides</h3>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction label="Configurer Agent Contenu" onClick={() => setCurrentView("agent-contenu")} />
            <QuickAction label="Définir l'ICP" onClick={() => setCurrentView("icp")} />
            <QuickAction label="Voir les leads" onClick={() => setCurrentView("leads")} />
            <QuickAction label="Templates messages" onClick={() => setCurrentView("templates")} />
            <QuickAction label="Monitoring" onClick={() => setCurrentView("monitoring")} />
            <QuickAction label="Paramètres API" onClick={() => setCurrentView("settings")} />
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#F0F4F8] mb-4">Métriques détaillées</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Agent Contenu */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#00D4FF]" />
              <span className="text-xs font-semibold text-[#00D4FF] uppercase tracking-wide">Agent Contenu</span>
            </div>
            <div className="space-y-2">
              <MetricRow label="Posts publiés" value={`${metrics.postsPublished}/semaine`} target="5" />
              <MetricRow label="Impressions moy." value={formatNumber(metrics.impressionsMoy)} target="2 000+" />
              <MetricRow label="Taux engagement" value={`${metrics.tauxEngagement}%`} target="3%+" />
            </div>
          </div>
          {/* Agent Qualification */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#A78BFA]" />
              <span className="text-xs font-semibold text-[#A78BFA] uppercase tracking-wide">Agent Qualification</span>
            </div>
            <div className="space-y-2">
              <MetricRow label="Profils collectés" value={metrics.profilsCollectes.toString()} target="—"/>
              <MetricRow label="Leads qualifiés" value={metrics.leadsQualifies.toString()} target="20-40/sem" />
              <MetricRow label="Taux qualif." value={`${Math.round((metrics.leadsQualifies / metrics.profilsCollectes) * 100)}%`} target="15-25%" />
            </div>
          </div>
          {/* Agent Prospection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#00C48C]" />
              <span className="text-xs font-semibold text-[#00C48C] uppercase tracking-wide">Agent Prospection</span>
            </div>
            <div className="space-y-2">
              <MetricRow label="Messages envoyés" value={metrics.messagesEnvoyes.toString()} target="—" />
              <MetricRow label="Taux réponse" value={`${metrics.tauxReponse}%`} target="20-35%" />
              <MetricRow label="RDVs générés" value={metrics.rdvsGeneres.toString()} target="8-12/sem" />
            </div>
          </div>
        </div>
      </div>

      {/* Latest AI Output */}
      {(generatedPosts.length > 0 || generatedMessages.length > 0) && (
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00D4FF]" />
              <h3 className="text-sm font-semibold text-[#F0F4F8]">Dernières sorties IA</h3>
            </div>
          </div>
          <div className="space-y-3">
            {generatedPosts.slice(0, 1).map((post) => (
              <div key={post.id} className="bg-[#080C10] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-3.5 h-3.5 text-[#00D4FF]" />
                  <span className="text-[11px] font-medium text-[#00D4FF]">Post LinkedIn</span>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                    post.model === "simulation" ? "text-[#F4A100] bg-[#F4A100]/10" : "text-[#00C48C] bg-[#00C48C]/10"
                  }`}>{post.model === "simulation" ? "SIM" : "IA"}</span>
                </div>
                <p className="text-[12px] text-[#F0F4F8] line-clamp-3 leading-relaxed">{post.text}</p>
              </div>
            ))}
            {generatedMessages.slice(0, 2).map((msg) => (
              <div key={msg.id} className="bg-[#080C10] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-3.5 h-3.5 text-[#00C48C]" />
                  <span className="text-[11px] font-medium text-[#00C48C]">DM → {msg.leadName}</span>
                  <span className="text-[9px] font-medium text-[#7B8A9A]">{msg.leadEntreprise}</span>
                </div>
                <p className="text-[12px] text-[#F0F4F8] line-clamp-2 leading-relaxed">{msg.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Activity Feed */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isSimulating ? "bg-[#00C48C] animate-pulse" : "bg-[#7B8A9A]"}`} />
            <h3 className="text-sm font-semibold text-[#F0F4F8]">Activité en direct</h3>
            {activityLogs.length > 0 && (
              <span className="text-[11px] text-[#7B8A9A]">{activityLogs.length} entrée{activityLogs.length !== 1 ? "s" : ""}</span>
            )}
          </div>
          <button
            onClick={() => setCurrentView("monitoring")}
            className="flex items-center gap-1 text-[12px] text-[#00D4FF] hover:text-[#00D4FF]/80 transition-colors cursor-pointer"
          >
            Voir tout <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="text-center py-8">
            <Circle className="w-8 h-8 text-[#7B8A9A]/30 mx-auto mb-2" />
            <p className="text-[13px] text-[#7B8A9A]">Aucune activité pour le moment</p>
            <p className="text-[11px] text-[#7B8A9A]/60 mt-1">Lancez la simulation ou activez un agent pour commencer</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto custom-scrollbar">
            {recentLogs.map((log) => {
              const time = new Date(log.timestamp);
              const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}`;
              const typeColor = activityTypeColors[log.type];

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                >
                  {/* Color indicator */}
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: typeColor }}
                  />

                  {/* Time */}
                  <span className="font-mono text-[11px] text-[#7B8A9A] flex-shrink-0 mt-0.5">{timeStr}</span>

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

                  {/* Message */}
                  <span className="text-[13px] text-[#F0F4F8] flex-1 min-w-0">{log.message}</span>

                  {/* Details */}
                  {log.details && (
                    <span className="text-[11px] text-[#7B8A9A] flex-shrink-0">{log.details}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  trend: string;
}) {
  return (
    <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4 text-[#7B8A9A]" />
        <span className="text-[11px] font-medium text-[#00C48C] flex items-center gap-0.5">
          <ArrowUpRight className="w-3 h-3" />
          {trend}
        </span>
      </div>
      <div className="font-mono text-2xl font-medium text-[#F0F4F8] tracking-[-1px]">{value}</div>
      <div className="text-xs text-[#7B8A9A] mt-1">{label} <span className="text-[#7B8A9A]/60">· {sub}</span></div>
    </div>
  );
}

function PipelineStep({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-xl font-medium mb-1" style={{ color }}>{count}</div>
      <div className="text-[11px] text-[#7B8A9A]">{label}</div>
    </div>
  );
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left text-[13px] text-[#7B8A9A] bg-[#18212F] border border-white/[0.04] rounded-lg px-3 py-2.5 hover:text-[#F0F4F8] hover:border-[#00D4FF]/15 transition-all cursor-pointer"
    >
      {label}
    </button>
  );
}

function MetricRow({ label, value, target }: { label: string; value: string; target: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-[#7B8A9A]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[#F0F4F8] font-medium">{value}</span>
        <span className="text-[10px] text-[#7B8A9A]/60">/ {target}</span>
      </div>
    </div>
  );
}
