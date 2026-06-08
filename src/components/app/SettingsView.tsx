"use client";

import { useState } from "react";
import { useAppStore } from "@/store/appStore";
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
} from "lucide-react";

export default function SettingsView() {
  const { hermesConfig, updateHermesConfig, linkedInConfig, updateLinkedInConfig } = useAppStore();
  const [config, setConfig] = useState(hermesConfig);
  const [saved, setSaved] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showLiSecret, setShowLiSecret] = useState(false);
  const [newChannel, setNewChannel] = useState("");
  const [newForbidden, setNewForbidden] = useState("");
  const [testingLinkedIn, setTestingLinkedIn] = useState(false);
  const [linkedInTestResult, setLinkedInTestResult] = useState<"success" | "error" | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Paramètres</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">Configuration du gateway HERMÈS et des clés API</p>
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

      {/* Model selection */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-[#00D4FF]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Modèle IA</h3>
        </div>
        <select
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
          className="w-full sm:w-auto bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30 cursor-pointer"
        >
          <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
          <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
          <option value="gpt-4o">GPT-4o</option>
          <option value="gpt-4o-mini">GPT-4o Mini</option>
        </select>
      </div>

      {/* API Keys */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-[#00D4FF]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Clés API</h3>
        </div>
        <div className="space-y-4">
          {/* Anthropic */}
          <div>
            <label className="text-[12px] font-medium text-[#7B8A9A] mb-1.5 block">Anthropic API Key</label>
            <div className="relative">
              <input
                type={showAnthropic ? "text" : "password"}
                value={config.apiKeys.anthropic}
                onChange={(e) =>
                  setConfig({ ...config, apiKeys: { ...config.apiKeys, anthropic: e.target.value } })
                }
                placeholder="sk-ant-..."
                className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg pr-10 pl-3 py-2 text-[13px] text-[#F0F4F8] font-mono placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
              />
              <button
                onClick={() => setShowAnthropic(!showAnthropic)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"
              >
                {showAnthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-[#7B8A9A]/60 mt-1">
              Utilisez $ANTHROPIC_API_KEY pour la variable d&apos;environnement
            </p>
          </div>
          {/* OpenAI */}
          <div>
            <label className="text-[12px] font-medium text-[#7B8A9A] mb-1.5 block">OpenAI API Key</label>
            <div className="relative">
              <input
                type={showOpenai ? "text" : "password"}
                value={config.apiKeys.openai}
                onChange={(e) =>
                  setConfig({ ...config, apiKeys: { ...config.apiKeys, openai: e.target.value } })
                }
                placeholder="sk-..."
                className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg pr-10 pl-3 py-2 text-[13px] text-[#F0F4F8] font-mono placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
              />
              <button
                onClick={() => setShowOpenai(!showOpenai)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"
              >
                {showOpenai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Channels */}
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

      {/* Security */}
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

      {/* LinkedIn Configuration */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Linkedin className="w-4 h-4 text-[#0A66C2]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">LinkedIn OAuth 2.0</h3>
        </div>
        <div className="space-y-4">
          {/* Client ID */}
          <div>
            <label className="text-[12px] font-medium text-[#7B8A9A] mb-1.5 block">Client ID</label>
            <input
              type="text"
              value={linkedInConfig.clientId}
              onChange={(e) => updateLinkedInConfig({ clientId: e.target.value })}
              placeholder="78abcdefghijk..."
              className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] font-mono placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#0A66C2]/30"
            />
            <p className="text-[11px] text-[#7B8A9A]/60 mt-1">
              Obtenu depuis le LinkedIn Developer Portal → My Apps → Auth
            </p>
          </div>
          {/* Client Secret */}
          <div>
            <label className="text-[12px] font-medium text-[#7B8A9A] mb-1.5 block">Client Secret</label>
            <div className="relative">
              <input
                type={showLiSecret ? "text" : "password"}
                value={linkedInConfig.clientSecret}
                onChange={(e) => updateLinkedInConfig({ clientSecret: e.target.value })}
                placeholder="WPLxxxxxxxxxx"
                className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg pr-10 pl-3 py-2 text-[13px] text-[#F0F4F8] font-mono placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#0A66C2]/30"
              />
              <button
                onClick={() => setShowLiSecret(!showLiSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"
              >
                {showLiSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-[#7B8A9A]/60 mt-1">
              Stocké localement uniquement. Jamais envoyé à nos serveurs.
            </p>
          </div>
          {/* Redirect URI */}
          <div>
            <label className="text-[12px] font-medium text-[#7B8A9A] mb-1.5 block">Redirect URI</label>
            <input
              type="text"
              value={linkedInConfig.redirectUri || `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/linkedin/callback`}
              onChange={(e) => updateLinkedInConfig({ redirectUri: e.target.value })}
              className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] font-mono placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#0A66C2]/30"
            />
            <p className="text-[11px] text-[#7B8A9A]/60 mt-1">
              URL de callback à configurer dans votre app LinkedIn Developer
            </p>
          </div>
          {/* Test Connection */}
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
