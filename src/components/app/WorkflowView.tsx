"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WORKFLOW_TEMPLATES,
  TRIGGER_LABELS,
  ACTION_LABELS,
  NODE_COLORS,
  TriggerType,
  ActionType,
} from "@/lib/workflow/types";
import { workflowEngine } from "@/lib/workflow";
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Copy,
  ChevronRight,
  X,
  GripVertical,
  Zap,
  GitBranch,
  Clock,
  Globe,
  AlertTriangle,
  Bot,
} from "lucide-react";

type TabType = "workflows" | "builder" | "templates" | "executions";

export default function WorkflowView() {
  const [activeTab, setActiveTab] = useState<TabType>("workflows");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [executionResult, setExecutionResult] = useState<Record<string, unknown> | null>(null);
  const [draggedNode, setDraggedNode] = useState<WorkflowNodeType | null>(null);

  // Fetch workflows
  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/data/workflows");
      const data = await res.json();
      setWorkflows(data.workflows ?? []);
    } catch {
      // Use local engine as fallback
      setWorkflows(workflowEngine.getWorkflows());
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Create workflow from template
  const createFromTemplate = async (templateId: string) => {
    try {
      const res = await fetch("/api/data/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromTemplate: templateId }),
      });
      const data = await res.json();
      if (data.workflow) {
        setSelectedWorkflow(data.workflow);
        setActiveTab("builder");
        fetchWorkflows();
      }
    } catch {
      const workflow = workflowEngine.createFromTemplate(templateId);
      if (workflow) {
        setSelectedWorkflow(workflow);
        setActiveTab("builder");
      }
    }
  };

  // Create blank workflow
  const createBlankWorkflow = async () => {
    try {
      const res = await fetch("/api/data/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      const data = await res.json();
      if (data.workflow) {
        setSelectedWorkflow(data.workflow);
        setActiveTab("builder");
        fetchWorkflows();
        setShowCreateDialog(false);
        setNewName("");
        setNewDesc("");
      }
    } catch {
      const workflow = workflowEngine.createWorkflow({ name: newName || "Nouveau Workflow", description: newDesc });
      setSelectedWorkflow(workflow);
      setActiveTab("builder");
      setShowCreateDialog(false);
    }
  };

  // Toggle workflow status
  const toggleStatus = async (wf: Workflow) => {
    const newStatus = wf.status === "active" ? "paused" : "active";
    try {
      await fetch("/api/data/workflows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: wf.id, status: newStatus }),
      });
    } catch { /* fallback */ }
    workflowEngine.setWorkflowStatus(wf.id, newStatus as never);
    fetchWorkflows();
  };

  // Delete workflow
  const deleteWorkflow = async (id: string) => {
    try {
      await fetch(`/api/data/workflows?id=${id}`, { method: "DELETE" });
    } catch { /* fallback */ }
    workflowEngine.deleteWorkflow(id);
    fetchWorkflows();
  };

  // Execute workflow
  const executeWorkflow = async (wf: Workflow) => {
    try {
      const res = await fetch("/api/data/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: wf.id, triggerData: {} }),
      });
      const data = await res.json();
      setExecutionResult(data.execution);
    } catch {
      const execution = await workflowEngine.executeWorkflow(wf.id, {});
      setExecutionResult(execution);
    }
  };

  // Add node to builder
  const addNodeToBuilder = (type: WorkflowNodeType) => {
    if (!selectedWorkflow) return;
    const id = `node_${Date.now()}`;
    const baseY = 200;
    const x = 50 + selectedWorkflow.nodes.length * 250;
    const node: WorkflowNode = {
      id,
      type,
      label: type === "trigger" ? "Déclencheur" : type === "condition" ? "Condition" : type === "delay" ? "Délai" : type === "action" ? "Action" : type === "webhook" ? "Webhook" : "Transformation",
      config: {},
      position: { x, y: baseY },
    };
    const updated = workflowEngine.addNode(selectedWorkflow.id, node);
    if (updated) setSelectedWorkflow({ ...updated });
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "workflows", label: "Workflows" },
    { id: "builder", label: "Builder" },
    { id: "templates", label: "Templates" },
    { id: "executions", label: "Exécutions" },
  ];

  const statusColors: Record<string, string> = {
    draft: "bg-[#6B7280]",
    active: "bg-[#00C48C]",
    paused: "bg-[#F4A100]",
    error: "bg-[#E5263A]",
    archived: "bg-[#4B5563]",
  };

  const statusLabels: Record<string, string> = {
    draft: "Brouillon",
    active: "Actif",
    paused: "En pause",
    error: "Erreur",
    archived: "Archivé",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Automatisations</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">Créez des workflows automatisés pour connecter vos agents et canaux</p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 bg-[#00D4FF] text-[#0A0E14] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#00B8D9] transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nouveau workflow
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#0A0E14] rounded-lg p-1 border border-white/[0.06]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "bg-[#00D4FF]/10 text-[#00D4FF]"
                : "text-[#7B8A9A] hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Workflows List */}
      {activeTab === "workflows" && (
        <div className="space-y-3">
          {workflows.length === 0 && (
            <div className="text-center py-16 text-[#7B8A9A]">
              <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun workflow créé</p>
              <p className="text-xs mt-1">Utilisez un template ou créez un workflow vide</p>
            </div>
          )}
          {workflows.map((wf) => (
            <div key={wf.id} className="bg-[#0F1520] rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${statusColors[wf.status]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">{wf.name}</div>
                    <div className="text-xs text-[#7B8A9A] mt-0.5 truncate">{wf.description || "Aucune description"}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#7B8A9A]">
                    <span>{wf.nodes.length} noeuds</span>
                    <span>·</span>
                    <span>{wf.executions.length} exécutions</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[wf.status]} text-white`}>
                    {statusLabels[wf.status]}
                  </span>
                  <button
                    onClick={() => executeWorkflow(wf)}
                    className="p-1.5 rounded-lg hover:bg-[#00C48C]/10 text-[#7B8A9A] hover:text-[#00C48C] transition-colors cursor-pointer"
                    title="Exécuter"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleStatus(wf)}
                    className="p-1.5 rounded-lg hover:bg-[#F4A100]/10 text-[#7B8A9A] hover:text-[#F4A100] transition-colors cursor-pointer"
                    title={wf.status === "active" ? "Pause" : "Activer"}
                  >
                    {wf.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setSelectedWorkflow(wf); setActiveTab("builder"); }}
                    className="p-1.5 rounded-lg hover:bg-[#00D4FF]/10 text-[#7B8A9A] hover:text-[#00D4FF] transition-colors cursor-pointer"
                    title="Modifier"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteWorkflow(wf.id)}
                    className="p-1.5 rounded-lg hover:bg-[#E5263A]/10 text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Node flow preview */}
              {wf.nodes.length > 0 && (
                <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                  {wf.nodes.map((node, i) => (
                    <div key={node.id} className="flex items-center gap-2">
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap"
                        style={{ backgroundColor: `${NODE_COLORS[node.type]}15`, color: NODE_COLORS[node.type], border: `1px solid ${NODE_COLORS[node.type]}30` }}
                      >
                        <NodeIcon type={node.type} className="w-3 h-3" />
                        {node.label}
                      </div>
                      {i < wf.nodes.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-[#4B5563]" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Builder */}
      {activeTab === "builder" && (
        <div>
          {!selectedWorkflow ? (
            <div className="text-center py-16 text-[#7B8A9A]">
              <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sélectionnez un workflow à modifier</p>
            </div>
          ) : (
            <div>
              {/* Builder Header */}
              <div className="flex items-center justify-between mb-4 p-3 bg-[#0F1520] rounded-xl border border-white/[0.06]">
                <div>
                  <input
                    value={selectedWorkflow.name}
                    onChange={(e) => {
                      const updated = workflowEngine.updateWorkflow(selectedWorkflow.id, { name: e.target.value });
                      if (updated) setSelectedWorkflow({ ...updated });
                    }}
                    className="bg-transparent text-white text-sm font-semibold outline-none border-b border-transparent hover:border-white/20 focus:border-[#00D4FF] pb-0.5"
                  />
                  <div className="text-xs text-[#7B8A9A] mt-0.5">{selectedWorkflow.nodes.length} noeuds · {selectedWorkflow.edges.length} connexions</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => executeWorkflow(selectedWorkflow)}
                    className="flex items-center gap-1.5 bg-[#00C48C] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#00A876] transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3" /> Tester
                  </button>
                </div>
              </div>

              {/* Node Palette + Canvas */}
              <div className="grid grid-cols-[200px_1fr] gap-4">
                {/* Node Palette */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#7B8A9A] uppercase tracking-wider mb-2">Ajouter un noeud</div>
                  {(["trigger", "condition", "action", "delay", "webhook", "transform"] as WorkflowNodeType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => addNodeToBuilder(type)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06] text-xs font-medium text-[#7B8A9A] hover:text-white hover:border-white/[0.12] transition-colors cursor-pointer"
                      style={{ borderLeftColor: NODE_COLORS[type], borderLeftWidth: 3 }}
                    >
                      <NodeIcon type={type} className="w-3.5 h-3.5" />
                      {type === "trigger" ? "Déclencheur" : type === "condition" ? "Condition" : type === "action" ? "Action" : type === "delay" ? "Délai" : type === "webhook" ? "Webhook" : "Transform"}
                    </button>
                  ))}
                </div>

                {/* Canvas */}
                <div className="min-h-[500px] bg-[#0A0E14] rounded-xl border border-white/[0.06] relative overflow-auto p-4">
                  {selectedWorkflow.nodes.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-[#7B8A9A] text-sm">
                      Cliquez sur un type de noeud pour l&apos;ajouter
                    </div>
                  ) : (
                    <div className="flex items-start gap-4 flex-wrap">
                      {selectedWorkflow.nodes.map((node, i) => (
                        <div key={node.id} className="flex items-start gap-3">
                          <div
                            className="relative min-w-[160px] rounded-xl border p-3 bg-[#0F1520] hover:border-white/[0.12] transition-colors group"
                            style={{ borderColor: `${NODE_COLORS[node.type]}40` }}
                          >
                            {/* Remove button */}
                            <button
                              onClick={() => {
                                const updated = workflowEngine.removeNode(selectedWorkflow.id, node.id);
                                if (updated) setSelectedWorkflow({ ...updated });
                              }}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-[#E5263A] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                            {/* Node header */}
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${NODE_COLORS[node.type]}20` }}>
                                <NodeIcon type={node.type} className="w-3.5 h-3.5" style={{ color: NODE_COLORS[node.type] }} />
                              </div>
                              <span className="text-xs font-semibold text-white">{node.label}</span>
                            </div>
                            {/* Node type badge */}
                            <div className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${NODE_COLORS[node.type]}15`, color: NODE_COLORS[node.type] }}>
                              {node.type === "trigger" ? TRIGGER_LABELS[node.triggerType ?? "manual"] : node.type === "action" ? ACTION_LABELS[node.actionType ?? "log_activity"] : node.type}
                            </div>
                          </div>
                          {/* Connection arrow */}
                          {i < selectedWorkflow.nodes.length - 1 && (
                            <div className="flex items-center h-full pt-6">
                              <div className="w-8 h-0.5 bg-[#4B5563] relative">
                                <ChevronRight className="w-3 h-3 text-[#4B5563] absolute -right-1 -top-1" />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Execution Result */}
              {executionResult && (
                <div className="mt-4 p-4 bg-[#0F1520] rounded-xl border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-white">Résultat d&apos;exécution</span>
                    <button onClick={() => setExecutionResult(null)} className="text-[#7B8A9A] hover:text-white cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <pre className="text-xs text-[#7B8A9A] overflow-auto max-h-[300px] bg-[#0A0E14] rounded-lg p-3">
                    {JSON.stringify(executionResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Templates */}
      {activeTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WORKFLOW_TEMPLATES.map((tpl) => (
            <div key={tpl.id} className="bg-[#0F1520] rounded-xl border border-white/[0.06] p-5 hover:border-[#00D4FF]/30 transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{tpl.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-white">{tpl.name}</div>
                    <div className="text-[10px] font-medium text-[#00D4FF] uppercase tracking-wider">{tpl.category}</div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-[#7B8A9A] mb-4 leading-relaxed">{tpl.description}</p>
              {/* Node flow preview */}
              <div className="flex items-center gap-1.5 flex-wrap mb-4">
                {tpl.nodes.map((node, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div
                      className="px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: `${NODE_COLORS[node.type]}15`, color: NODE_COLORS[node.type] }}
                    >
                      {node.label}
                    </div>
                    {i < tpl.nodes.length - 1 && <ChevronRight className="w-2.5 h-2.5 text-[#4B5563]" />}
                  </div>
                ))}
              </div>
              <button
                onClick={() => createFromTemplate(tpl.id)}
                className="w-full py-2 rounded-lg text-xs font-semibold bg-[#00D4FF]/10 text-[#00D4FF] hover:bg-[#00D4FF]/20 transition-colors cursor-pointer"
              >
                Utiliser ce template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Executions */}
      {activeTab === "executions" && (
        <div className="space-y-3">
          {workflows.every((w) => w.executions.length === 0) && (
            <div className="text-center py-16 text-[#7B8A9A]">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune exécution enregistrée</p>
              <p className="text-xs mt-1">Exécutez un workflow pour voir l&apos;historique ici</p>
            </div>
          )}
          {workflows.filter((w) => w.executions.length > 0).map((wf) => (
            <div key={wf.id}>
              <div className="text-xs font-semibold text-[#7B8A9A] mb-2">{wf.name}</div>
              {wf.executions.slice(0, 5).map((exec) => (
                <div key={exec.id} className="flex items-center gap-3 p-3 bg-[#0F1520] rounded-lg border border-white/[0.06] mb-1.5">
                  <div className={`w-2 h-2 rounded-full ${
                    exec.status === "completed" ? "bg-[#00C48C]" :
                    exec.status === "failed" ? "bg-[#E5263A]" :
                    exec.status === "running" ? "bg-[#00D4FF] animate-pulse" : "bg-[#6B7280]"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white">{exec.status === "completed" ? "Terminé" : exec.status === "failed" ? "Échoué" : "En cours"}</div>
                    <div className="text-[10px] text-[#7B8A9A]">{new Date(exec.startedAt).toLocaleString("fr-FR")}</div>
                  </div>
                  <div className="text-xs text-[#7B8A9A]">{exec.steps.filter((s) => s.status === "completed").length}/{exec.steps.length} étapes</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F1520] rounded-2xl border border-white/[0.08] w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Nouveau workflow</h2>
              <button onClick={() => setShowCreateDialog(false)} className="text-[#7B8A9A] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#7B8A9A] mb-1 block">Nom du workflow</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Lead qualifié → Email automatique"
                  className="w-full bg-[#0A0E14] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#00D4FF] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#7B8A9A] mb-1 block">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Que fait ce workflow ?"
                  rows={3}
                  className="w-full bg-[#0A0E14] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#00D4FF] transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-white/[0.04] text-[#7B8A9A] hover:text-white transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={createBlankWorkflow}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[#00D4FF] text-[#0A0E14] hover:bg-[#00B8D9] transition-colors cursor-pointer"
                >
                  Créer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Node Icon Helper ───────────────────────────────────────────────

function NodeIcon({ type, className = "w-4 h-4", style }: { type: WorkflowNodeType; className?: string; style?: React.CSSProperties }) {
  switch (type) {
    case "trigger":
      return <Zap className={className} style={style} />;
    case "condition":
      return <GitBranch className={className} style={style} />;
    case "action":
      return <Bot className={className} style={style} />;
    case "delay":
      return <Clock className={className} style={style} />;
    case "webhook":
      return <Globe className={className} style={style} />;
    case "loop":
      return <Copy className={className} style={style} />;
    case "transform":
      return <AlertTriangle className={className} style={style} />;
    default:
      return <Zap className={className} style={style} />;
  }
}
