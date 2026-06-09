"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/store/appStore";
import { AI_PROVIDERS, getProvider } from "@/lib/providers";
import type { AIProvider } from "@/lib/providers";
import {
  Settings,
  Key,
  Radio,
  Shield,
  Save,
  CheckCircle2,
  Eye,
  EyeOff,
  Plus,
  X,
  Linkedin,
  Loader2,
  Zap,
  Sparkles,
  Cpu,
  Bolt,
  Route,
  Users,
  Search,
  Wind,
  Brain,
  MessageSquare,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Circle,
  CheckCircle,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

// Icon map for dynamic rendering
const iconMap: Record<string, LucideIcon> = {
  Zap,
  Sparkles,
  Cpu,
  Bolt,
  Route,
  Users,
  Search,
  Wind,
  Brain,
  MessageSquare,
};

function getProviderIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || Zap;
}

function formatContextWindow(tokens: number): string {
  if (tokens >= 1048576) return `${(tokens / 1048576).toFixed(1)}M`;
  if (tokens >= 1024) return `${(tokens / 1024).toFixed(0)}K`;
  return `${tokens}`;
}

export default function SettingsView() {
  const { hermesConfig, updateHermesConfig, linkedInConfig, updateLinkedInConfig } = useAppStore();
  const [config, setConfig] = useState(hermesConfig);
  const [saved, setSaved] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newChannel, setNewChannel] = useState("");
  const [newForbidden, setNewForbidden] = useState("");
  const [testingLinkedIn, setTestingLinkedIn] = useState(false);
  const [linkedInTestResult, setLinkedInTestResult] = useState<"success" | "error" | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [providerTestResults, setProviderTestResults] = useState<Record<string, "success" | "error">>({});

  // Group providers by category
  const categories = useMemo(() => {
    const free = AI_PROVIDERS.filter((p) => p.free && !["openrouter", "together"].includes(p.id));
    const aggregators = AI_PROVIDERS.filter((p) => ["openrouter", "together"].includes(p.id));
    const lowCost = AI_PROVIDERS.filter((p) => ["deepseek", "mistral"].includes(p.id));
    const premium = AI_PROVIDERS.filter((p) => ["anthropic", "openai"].includes(p.id));
    return [
      { id: "free", label: "Gratuits", providers: free, badge: "FREE" },
      { id: "aggregators", label: "Agrégateurs", providers: aggregators, badge: "MULTI" },
      { id: "lowcost", label: "Low-cost", providers: lowCost, badge: "$" },
      { id: "premium", label: "Premium", providers: premium, badge: "$$" },
    ];
  }, []);

  const handleSave = () => {
    updateHermesConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addChannel = () => {
    if (newChannel.trim() && !config.channels.includes(newChannel.trim())) {
      setConfig({ ...config, channels: [...config.channels, newChannel.trim()] });
      setNewChannel("");
    }
  };

  const removeChannel = (ch: string) => {
    setConfig({ ...config, channels: config.channels.filter((c) => c !== ch) });
  };

  const addForbidden = () => {
    if (newForbidden.trim()) {
      setConfig({
        ...config,
        security: {
          ...config.security,
          forbiddenCommands: [...config.security.forbiddenCommands, newForbidden.trim()],
        },
      });
      setNewForbidden("");
    }
  };

  const removeForbidden = (cmd: string) => {
    setConfig({
      ...config,
      security: {
        ...config.security,
        forbiddenCommands: config.security.forbiddenCommands.filter((c) => c !== cmd),
      },
    });
  };

  const handleTestLinkedIn = async () => {
    setTestingLinkedIn(true);
    setLinkedInTestResult(null);
    try {
      const res = await fetch("/api/linkedin/me");
      if (res.ok) {
        setLinkedInTestResult("success");
      } else {
        setLinkedInTestResult("error");
      }
    } catch {
      setLinkedInTestResult("error");
    } finally {
      setTestingLinkedIn(false);
      setTimeout(() => setLinkedInTestResult(null), 3000);
    }
  };

  const handleTestProvider = async (providerId: string) => {
    const apiKey = config.providerApiKeys[providerId] || "";
    if (!apiKey) return;

    setTestingProvider(providerId);
    setProviderTestResults((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });

    try {
      const provider = getProvider(providerId);
      const modelId = provider?.models[0]?.id || "";

      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, apiKey, modelId }),
      });

      setProviderTestResults((prev) => ({
        ...prev,
        [providerId]: res.ok ? "success" : "error",
      }));
    } catch {
      setProviderTestResults((prev) => ({
        ...prev,
        [providerId]: "error",
      }));
    } finally {
      setTestingProvider(null);
      setTimeout(() => {
        setProviderTestResults((prev) => {
          const next = { ...prev };
          delete next[providerId];
          return next;
        });
      }, 3000);
    }
  };

  const selectProvider = (providerId: string, modelId: string) => {
    setConfig({ ...config, provider: providerId, model: modelId });
  };

  const updateApiKey = (providerId: string, value: string) => {
    setConfig({
      ...config,
      providerApiKeys: { ...config.providerApiKeys, [providerId]: value },
    });
  };

  const toggleShowKey = (providerId: string) => {
    setShowKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const toggleExpandProvider = (providerId: string) => {
    setExpandedProvider((prev) => (prev === providerId ? null : providerId));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Paramètres</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">Configuration du gateway HERMÈS et des fournisseurs IA</p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-lg transition-all cursor-pointer ${
            saved
              ? "text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20"
              : "text-[#080C10] bg-[#00D4FF] hover:bg-[#00AACF]"
          }`}
        >
          {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? "Sauvegardé !" : "Sauvegarder"}
        </button>
      </div>

      {/* ─── ACTIVE PROVIDER SUMMARY ──────────────────────── */}
      <div className="bg-[#0F1520] border border-[#00D4FF]/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-[#00D4FF]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Fournisseur actif</h3>
        </div>
        {(() => {
          const activeProvider = getProvider(config.provider);
          const activeModel = activeProvider?.models.find((m) => m.id === config.model);
          if (!activeProvider) return null;
          const IconComp = getProviderIcon(activeProvider.icon);
          const hasKey = !!(config.providerApiKeys[config.provider]);
          const keyConfigured = !!(config.providerApiKeys[config.provider]?.trim());
          return (
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: activeProvider.color + "15", border: `1px solid ${activeProvider.color}30` }}
              >
                <IconComp className="w-6 h-6" style={{ color: activeProvider.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-[#F0F4F8]">{activeProvider.name}</span>
                  {activeProvider.free && (
                    <span className="text-[10px] font-bold text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20 px-1.5 py-0.5 rounded-full uppercase">
                      Gratuit
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[#7B8A9A] truncate">
                  {activeModel?.name || config.model}
                  {activeModel ? ` — ${activeModel.description}` : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {keyConfigured ? (
                  <span className="flex items-center gap-1 text-[11px] text-[#00C48C]">
                    <CheckCircle className="w-3 h-3" /> Clé API configurée
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-[#E5263A]">
                    <AlertCircle className="w-3 h-3" /> Clé API manquante
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ─── PROVIDER CATALOG ──────────────────────────── */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-[#00D4FF]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Fournisseurs IA</h3>
          <span className="text-[11px] text-[#7B8A9A] ml-1">{AI_PROVIDERS.length} disponibles</span>
        </div>

        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[12px] font-semibold text-[#7B8A9A] uppercase tracking-wider">
                  {category.label}
                </span>
                {category.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      category.badge === "FREE"
                        ? "text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20"
                        : category.badge === "MULTI"
                        ? "text-[#6D28D9] bg-[#6D28D9]/10 border border-[#6D28D9]/20"
                        : category.badge === "$"
                        ? "text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20"
                        : "text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20"
                    }`}
                  >
                    {category.badge}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {category.providers.map((provider) => {
                  const IconComp = getProviderIcon(provider.icon);
                  const isActive = config.provider === provider.id;
                  const keyConfigured = !!(config.providerApiKeys[provider.id]?.trim());
                  const isExpanded = expandedProvider === provider.id;
                  const testResult = providerTestResults[provider.id];
                  const isTesting = testingProvider === provider.id;

                  return (
                    <div
                      key={provider.id}
                      className={`rounded-xl border transition-all ${
                        isActive
                          ? "border-[#00D4FF]/30 bg-[#00D4FF]/[0.03]"
                          : "border-white/[0.06] bg-[#0A0F18]"
                      }`}
                    >
                      {/* Provider header row */}
                      <button
                        onClick={() => toggleExpandProvider(provider.id)}
                        className="w-full flex items-center gap-3 p-3.5 text-left cursor-pointer"
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: provider.color + "15",
                            border: `1px solid ${provider.color}25`,
                          }}
                        >
                          <IconComp className="w-4.5 h-4.5" style={{ color: provider.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-[#F0F4F8]">{provider.name}</span>
                            {provider.free && (
                              <span className="text-[9px] font-bold text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20 px-1.5 py-0.5 rounded-full">
                                GRATUIT
                              </span>
                            )}
                            {isActive && (
                              <span className="text-[9px] font-bold text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-1.5 py-0.5 rounded-full">
                                ACTIF
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#7B8A9A] mt-0.5">
                            {provider.models.length} modèle{provider.models.length > 1 ? "s" : ""} · Contexte max {formatContextWindow(Math.max(...provider.models.map((m) => m.contextWindow)))} tokens
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Key status dot */}
                          <div className="flex items-center gap-1">
                            {keyConfigured ? (
                              <span className="flex items-center gap-1 text-[10px] text-[#00C48C]">
                                <CheckCircle className="w-3 h-3" />
                              </span>
                            ) : (
                              <Circle className="w-3 h-3 text-[#7B8A9A]/40" />
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-[#7B8A9A]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[#7B8A9A]" />
                          )}
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/[0.04] pt-3">
                          {/* API Key input */}
                          <div>
                            <label className="text-[11px] font-medium text-[#7B8A9A] mb-1.5 block">
                              Clé API {provider.name}
                            </label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <input
                                  type={showKeys[provider.id] ? "text" : "password"}
                                  value={config.providerApiKeys[provider.id] || ""}
                                  onChange={(e) => updateApiKey(provider.id, e.target.value)}
                                  placeholder={provider.apiKeyPlaceholder}
                                  className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg pr-10 pl-3 py-2 text-[13px] text-[#F0F4F8] font-mono placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
                                />
                                <button
                                  onClick={() => toggleShowKey(provider.id)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"
                                >
                                  {showKeys[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                              <button
                                onClick={() => handleTestProvider(provider.id)}
                                disabled={!keyConfigured || isTesting}
                                className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                                  !keyConfigured
                                    ? "text-[#7B8A9A]/40 bg-[#18212F] border border-white/[0.04]"
                                    : testResult === "success"
                                    ? "text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20"
                                    : testResult === "error"
                                    ? "text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20"
                                    : "text-[#7B8A9A] bg-[#18212F] border border-white/[0.06] hover:border-[#00D4FF]/20"
                                }`}
                              >
                                {isTesting ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : testResult === "success" ? (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : testResult === "error" ? (
                                  <AlertCircle className="w-3.5 h-3.5" />
                                ) : null}
                                {isTesting ? "Test..." : testResult === "success" ? "OK" : testResult === "error" ? "Échec" : "Tester"}
                              </button>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <p className="text-[10px] text-[#7B8A9A]/60">
                                Stocké localement uniquement
                              </p>
                              <a
                                href={provider.docsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] text-[#00D4FF] hover:text-[#00D4FF]/80 transition-colors"
                              >
                                Obtenir une clé <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </div>

                          {/* Model list */}
                          <div>
                            <label className="text-[11px] font-medium text-[#7B8A9A] mb-1.5 block">
                              Modèles disponibles
                            </label>
                            <div className="space-y-1.5">
                              {provider.models.map((model) => {
                                const isSelected = isActive && config.model === model.id;
                                return (
                                  <button
                                    key={model.id}
                                    onClick={() => selectProvider(provider.id, model.id)}
                                    className={`w-full text-left flex items-center gap-2.5 p-2.5 rounded-lg transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-[#00D4FF]/10 border border-[#00D4FF]/20"
                                        : "bg-[#18212F]/50 border border-transparent hover:border-white/[0.06]"
                                    }`}
                                  >
                                    <div
                                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                        isSelected ? "border-[#00D4FF]" : "border-[#7B8A9A]/30"
                                      }`}
                                    >
                                      {isSelected && <div className="w-2 h-2 rounded-full bg-[#00D4FF]" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[12px] font-medium ${isSelected ? "text-[#00D4FF]" : "text-[#F0F4F8]"}`}>
                                          {model.name}
                                        </span>
                                        {model.free && (
                                          <span className="text-[9px] font-bold text-[#00C48C] bg-[#00C48C]/10 px-1 py-0.5 rounded">
                                            GRATUIT
                                          </span>
                                        )}
                                        <span className="text-[10px] text-[#7B8A9A]/60">
                                          {formatContextWindow(model.contextWindow)} ctx
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-[#7B8A9A] mt-0.5 truncate">
                                        {model.description}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Channels ──────────────────────────────────── */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Radio className="w-4 h-4 text-[#00D4FF]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Canaux connectés</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {config.channels.map((ch) => (
            <span
              key={ch}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-2.5 py-1 rounded-full"
            >
              {ch}
              <button
                onClick={() => removeChannel(ch)}
                className="text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addChannel()}
            placeholder="Ajouter un canal (ex: linkedin, whatsapp…)"
            className="flex-1 bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
          />
          <button
            onClick={addChannel}
            className="flex items-center gap-1 text-[13px] text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-3 py-2 rounded-lg hover:bg-[#00D4FF]/15 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
      </div>

      {/* ─── Security ──────────────────────────────────── */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-[#00D4FF]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Sécurité</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-[#F0F4F8]">Autoriser l&apos;accès shell</p>
              <p className="text-[11px] text-[#7B8A9A]">Permet aux agents d&apos;exécuter des commandes système</p>
            </div>
            <button
              onClick={() =>
                setConfig({
                  ...config,
                  security: { ...config.security, allowShell: !config.security.allowShell },
                })
              }
              className={`w-10 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                config.security.allowShell ? "bg-[#00C48C]" : "bg-[#7B8A9A]/30"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  config.security.allowShell ? "translate-x-5.5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-[#F0F4F8]">Autoriser l&apos;accès navigateur</p>
              <p className="text-[11px] text-[#7B8A9A]">Permet aux agents de naviguer sur le web</p>
            </div>
            <button
              onClick={() =>
                setConfig({
                  ...config,
                  security: { ...config.security, allowBrowser: !config.security.allowBrowser },
                })
              }
              className={`w-10 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                config.security.allowBrowser ? "bg-[#00C48C]" : "bg-[#7B8A9A]/30"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  config.security.allowBrowser ? "translate-x-5.5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Forbidden commands */}
          <div className="pt-3 border-t border-white/[0.06]">
            <p className="text-[13px] text-[#F0F4F8] mb-2">Commandes interdites</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {config.security.forbiddenCommands.map((cmd) => (
                <span
                  key={cmd}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20 px-2.5 py-1 rounded-full font-mono"
                >
                  {cmd}
                  <button
                    onClick={() => removeForbidden(cmd)}
                    className="text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newForbidden}
                onChange={(e) => setNewForbidden(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addForbidden()}
                placeholder="Ajouter une commande interdite"
                className="flex-1 bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] font-mono placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
              />
              <button
                onClick={addForbidden}
                className="flex items-center gap-1 text-[13px] text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20 px-3 py-2 rounded-lg hover:bg-[#E5263A]/15 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── LinkedIn Configuration ────────────────────── */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Linkedin className="w-4 h-4 text-[#0A66C2]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">LinkedIn OAuth 2.0</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-[#7B8A9A] mb-1.5 block">Client ID</label>
            <input
              type="text"
              value={linkedInConfig.clientId}
              onChange={(e) => updateLinkedInConfig({ clientId: e.target.value })}
              placeholder="78abcdefghijk..."
              className={`w-full bg-[#18212F] border rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] font-mono placeholder:text-[#7B8A9A]/50 focus:outline-none ${
                linkedInConfig.clientId && /^([^\s@]+@[^\s@]+\.[^\s@]+)$/.test(linkedInConfig.clientId)
                  ? "border-[#E5263A]/40 focus:border-[#E5263A]/60"
                  : "border-white/[0.06] focus:border-[#0A66C2]/30"
              }`}
            />
            {linkedInConfig.clientId && /^([^\s@]+@[^\s@]+\.[^\s@]+)$/.test(linkedInConfig.clientId) && (
              <p className="text-[11px] text-[#E5263A] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Ce n'est pas un Client ID valide — une adresse email a \u00e9t\u00e9 entr\u00e9e. Le Client ID est un identifiant alphanum\u00e9rique.
              </p>
            )}
            {!linkedInConfig.clientId && (
              <p className="text-[11px] text-[#7B8A9A]/60 mt-1">
                Obtenu depuis le LinkedIn Developer Portal \u2192 My Apps \u2192 Auth
              </p>
            )}
          </div>
          <div>
            <label className="text-[12px] font-medium text-[#7B8A9A] mb-1.5 block">Client Secret</label>
            <div className="relative">
              <input
                type={showKeys["linkedin-secret"] ? "text" : "password"}
                value={linkedInConfig.clientSecret}
                onChange={(e) => updateLinkedInConfig({ clientSecret: e.target.value })}
                placeholder="WPLxxxxxxxxxx"
                className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg pr-10 pl-3 py-2 text-[13px] text-[#F0F4F8] font-mono placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#0A66C2]/30"
              />
              <button
                onClick={() => toggleShowKey("linkedin-secret")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"
              >
                {showKeys["linkedin-secret"] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-[#7B8A9A]/60 mt-1">
              Stocké localement uniquement. Jamais envoyé à nos serveurs.
            </p>
          </div>
          <div>
            <label className="text-[12px] font-medium text-[#7B8A9A] mb-1.5 block">Redirect URI</label>
            <input
              type="text"
              value={linkedInConfig.redirectUri || `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/linkedin/callback`}
              onChange={(e) => updateLinkedInConfig({ redirectUri: e.target.value })}
              className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] font-mono placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#0A66C2]/30"
            />
            <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-[#F4A100]">
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>
                URL de callback à enregistrer dans LinkedIn Developer Portal → Auth → Authorized redirect URLs. Si vide, l'URL courante sera utilisée.
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-white/[0.06]">
            <button
              onClick={handleTestLinkedIn}
              disabled={testingLinkedIn}
              className={`flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-lg transition-all cursor-pointer ${
                linkedInTestResult === "success"
                  ? "text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20"
                  : linkedInTestResult === "error"
                  ? "text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20"
                  : "text-[#0A66C2] bg-[#0A66C2]/10 border border-[#0A66C2]/20 hover:bg-[#0A66C2]/15"
              }`}
            >
              {testingLinkedIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : linkedInTestResult === "success" ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : null}
              {testingLinkedIn ? "Test en cours..." : linkedInTestResult === "success" ? "Connecté !" : linkedInTestResult === "error" ? "Échec" : "Tester la connexion"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
