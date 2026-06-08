"use client";

import { useState } from "react";
import { useAppStore, type AgentStatus } from "@/store/appStore";
import {
  Play,
  Pause,
  RotateCcw,
  Save,
  Clock,
  FileCode,
  Activity,
} from "lucide-react";

const statusOptions: { value: AgentStatus; label: string; color: string }[] = [
  { value: "active", label: "Actif", color: "#00C48C" },
  { value: "paused", label: "En pause", color: "#F4A100" },
  { value: "setup", label: "À configurer", color: "#7B8A9A" },
  { value: "error", label: "Erreur", color: "#E5263A" },
];

export default function AgentDetailView({ agentId }: { agentId: string }) {
  const { agents, updateAgent } = useAppStore();
  const agent = agents.find((a) => a.id === agentId)!;
  const [activeTab, setActiveTab] = useState<"skill" | "heartbeat" | "info">("skill");
  const [skillText, setSkillText] = useState(agent.skillMd);
  const [heartbeatText, setHeartbeatText] = useState(agent.heartbeatMd);
  const [saved, setSaved] = useState(false);

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
        </div>
      )}
    </div>
  );
}
