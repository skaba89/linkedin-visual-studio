"use client";

import { useState, useEffect } from "react";
import { useAppStore, type AgentStatus, type ActivityLog } from "@/store/appStore";
import { runContenuAgent, runQualificationAgent, runProspectionAgent } from "@/lib/agent-runner";
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
  Loader2,
  FileText,
  MessageSquare,
  Sparkles,
  Bot,
  Copy,
  CheckCircle2,
  Send,
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
  const { agents, updateAgent, activityLogs, generatedPosts, generatedMessages, executingAgent, addActivityLog, addGeneratedPost, addGeneratedMessages, addLead, updateLead, updateMetrics } = useAppStore();
  const agent = agents.find((a) => a.id === agentId)!;
  const [activeTab, setActiveTab] = useState<"skill" | "heartbeat" | "info" | "output">("info");
  const [skillText, setSkillText] = useState(agent.skillMd);
  const [heartbeatText, setHeartbeatText] = useState(agent.heartbeatMd);
  const [saved, setSaved] = useState(false);
  const [justRan, setJustRan] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Activity logs for this specific agent
  const agentLogs = activityLogs.filter((l) => l.agentId === agentId).slice(0, 5);

  // Generated content for this agent
  const agentPosts = generatedPosts.filter((p) => p.agentRun !== undefined).slice(0, 5);
  const agentMessages = generatedMessages.filter((m) => m.timing === "J+0").slice(0, 5);

  // Reset justRan after animation
  useEffect(() => {
    if (justRan) {
      const timer = setTimeout(() => setJustRan(false), 3000);
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

  const handleRunNow = async () => {
    if (agent.status !== "active") {
      updateAgent(agentId, { status: "active" });
    }
    setJustRan(true);

    const now = new Date();
    const timeHHMM = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    updateAgent(agentId, { lastRun: timeHHMM, runsToday: agent.runsToday + 1 });

    const store = useAppStore.getState();
    store.setExecutingAgent(agentId);

    try {
      if (agentId === "contenu") {
        const result = await runContenuAgent();
        for (const log of result.logs) store.addActivityLog(log);
        if (result.post) {
          store.addGeneratedPost(result.post);
          store.updateMetrics({
            postsPublished: store.metrics.postsPublished + 1,
            impressionsMoy: store.metrics.impressionsMoy + Math.floor(Math.random() * 300 + 100),
          });
        }
      } else if (agentId === "qualif") {
        const result = await runQualificationAgent();
        for (const log of result.logs) store.addActivityLog(log);
        for (const lead of result.newLeads) store.addLead(lead);
        const qualifiedCount = result.newLeads.filter((l) => l.score >= 60).length;
        store.updateMetrics({
          profilsCollectes: store.metrics.profilsCollectes + result.newLeads.length,
          leadsQualifies: store.metrics.leadsQualifies + qualifiedCount,
        });
      } else if (agentId === "prospection") {
        const result = await runProspectionAgent();
        for (const log of result.logs) store.addActivityLog(log);
        store.addGeneratedMessages(result.messages);
        for (const leadId of result.transitionedLeadIds) store.updateLead(leadId, { statut: "contacted" });
        store.updateMetrics({
          messagesEnvoyes: store.metrics.messagesEnvoyes + result.messages.length,
        });
      }
    } catch (error) {
      store.addActivityLog({
        agentId,
        agentName: agent.name,
        type: "error",
        message: `Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      });
    } finally {
      store.setExecutingAgent(null);
    }

    // Switch to output tab to show results
    setTimeout(() => setActiveTab("output"), 500);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExecuting = executingAgent === agentId;
  const currentStatus = statusOptions.find((s) => s.value === agent.status)!;

  // Determine relevant content for the output tab
  const hasOutput = agentId === "contenu" ? agentPosts.length > 0 : agentId === "prospection" ? agentMessages.length > 0 : agentLogs.length > 0;

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
                color: isExecuting ? "#00D4FF" : currentStatus.color,
                borderColor: isExecuting ? "#00D4FF33" : `${currentStatus.color}33`,
                backgroundColor: isExecuting ? "#00D4FF11" : `${currentStatus.color}11`,
              }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isExecuting ? "animate-pulse" : ""}`} style={{ backgroundColor: isExecuting ? "#00D4FF" : currentStatus.color }} />
              {isExecuting ? "En cours..." : currentStatus.label}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">
            Agent {agent.name}
          </h1>
          <p className="text-sm text-[#7B8A9A] mt-1">{agent.role}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunNow}
            disabled={isExecuting}
            className={`flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 ${
              isExecuting
                ? "text-[#00D4FF] bg-[#00D4FF]/15 border-2 border-[#00D4FF]/40 animate-pulse"
                : justRan
                ? "text-[#00C48C] bg-[#00C48C]/10 border-2 border-[#00C48C]/30"
                : "text-[#F0F4F8] bg-[#00D4FF] hover:bg-[#00AACF] border-2 border-transparent"
            }`}
          >
            {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {isExecuting ? "Exécution IA..." : justRan ? "Terminé !" : "Lancer maintenant"}
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
          { id: "info" as const, label: "Infos", icon: Activity },
          { id: "output" as const, label: "Sorties IA", icon: Sparkles },
          { id: "skill" as const, label: "SKILL.md", icon: FileCode },
          { id: "heartbeat" as const, label: "HEARTBEAT.md", icon: Clock },
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
            {tab.id === "output" && hasOutput && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C48C]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "info" && (
        <div className="space-y-4">
          {/* Run Now Card */}
          <div className={`bg-[#0F1520] border rounded-xl p-5 transition-all ${isExecuting ? "border-[#00D4FF]/40 ring-2 ring-[#00D4FF]/20" : justRan ? "border-[#00C48C]/30" : "border-white/[0.06]"}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#F0F4F8] mb-1">Exécution manuelle</h3>
                <p className="text-[12px] text-[#7B8A9A]">
                  {isExecuting ? "L'agent appelle le LLM en ce moment..." : "Lancez une exécution immédiate — appelle le LLM si une clé API est configurée"}
                </p>
              </div>
              <button
                onClick={handleRunNow}
                disabled={isExecuting}
                className={`flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-50 ${
                  isExecuting
                    ? "text-[#00D4FF] bg-[#00D4FF]/15 border-2 border-[#00D4FF]/40 animate-pulse"
                    : "text-[#F0F4F8] bg-[#00D4FF] hover:bg-[#00AACF] border-2 border-transparent"
                }`}
              >
                {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isExecuting ? "Exécution IA..." : "Lancer maintenant"}
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

          {/* Recent Activity */}
          {agentLogs.length > 0 && (
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Activité récente</h3>
              <div className="space-y-2">
                {agentLogs.map((log) => {
                  const time = new Date(log.timestamp);
                  const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}`;
                  const typeColor = activityTypeColors[log.type];
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-[#080C10]/50">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: typeColor }} />
                      <span className="font-mono text-[11px] text-[#7B8A9A] flex-shrink-0 mt-0.5">{timeStr}</span>
                      <span className="text-[13px] text-[#F0F4F8] flex-1">{log.message}</span>
                      {log.details && <span className="text-[11px] text-[#7B8A9A] flex-shrink-0">{log.details}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* OUTPUT TAB — Shows real AI-generated content */}
      {activeTab === "output" && (
        <div className="space-y-4">
          {agentId === "contenu" && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#00D4FF]" />
                  <h3 className="text-sm font-semibold text-[#F0F4F8]">Posts générés par l&apos;IA</h3>
                  <span className="text-[11px] text-[#7B8A9A]">{agentPosts.length} post{agentPosts.length !== 1 ? "s" : ""}</span>
                </div>
                <button
                  onClick={handleRunNow}
                  disabled={isExecuting}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-3 py-1.5 rounded-lg hover:bg-[#00D4FF]/15 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Générer un post
                </button>
              </div>
              {agentPosts.length === 0 ? (
                <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-8 text-center">
                  <FileText className="w-8 h-8 text-[#7B8A9A]/30 mx-auto mb-2" />
                  <p className="text-[13px] text-[#7B8A9A]">Aucun post généré pour le moment</p>
                  <p className="text-[11px] text-[#7B8A9A]/60 mt-1">Cliquez sur &quot;Générer un post&quot; pour lancer l&apos;IA</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agentPosts.map((post) => (
                    <div key={post.id} className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Bot className="w-3.5 h-3.5 text-[#00D4FF]" />
                          <span className="text-[11px] font-medium text-[#7B8A9A]">Sujet: {post.topic}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            post.model === "simulation"
                              ? "text-[#F4A100] bg-[#F4A100]/10 border border-[#F4A100]/20"
                              : "text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20"
                          }`}>
                            {post.model === "simulation" ? "Simulation" : `IA: ${post.model}`}
                          </span>
                          <button
                            onClick={() => copyToClipboard(post.text, post.id)}
                            className="text-[#7B8A9A] hover:text-[#00D4FF] transition-colors cursor-pointer"
                          >
                            {copiedId === post.id ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00C48C]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="text-[13px] text-[#F0F4F8] whitespace-pre-wrap leading-relaxed bg-[#080C10] rounded-lg p-4">
                        {post.text}
                      </div>
                      <div className="flex items-center gap-3 mt-3 text-[11px] text-[#7B8A9A]">
                        <span>{new Date(post.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        <span>{post.text.split(/\s+/).length} mots</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {agentId === "qualif" && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#A78BFA]" />
                  <h3 className="text-sm font-semibold text-[#F0F4F8]">Leads récemment qualifiés</h3>
                </div>
                <button
                  onClick={handleRunNow}
                  disabled={isExecuting}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-[#A78BFA] bg-[#A78BFA]/10 border border-[#A78BFA]/20 px-3 py-1.5 rounded-lg hover:bg-[#A78BFA]/15 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Qualifier des leads
                </button>
              </div>
              <QualificationResults />
            </>
          )}

          {agentId === "prospection" && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#00C48C]" />
                  <h3 className="text-sm font-semibold text-[#F0F4F8]">Messages générés par l&apos;IA</h3>
                  <span className="text-[11px] text-[#7B8A9A]">{agentMessages.length} message{agentMessages.length !== 1 ? "s" : ""}</span>
                </div>
                <button
                  onClick={handleRunNow}
                  disabled={isExecuting}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20 px-3 py-1.5 rounded-lg hover:bg-[#00C48C]/15 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Générer des DM
                </button>
              </div>
              {agentMessages.length === 0 ? (
                <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-8 text-center">
                  <MessageSquare className="w-8 h-8 text-[#7B8A9A]/30 mx-auto mb-2" />
                  <p className="text-[13px] text-[#7B8A9A]">Aucun message généré pour le moment</p>
                  <p className="text-[11px] text-[#7B8A9A]/60 mt-1">Il faut d&apos;abord des leads qualifiés (score ≥ 60) pour générer des DM</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agentMessages.map((msg) => (
                    <div key={msg.id} className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#00C48C]/15 flex items-center justify-center">
                            <span className="text-[11px] font-semibold text-[#00C48C]">{msg.leadName[0]}</span>
                          </div>
                          <div>
                            <span className="text-[13px] font-medium text-[#F0F4F8]">{msg.leadName}</span>
                            <span className="text-[11px] text-[#7B8A9A] ml-1.5">{msg.leadEntreprise}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-2 py-0.5 rounded-full">{msg.timing}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            msg.model === "simulation" || msg.model.includes("fallback")
                              ? "text-[#F4A100] bg-[#F4A100]/10 border border-[#F4A100]/20"
                              : "text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20"
                          }`}>
                            {msg.model === "simulation" || msg.model.includes("fallback") ? "Simulation" : "IA"}
                          </span>
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="text-[#7B8A9A] hover:text-[#00D4FF] transition-colors cursor-pointer"
                          >
                            {copiedId === msg.id ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00C48C]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="text-[13px] text-[#F0F4F8] whitespace-pre-wrap leading-relaxed bg-[#080C10] rounded-lg p-4">
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

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
    </div>
  );
}

function QualificationResults() {
  const { leads, icpConfig } = useAppStore();
  const recentLeads = leads.filter((l) => l.statut === "new").slice(0, 8);

  return (
    <div className="space-y-2">
      {recentLeads.length === 0 ? (
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-8 text-center">
          <Circle className="w-8 h-8 text-[#7B8A9A]/30 mx-auto mb-2" />
          <p className="text-[13px] text-[#7B8A9A]">Aucun lead qualifié récemment</p>
        </div>
      ) : (
        recentLeads.map((lead) => (
          <div key={lead.id} className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#A78BFA]/15 flex items-center justify-center">
                  <span className="text-[12px] font-semibold text-[#A78BFA]">{lead.prenom[0]}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-[#F0F4F8]">{lead.prenom}</span>
                    <span className="text-[11px] text-[#7B8A9A]">{lead.poste}</span>
                  </div>
                  <p className="text-[11px] text-[#7B8A9A]">{lead.entreprise} · {lead.secteur}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#7B8A9A]">{lead.action === "commented" ? "💬 Commenté" : "👍 Liké"}</span>
                <div className={`text-[13px] font-mono font-semibold px-2 py-0.5 rounded ${
                  lead.score >= 80 ? "text-[#00C48C] bg-[#00C48C]/10" :
                  lead.score >= 60 ? "text-[#F4A100] bg-[#F4A100]/10" :
                  "text-[#E5263A] bg-[#E5263A]/10"
                }`}>
                  {lead.score}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
