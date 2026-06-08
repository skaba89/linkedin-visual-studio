"use client";

import { useAppStore, type AgentStatus } from "@/store/appStore";
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
} from "lucide-react";

const statusConfig: Record<AgentStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Actif", color: "text-[#00C48C]", bg: "bg-[#00C48C]/10 border-[#00C48C]/20" },
  paused: { label: "En pause", color: "text-[#F4A100]", bg: "bg-[#F4A100]/10 border-[#F4A100]/20" },
  error: { label: "Erreur", color: "text-[#E5263A]", bg: "bg-[#E5263A]/10 border-[#E5263A]/20" },
  setup: { label: "À configurer", color: "text-[#7B8A9A]", bg: "bg-[#7B8A9A]/10 border-[#7B8A9A]/20" },
};

export default function DashboardView() {
  const { agents, metrics, leads, setCurrentView } = useAppStore();

  const newLeads = leads.filter((l) => l.statut === "new").length;
  const contactedLeads = leads.filter((l) => l.statut === "contacted").length;
  const repliedLeads = leads.filter((l) => l.statut === "replied").length;
  const bookedLeads = leads.filter((l) => l.statut === "booked").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Dashboard</h1>
        <p className="text-sm text-[#7B8A9A] mt-1">Vue d&apos;ensemble de votre système HERMÈS</p>
      </div>

      {/* Agent Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const status = statusConfig[agent.status];
          return (
            <div
              key={agent.id}
              className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5 hover:border-[#00D4FF]/15 transition-colors"
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
              <MetricRow label="Impressions moy." value={metrics.impressionsMoy.toLocaleString()} target="2 000+" />
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
