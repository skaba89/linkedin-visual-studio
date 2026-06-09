"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Terminal, Server, Key, FolderTree } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: Server,
    title: "Prérequis — Node.js 22+ et un VPS",
    description:
      "Vérifiez que Node.js 22 ou supérieur est installé sur votre machine ou votre VPS. Recommandé : un VPS dédié (DigitalOcean, Hetzner, AWS Lightsail) pour que les agents tournent en continu.",
    tip: "Choisissez un VPS à au moins 2 vCPU et 4 Go de RAM. Budget typique : 8 à 15 €/mois. Stockez toutes vos clés API dans des variables d'environnement, jamais en dur dans le code.",
    code: `node --version  # doit afficher v22+\nnpm --version   # doit afficher 10+`,
    done: false,
  },
  {
    num: "02",
    icon: Terminal,
    title: "Installer HERMÈS via npm",
    description:
      "Lancez les commandes ci-dessous pour installer le gateway, le configurer comme service système et démarrer l'interface web locale.",
    tip: "L'interface web est accessible sur http://localhost:18789. Depuis cette interface, vous pouvez créer des agents, installer des skills et monitorer les logs en temps réel.",
    code: `# Installer HERMÈS globalement\nnpm install -g hermes-ai@latest\n\n# Initialiser le service et installer le démon système\nhermes onboard --install-daemon\n\n# Connecter vos canaux (LinkedIn, Slack, Telegram…)\nhermes channels login\n\n# Démarrer le gateway (port par défaut : 18789)\nhermes gateway --port 18789\n\n# Vérifier l'état du service\nhermes status\nhermes doctor`,
    done: false,
  },
  {
    num: "03",
    icon: Key,
    title: "Configurer les clés API et le fichier de config",
    description:
      "Éditez le fichier de configuration principal ~/.hermes/hermes.json pour renseigner vos clés API, définir les modèles IA à utiliser et autoriser les canaux.",
    tip: "Utilisez toujours des variables d'environnement plutôt que des clés en dur. Les providers gratuits (Groq, Gemini, Cerebras, SambaNova) sont recommandés pour démarrer sans frais.",
    code: `// ~/.hermes/hermes.json\n{\n  "provider": "groq",\n  "model": "llama-3.3-70b-versatile",\n  "provider_api_keys": {\n    "groq":       "$GROQ_API_KEY",\n    "google":     "$GOOGLE_API_KEY",\n    "openrouter": "$OPENROUTER_API_KEY",\n    "cerebras":   "$CEREBRAS_API_KEY",\n    "deepseek":   "$DEEPSEEK_API_KEY",\n    "anthropic":  "$ANTHROPIC_API_KEY",\n    "openai":     "$OPENAI_API_KEY"\n  },\n  "channels": ["slack", "discord", "telegram"],\n  "security": {\n    "allow_shell": true,\n    "allow_browser": true,\n    "forbidden_commands": ["rm -rf", "drop table"]\n  }\n}`,
    done: false,
  },
  {
    num: "04",
    icon: FolderTree,
    title: "Créer les 3 agents et la structure de dossiers",
    description:
      "Chaque agent vit dans son propre dossier avec son fichier SKILL.md (définition des tâches) et son fichier HEARTBEAT.md (planification).",
    tip: "Le dossier data/ est le point central de communication entre vos 3 agents. L'agent Contenu y écrit les métriques, le Qualif y écrit les leads scorés, le Prospection y lit les leads à contacter.",
    code: `# Créer les 3 agents depuis la CLI\nhermes new-agent --name contenu-bot\nhermes new-agent --name qualif-bot\nhermes new-agent --name prospection-bot\n\n# Structure générée automatiquement\nagents/\n├── contenu-bot/\n│   ├── SKILL.md        # Définition des tâches\n│   └── HEARTBEAT.md    # Planning d'exécution\n├── qualif-bot/\n│   ├── SKILL.md\n│   └── HEARTBEAT.md\n├── prospection-bot/\n│   ├── SKILL.md\n│   └── HEARTBEAT.md\n└── data/              # Dossier partagé entre agents\n    ├── network.json\n    └── qualified.json`,
    done: false,
  },
];

export default function SetupView() {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  const toggleStep = (num: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return next;
    });
  };

  const copyCode = (code: string, stepNum: string) => {
    navigator.clipboard.writeText(code);
    setCopiedStep(stepNum);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Installation & Configuration</h1>
        <p className="text-sm text-[#7B8A9A] mt-1">
          Déployez HERMÈS en 4 étapes — environ 15 minutes
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 bg-[#0F1520] border border-white/[0.06] rounded-xl px-4 py-3">
        <div className="flex-1">
          <div className="flex h-2 rounded-full overflow-hidden bg-[#18212F]">
            <div
              className="bg-[#00D4FF] transition-all duration-500"
              style={{ width: `${(completedSteps.size / steps.length) * 100}%` }}
            />
          </div>
        </div>
        <span className="text-xs font-medium text-[#00D4FF]">
          {completedSteps.size}/{steps.length} terminées
        </span>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step) => {
          const isDone = completedSteps.has(step.num);
          return (
            <div
              key={step.num}
              className={`bg-[#0F1520] border rounded-xl overflow-hidden transition-colors duration-200 ${
                isDone ? "border-[#00C48C]/30" : "border-white/[0.06]"
              }`}
            >
              {/* Step Header */}
              <div className="flex items-center gap-4 px-5 py-4">
                <button
                  onClick={() => toggleStep(step.num)}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                    isDone
                      ? "bg-[#00C48C]/10 border-[#00C48C]/30 text-[#00C48C]"
                      : "bg-[#18212F] border-white/[0.06] text-[#7B8A9A]"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : (
                    <span className="font-mono text-xs font-medium">{step.num}</span>
                  )}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <step.icon className="w-4 h-4 text-[#00D4FF]" />
                    <h3 className={`text-sm font-semibold ${isDone ? "text-[#7B8A9A] line-through" : "text-[#F0F4F8]"}`}>
                      {step.title}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Step Content */}
              {!isDone && (
                <div className="px-5 pb-5 space-y-3">
                  <p className="text-[13px] text-[#7B8A9A] leading-relaxed">{step.description}</p>

                  {/* Code block */}
                  <div className="bg-[#080C10] border border-white/[0.06] rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                      <span className="text-[11px] text-[#7B8A9A] font-mono">Terminal</span>
                      <button
                        onClick={() => copyCode(step.code, step.num)}
                        className="text-[11px] text-[#7B8A9A] hover:text-[#00D4FF] flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedStep === step.num ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-[#00C48C]" />
                            <span className="text-[#00C48C]">Copié !</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copier
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-4 text-[12px] leading-relaxed text-[#F0F4F8] overflow-x-auto font-mono whitespace-pre">
                      {step.code}
                    </pre>
                  </div>

                  {/* Tip */}
                  <div className="bg-[#00C48C]/6 border border-[#00C48C]/15 rounded-lg p-3">
                    <p className="text-[12px] text-[#7B8A9A] leading-relaxed">
                      <span className="text-[#00C48C] font-semibold">Conseil :</span> {step.tip}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
