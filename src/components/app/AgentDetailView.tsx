"use client";

import { useState, useEffect } from "react";
import { useAppStore, type AgentStatus, type ActivityLog } from "@/store/appStore";
import {
  Play,
  Pause,
  RotateCcw,
  Save,
  Clock,
  FileCode,
  Activity,
  Zap,
  Circle,
} from "lucide-react";

const statusOptions: { value: AgentStatus; label: string; color: string }[] = [
  { value: "active", label: "Actif", color: "#00C48C" },
  { value: "paused", label: "En pause", color: "#F4A100" },
  { value: "setup", label: "À configurer", color: "#7B8A9A" },
  { value: "error", label: "Erreur", color: "#E5263A" },
];

const activityTypeColors: Record<ActivityLog["type"], string> = {
  info: "#00D4FF",
  success: "#00C48C",
  warning: "#F4A100",
  error: "#E5263A",
};

export default function AgentDetailView({ agentId }: { agentId: string }) {
  const { agents, updateAgent, runAgentNow, activityLogs } = useAppStore();
  const agent = agents.find((a) => a.id === agentId)!;
  const [activeTab, setActiveTab] = useState<"skill" | "heartbeat" | "info">("skill");
  const [skillText, setSkillText] = useState(agent.skillMd);
  const [heartbeatText, setHeartbeatText] = useState(agent.heartbeatMd);
  const [saved, setSaved] = useState(false);
  const [justRan, setJustRan] = useState(false);

  // Activity logs for this specific agent
  const agentLogs = activityLogs.filter((l) => l.agentId === agentId).slice(0, 3);

  // Reset justRan after animation
  useEffect(() => {
    if (justRan) {
      const timer = setTimeout(() => setJustRan(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [justRan]);

  const handleSave = () => {
    updateAgent(agentId, {
      skillMd: skillText,
      heartbeatMd: heartbeatText,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleStatusChange = (status: AgentStatus) => {
    updateAgent(agentId, { status });
  };

  const handleRunNow = () => {
    // Temporarily set agent to active so runAgentNow can process it
    if (agent.status !== "active") {
      updateAgent(agentId, { status: "active" });
    }
    runAgentNow(agentId);
    setJustRan(true);
  };

  const currentStatus = statusOptions.find((s) => s.value === agent.status)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-[11px] text-[#00D4FF] tracking-[1px]">{agent.num}</span>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
              style={{
                color: currentStatus.color,
                borderColor: `${currentStatus.color}33`,
                backgroundColor: `${currentStatus.color}11`,
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentStatus.color }} />
              {currentStatus.label}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">
            Agent {agent.name}
          </h1>
          <p className="text-sm text-[#7B8A9A] mt-1">{agent.role}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Run Now Button */}
          <button
            onClick={handleRunNow}
            className={`flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              justRan
                ? "text-[#00D4FF] bg-[#00D4FF]/15 border-2 border-[#00D4FF]/40 animate-pulse"
                : "text-[#F0F4F8] bg-[#00D4FF] hover:bg-[#00AACF] border-2 border-transparent"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            {justRan ? "En cours..." : "Lancer maintenant"}
          </button>

          {agent.status === "active" ? (
            <button
              onClick={() => handleStatusChange("paused")}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#F4A100] bg-[#F4A100]/10 border border-[#F4A100]/20 px-3 py-1.5 rounded-lg hover:bg-[#F4A100]/15 transition-colors cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
          ) : (
            <button
              onClick={() => handleStatusChange("active")}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20 px-3 py-1.5 rounded-lg hover:bg-[#00C48C]/15 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" /> Activer
            </button>
          )}
          <button
            onClick={() => handleStatusChange("setup")}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#7B8A9A] bg-[#18212F] border border-white/[0.06] px-3 py-1.5 rounded-lg hover:text-[#F0F4F8] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0F1520] border border-white/[0.06] rounded-lg p-1">
        {[
          { id: "skill" as const, label: "SKILL.md", icon: FileCode },
          { id: "heartbeat" as const, label: "HEARTBEAT.md", icon: Clock },
          { id: "info" as const, label: "Infos", icon: Activity },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 text-[13px] font-medium py-2 rounded-md transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-[#00D4FF]/10 text-[#00D4FF]"
                : "text-[#7B8A9A] hover:text-[#F0F4F8]"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "skill" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#7B8A9A]">
              Le fichier SKILL.md définit les tâches, les outils disponibles et les instructions de l&apos;agent.
            </p>
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                saved
                  ? "text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20"
                  : "text-[#F0F4F8] bg-[#00D4FF] hover:bg-[#00AACF]"
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              {saved ? "Sauvegardé !" : "Sauvegarder"}
            </button>
          </div>
          <div className="bg-[#080C10] border border-white/[0.06] rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
              </div>
              <span className="text-[11px] text-[#7B8A9A] font-mono">agents/{agentId}-bot/SKILL.md</span>
            </div>
            <textarea
              value={skillText}
              onChange={(e) => setSkillText(e.target.value)}
              className="w-full min-h-[400px] p-4 bg-transparent text-[13px] leading-relaxed text-[#F0F4F8] font-mono resize-y focus:outline-none"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {activeTab === "heartbeat" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#7B8A9A]">
              Le HEARTBEAT définit quand l&apos;agent se réveille et quelle tâche il exécute.
            </p>
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                saved
                  ? "text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20"
                  : "text-[#F0F4F8] bg-[#00D4FF] hover:bg-[#00AACF]"
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              {saved ? "Sauvegardé !" : "Sauvegarder"}
            </button>
          </div>
          <div className="bg-[#080C10] border border-white/[0.06] rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
              </div>
              <span className="text-[11px] text-[#7B8A9A] font-mono">agents/{agentId}-bot/HEARTBEAT.md</span>
            </div>
            <textarea
              value={heartbeatText}
              onChange={(e) => setHeartbeatText(e.target.value)}
              className="w-full min-h-[300px] p-4 bg-transparent text-[13px] leading-relaxed text-[#F0F4F8] font-mono resize-y focus:outline-none"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {activeTab === "info" && (
        <div className="space-y-4">
          {/* Run Now Card */}
          <div className={`bg-[#0F1520] border rounded-xl p-5 transition-all ${justRan ? "border-[#00D4FF]/40 ring-2 ring-[#00D4FF]/20" : "border-white/[0.06]"}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#F0F4F8] mb-1">Exécution manuelle</h3>
                <p className="text-[12px] text-[#7B8A9A]">
                  Lancez une exécution immédiate de cet agent
                </p>
              </div>
              <button
                onClick={handleRunNow}
                className={`flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-lg transition-all cursor-pointer ${
                  justRan
                    ? "text-[#00D4FF] bg-[#00D4FF]/15 border-2 border-[#00D4FF]/40 animate-pulse"
                    : "text-[#F0F4F8] bg-[#00D4FF] hover:bg-[#00AACF] border-2 border-transparent"
                }`}
              >
                <Zap className="w-4 h-4" />
                {justRan ? "En cours..." : "▶ Lancer maintenant"}
              </button>
            </div>
          </div>

          {/* Agent Status */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[#F0F4F8]">Statut de l&apos;agent</h3>
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <span className="text-[#7B8A9A]">Statut actuel</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStatus.color }} />
                  <span style={{ color: currentStatus.color }}>{currentStatus.label}</span>
                </div>
              </div>
              <div>
                <span className="text-[#7B8A9A]">Dernier run</span>
                <p className="text-[#F0F4F8] mt-1">{agent.lastRun || "Pas encore exécuté"}</p>
              </div>
              <div>
                <span className="text-[#7B8A9A]">Runs aujourd&apos;hui</span>
                <p className="text-[#F0F4F8] mt-1">{agent.runsToday}</p>
              </div>
              <div>
                <span className="text-[#7B8A9A]">Prochain run</span>
                <p className="text-[#00D4FF] mt-1">{agent.nextRun || "Non planifié"}</p>
              </div>
            </div>
          </div>

          {/* Changer le statut */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Changer le statut</h3>
            <div className="flex gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    agent.status === opt.value
                      ? "border-current"
                      : "border-white/[0.06] text-[#7B8A9A] hover:text-[#F0F4F8]"
                  }`}
                  style={{
                    color: agent.status === opt.value ? opt.color : undefined,
                    borderColor: agent.status === opt.value ? `${opt.color}33` : undefined,
                    backgroundColor: agent.status === opt.value ? `${opt.color}11` : undefined,
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity for this agent */}
          {agentLogs.length > 0 && (
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Activité récente</h3>
              <div className="space-y-2">
                {agentLogs.map((log) => {
                  const time = new Date(log.timestamp);
                  const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}`;
                  const typeColor = activityTypeColors[log.type];

                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 px-3 py-2 rounded-lg bg-[#080C10]/50"
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: typeColor }}
                      />
                      <span className="font-mono text-[11px] text-[#7B8A9A] flex-shrink-0 mt-0.5">{timeStr}</span>
                      <span className="text-[13px] text-[#F0F4F8] flex-1">{log.message}</span>
                      {log.details && (
                        <span className="text-[11px] text-[#7B8A9A] flex-shrink-0">{log.details}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
