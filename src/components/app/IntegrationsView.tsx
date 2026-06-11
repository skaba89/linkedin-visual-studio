"use client";

import { useState, useEffect, useCallback } from "react";
import {
  WebhookConfig,
  WebhookDelivery,
  WebhookProvider,
  WebhookEvent,
  PROVIDER_LABELS,
  PROVIDER_COLORS,
  EVENT_LABELS,
  EVENT_CATEGORIES,
} from "@/lib/webhooks/types";
import { webhookEngine } from "@/lib/webhooks";
import {
  Plus,
  Play,
  Pause,
  Trash2,
  TestTube,
  Globe,
  Hash,
  MessageCircle,
  Zap,
  GitBranch,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Activity,
  Settings,
} from "lucide-react";

type TabType = "webhooks" | "deliveries" | "setup";

export default function IntegrationsView() {
  const [activeTab, setActiveTab] = useState<TabType>("webhooks");
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    provider: "custom" as WebhookProvider,
    url: "",
    events: [] as WebhookEvent[],
  });
  const [testResult, setTestResult] = useState<WebhookDelivery | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/data/webhooks?deliveries=true");
      const data = await res.json();
      setWebhooks(data.webhooks ?? []);
      setDeliveries(data.deliveries ?? []);
    } catch {
      setWebhooks(webhookEngine.getWebhooks());
      setDeliveries(webhookEngine.getDeliveries());
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const registerWebhook = async () => {
    try {
      await fetch("/api/data/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWebhook),
      });
    } catch { /* fallback */ }
    webhookEngine.registerWebhook(newWebhook);
    setShowCreateDialog(false);
    setNewWebhook({ name: "", provider: "custom", url: "", events: [] });
    fetchData();
  };

  const toggleWebhook = async (id: string) => {
    try {
      await fetch("/api/data/webhooks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "toggle" }),
      });
    } catch { /* fallback */ }
    webhookEngine.toggleWebhook(id);
    fetchData();
  };

  const deleteWebhook = async (id: string) => {
    try {
      await fetch(`/api/data/webhooks?id=${id}`, { method: "DELETE" });
    } catch { /* fallback */ }
    webhookEngine.deleteWebhook(id);
    fetchData();
  };

  const testWebhook = async (id: string) => {
    try {
      const res = await fetch("/api/data/webhooks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "test" }),
      });
      const data = await res.json();
      setTestResult(data.delivery);
    } catch {
      const delivery = await webhookEngine.testWebhook(id);
      setTestResult(delivery);
    }
    fetchData();
  };

  const toggleEvent = (event: WebhookEvent) => {
    const events = newWebhook.events.includes(event)
      ? newWebhook.events.filter((e) => e !== event)
      : [...newWebhook.events, event];
    setNewWebhook({ ...newWebhook, events });
  };

  const getProviderIcon = (provider: WebhookProvider) => {
    switch (provider) {
      case "slack": return <Hash className="w-4 h-4" />;
      case "discord": return <MessageCircle className="w-4 h-4" />;
      case "zapier": return <Zap className="w-4 h-4" />;
      case "make": return <GitBranch className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const statusColors: Record<string, string> = {
    active: "bg-[#00C48C]",
    paused: "bg-[#F4A100]",
    error: "bg-[#E5263A]",
    disabled: "bg-[#6B7280]",
  };

  const deliveryStatusColors: Record<string, string> = {
    delivered: "text-[#00C48C]",
    failed: "text-[#E5263A]",
    pending: "text-[#00D4FF]",
    retrying: "text-[#F4A100]",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Intégrations</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">Webhooks sortants vers Slack, Discord, Zapier et plus</p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 bg-[#00D4FF] text-[#0A0E14] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#00B8D9] transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Ajouter webhook
        </button>
      </div>

      {/* Quick Setup Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(["slack", "discord", "zapier", "make"] as WebhookProvider[]).map((provider) => {
          const count = webhooks.filter((w) => w.provider === provider).length;
          return (
            <button
              key={provider}
              onClick={() => {
                setNewWebhook({ ...newWebhook, provider });
                setShowCreateDialog(true);
              }}
              className="bg-[#0F1520] rounded-xl border border-white/[0.06] p-4 text-left hover:border-white/[0.12] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${PROVIDER_COLORS[provider]}20` }}>
                  {getProviderIcon(provider)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{PROVIDER_LABELS[provider]}</div>
                  <div className="text-[10px] text-[#7B8A9A]">{count} webhook(s)</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#0A0E14] rounded-lg p-1 border border-white/[0.06]">
        {[
          { id: "webhooks" as TabType, label: "Webhooks" },
          { id: "deliveries" as TabType, label: "Livraisons" },
          { id: "setup" as TabType, label: "Guide" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.id ? "bg-[#00D4FF]/10 text-[#00D4FF]" : "text-[#7B8A9A] hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Webhooks List */}
      {activeTab === "webhooks" && (
        <div className="space-y-3">
          {webhooks.length === 0 && (
            <div className="text-center py-16 text-[#7B8A9A]">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun webhook configuré</p>
              <p className="text-xs mt-1">Ajoutez un webhook pour envoyer des événements HERMÈS vers vos outils</p>
            </div>
          )}
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-[#0F1520] rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${PROVIDER_COLORS[wh.provider]}20` }}>
                    {getProviderIcon(wh.provider)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{wh.name}</div>
                    <div className="text-xs text-[#7B8A9A] flex items-center gap-2">
                      <span>{PROVIDER_LABELS[wh.provider]}</span>
                      <span>·</span>
                      <span>{wh.events.length} événement(s)</span>
                      <span>·</span>
                      <span>{wh.totalDeliveries} livraisons</span>
                      {wh.errorCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-[#E5263A]">{wh.errorCount} erreurs</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${statusColors[wh.status]}`} />
                  <button
                    onClick={() => testWebhook(wh.id)}
                    className="p-1.5 rounded-lg hover:bg-[#00D4FF]/10 text-[#7B8A9A] hover:text-[#00D4FF] transition-colors cursor-pointer"
                    title="Tester"
                  >
                    <TestTube className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleWebhook(wh.id)}
                    className="p-1.5 rounded-lg hover:bg-[#F4A100]/10 text-[#7B8A9A] hover:text-[#F4A100] transition-colors cursor-pointer"
                    title={wh.status === "active" ? "Pause" : "Activer"}
                  >
                    {wh.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteWebhook(wh.id)}
                    className="p-1.5 rounded-lg hover:bg-[#E5263A]/10 text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Events list */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {wh.events.map((evt) => (
                  <span key={evt} className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/[0.04] text-[#7B8A9A]">
                    {EVENT_LABELS[evt] ?? evt}
                  </span>
                ))}
              </div>
              {/* URL */}
              <div className="mt-3 text-[10px] text-[#4B5563] font-mono truncate bg-[#0A0E14] rounded px-2 py-1">
                {wh.url}
              </div>
              {/* Stats row */}
              <div className="flex items-center gap-4 mt-3 text-xs text-[#7B8A9A]">
                <span>Succès: {wh.successDeliveries}/{wh.totalDeliveries}</span>
                {wh.totalDeliveries > 0 && (
                  <span>Taux: {Math.round((wh.successDeliveries / wh.totalDeliveries) * 100)}%</span>
                )}
                {wh.lastTriggeredAt && (
                  <span>Dernier: {new Date(wh.lastTriggeredAt).toLocaleString("fr-FR")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deliveries */}
      {activeTab === "deliveries" && (
        <div className="space-y-2">
          {deliveries.length === 0 && (
            <div className="text-center py-16 text-[#7B8A9A]">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune livraison enregistrée</p>
            </div>
          )}
          {deliveries.map((del) => (
            <div key={del.id} className="flex items-center gap-3 p-3 bg-[#0F1520] rounded-lg border border-white/[0.06]">
              <div className={`w-2 h-2 rounded-full ${
                del.status === "delivered" ? "bg-[#00C48C]" :
                del.status === "failed" ? "bg-[#E5263A]" :
                del.status === "retrying" ? "bg-[#F4A100]" : "bg-[#00D4FF]"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white">{EVENT_LABELS[del.event] ?? del.event}</span>
                  <span className={`text-[10px] font-medium ${deliveryStatusColors[del.status]}`}>
                    {del.status === "delivered" ? "Livré" : del.status === "failed" ? "Échoué" : del.status === "retrying" ? "Nouvel essai" : "En attente"}
                  </span>
                </div>
                <div className="text-[10px] text-[#4B5563] mt-0.5">
                  {del.attempts} tentative(s) · {new Date(del.createdAt).toLocaleString("fr-FR")}
                  {del.response?.status && ` · HTTP ${del.response.status}`}
                  {del.error && ` · ${del.error}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Setup Guide */}
      {activeTab === "setup" && (
        <div className="space-y-4">
          <div className="bg-[#0F1520] rounded-xl border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Slack — Webhook entrant</h3>
            <ol className="text-xs text-[#7B8A9A] space-y-2">
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">1.</span> Allez sur <span className="text-[#00D4FF] font-mono">api.slack.com/messaging/webhooks</span></li>
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">2.</span> Créez une nouvelle app Slack ou sélectionnez une app existante</li>
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">3.</span> Activez les Incoming Webhooks et créez un webhook pour un canal</li>
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">4.</span> Copiez l&apos;URL du webhook (format: <span className="font-mono">https://hooks.slack.com/services/T.../B.../xxx</span>)</li>
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">5.</span> Collez l&apos;URL ci-dessus en ajoutant un webhook Slack</li>
            </ol>
          </div>
          <div className="bg-[#0F1520] rounded-xl border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Discord — Webhook</h3>
            <ol className="text-xs text-[#7B8A9A] space-y-2">
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">1.</span> Ouvrez les paramètres de votre serveur Discord</li>
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">2.</span> Allez dans Intégrations → Webhooks</li>
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">3.</span> Créez un nouveau webhook et sélectionnez le canal</li>
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">4.</span> Copiez l&apos;URL du webhook</li>
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">5.</span> Collez l&apos;URL ci-dessus en ajoutant un webhook Discord</li>
            </ol>
          </div>
          <div className="bg-[#0F1520] rounded-xl border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Zapier / Make — Webhook Catcher</h3>
            <ol className="text-xs text-[#7B8A9A] space-y-2">
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">1.</span> Créez un nouveau Zap (Zapier) ou Scénario (Make)</li>
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">2.</span> Choisissez &quot;Webhook&quot; comme trigger</li>
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">3.</span> Copiez l&apos;URL du webhook catcher</li>
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">4.</span> Collez l&apos;URL ci-dessus en ajoutant un webhook Zapier/Make</li>
              <li className="flex gap-2"><span className="text-[#00D4FF] font-semibold">5.</span> Les données HERMÈS seront envoyées en JSON avec le format standard</li>
            </ol>
          </div>
        </div>
      )}

      {/* Test Result Modal */}
      {testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F1520] rounded-2xl border border-white/[0.08] w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Résultat du test</h2>
              <button onClick={() => setTestResult(null)} className="text-[#7B8A9A] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              {testResult.status === "delivered" ? (
                <div className="flex items-center gap-2 text-[#00C48C]">
                  <Check className="w-5 h-5" />
                  <span className="text-sm font-semibold">Livré avec succès</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[#E5263A]">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-semibold">Échec de la livraison</span>
                </div>
              )}
            </div>
            {testResult.response?.status && (
              <div className="text-xs text-[#7B8A9A] mb-2">HTTP Status: {testResult.response.status}</div>
            )}
            {testResult.error && (
              <div className="text-xs text-[#E5263A] mb-2">Erreur: {testResult.error}</div>
            )}
            <pre className="text-[10px] text-[#7B8A9A] bg-[#0A0E14] rounded-lg p-3 overflow-auto max-h-[200px]">
              {testResult.request.body}
            </pre>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F1520] rounded-2xl border border-white/[0.08] w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Nouveau webhook</h2>
              <button onClick={() => setShowCreateDialog(false)} className="text-[#7B8A9A] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-medium text-[#7B8A9A] mb-1 block">Nom</label>
                <input
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                  placeholder="Ex: Slack #hermes-alerts"
                  className="w-full bg-[#0A0E14] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#00D4FF] transition-colors"
                />
              </div>
              {/* Provider */}
              <div>
                <label className="text-xs font-medium text-[#7B8A9A] mb-1 block">Provider</label>
                <div className="grid grid-cols-5 gap-2">
                  {(["slack", "discord", "zapier", "make", "custom"] as WebhookProvider[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewWebhook({ ...newWebhook, provider: p })}
                      className={`p-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        newWebhook.provider === p ? "border-[#00D4FF] text-[#00D4FF]" : "border-white/[0.06] text-[#7B8A9A]"
                      }`}
                    >
                      {PROVIDER_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
              {/* URL */}
              <div>
                <label className="text-xs font-medium text-[#7B8A9A] mb-1 block">URL du webhook</label>
                <input
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                  placeholder={newWebhook.provider === "slack" ? "https://hooks.slack.com/services/..." : "https://..."}
                  className="w-full bg-[#0A0E14] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-[#4B5563] outline-none focus:border-[#00D4FF] transition-colors"
                />
              </div>
              {/* Events */}
              <div>
                <label className="text-xs font-medium text-[#7B8A9A] mb-2 block">Événements à écouter</label>
                <div className="space-y-3">
                  {Object.entries(EVENT_CATEGORIES).map(([category, events]) => (
                    <div key={category}>
                      <div className="text-[10px] font-semibold text-[#7B8A9A] uppercase tracking-wider mb-1">{category}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {events.map((evt) => (
                          <button
                            key={evt}
                            onClick={() => toggleEvent(evt)}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                              newWebhook.events.includes(evt)
                                ? "bg-[#00D4FF]/10 text-[#00D4FF]"
                                : "bg-white/[0.04] text-[#4B5563] hover:text-[#7B8A9A]"
                            }`}
                          >
                            {EVENT_LABELS[evt]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-white/[0.04] text-[#7B8A9A] hover:text-white transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={registerWebhook}
                  disabled={!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[#00D4FF] text-[#0A0E14] hover:bg-[#00B8D9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Créer webhook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
