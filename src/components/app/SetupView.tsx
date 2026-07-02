"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Copy,
  UserPlus,
  Linkedin,
  Sparkles,
  Target,
  Zap,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { useAppStore } from "@/store/appStore";

/**
 * HERMÈS — SetupView (Phase 5.3)
 *
 * Onboarding checklist for new SaaS users. Replaces the old CLI-based
 * setup (which was for the legacy npm package version of HERMÈS).
 *
 * The 5 steps cover:
 *   1. Create your account (NextAuth credentials login)
 *   2. Connect your LinkedIn account (OAuth)
 *   3. Configure your AI provider (Groq recommended — free + fast)
 *   4. Define your ICP (Ideal Customer Profile) for lead scoring
 *   5. Generate your first post (test the AI agent)
 *
 * Each step has a CTA button that navigates the user to the relevant view
 * or opens an external link (LinkedIn Developer, Groq console, etc.).
 */
const steps = [
  {
    num: "01",
    icon: UserPlus,
    title: "Créez votre compte",
    description:
      "Si vous n'avez pas encore de compte, cliquez sur \"Se connecter\" dans la barre latérale et créez un compte avec votre email. Toutes vos données sont isolées (multi-tenant) et chiffrées.",
    tip: "Le compte démo (demo@hermes.app) est disponible pour tester l'interface avant de créer votre propre compte. Mais vos données LinkedIn ne seront pas sauvegardées dessus.",
    ctaLabel: "Aller à la connexion",
    ctaView: "settings" as const,
    done: false,
  },
  {
    num: "02",
    icon: Linkedin,
    title: "Connectez votre compte LinkedIn",
    description:
      "HERMÈS utilise l'API officielle LinkedIn pour publier vos posts, récupérer les likes/comments, et scorer les réacteurs. La connexion OAuth prend 30 secondes.",
    tip: "Vos tokens LinkedIn sont chiffrés en base (AES-256-GCM) et automatiquement rafraîchis toutes les 24h. Vous pouvez révoquer l'accès à tout moment depuis LinkedIn ou depuis HERMÈS.",
    ctaLabel: "Connecter LinkedIn",
    ctaView: "linkedin" as const,
    done: false,
  },
  {
    num: "03",
    icon: Sparkles,
    title: "Configurez votre provider IA",
    description:
      "HERMÈS supporte Groq (recommandé, gratuit), OpenAI, Anthropic, OpenRouter, DeepSeek, et d'autres. Récupérez une clé API Groq gratuite (https://console.groq.com/keys) et collez-la dans les Paramètres.",
    tip: "Groq offre 1000+ requêtes gratuites par jour avec le modèle llama-3.3-70b-versatile — largement suffisant pour générer 10-20 posts + 50 commentaires par jour. Pour usage intensif, basculez sur OpenAI GPT-4o ou Anthropic Claude 3.5 Sonnet.",
    ctaLabel: "Configurer l'IA",
    ctaView: "settings" as const,
    externalUrl: "https://console.groq.com/keys",
    done: false,
  },
  {
    num: "04",
    icon: Target,
    title: "Définissez votre ICP (client idéal)",
    description:
      "L'ICP (Ideal Customer Profile) permet à l'agent Qualification de scorer automatiquement les réacteurs de vos posts. Plus l'ICP est précis, meilleurs sont les leads remontés.",
    tip: "Un bon ICP contient : 3-5 intitulés de poste (ex: \"Head of Growth\", \"CEO SaaS B2B\"), 3-5 secteurs (ex: \"SaaS\", \"Fintech\", \"MarTech\"), et la taille d'entreprise cible (ex: 10-200 employés). Évitez les ICP trop larges (\"tous les décideurs\") qui diluent le scoring.",
    ctaLabel: "Configurer l'ICP",
    ctaView: "icp" as const,
    done: false,
  },
  {
    num: "05",
    icon: Zap,
    title: "Générez votre premier post",
    description:
      "Testez l'agent Contenu en générant votre premier post LinkedIn. Vous pouvez éditer le brouillon, planifier la publication, ou la publier immédiatement. Une fois publié, les métriques (likes, comments) sont synchronisées automatiquement.",
    tip: "Pour maximiser l'engagement, publiez entre 8h-10h ou 17h-19h (heure de Paris) les mardi/mercredi/jeudi. Évitez le week-end sauf si votre audience est très active alors.",
    ctaLabel: "Générer un post",
    ctaView: "agent-contenu" as const,
    done: false,
  },
];

export default function SetupView() {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const setCurrentView = useAppStore((s) => s.setCurrentView);

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

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papier");
  };

  const handleCta = (step: typeof steps[number]) => {
    if (step.ctaView) {
      setCurrentView(step.ctaView);
    }
    if (step.externalUrl) {
      window.open(step.externalUrl, "_blank", "noopener,noreferrer");
    }
    if (!completedSteps.has(step.num)) {
      toggleStep(step.num);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">
          Onboarding — 5 étapes pour démarrer
        </h1>
        <p className="text-sm text-[#7B8A9A] mt-1">
          Configurez HERMÈS en environ 10 minutes pour automatiser votre
          acquisition LinkedIn.
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

      {/* Completion banner */}
      {completedSteps.size === steps.length && (
        <div className="bg-[#00C48C]/10 border border-[#00C48C]/30 rounded-xl px-5 py-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#00C48C] flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#00C48C]">
              Onboarding terminé !
            </p>
            <p className="text-xs text-[#7B8A9A] mt-0.5">
              HERMÈS est prêt. Vos agents vont maintenant travailler en
              arrière-plan pour générer du contenu, qualifier des leads, et
              engager votre audience. Suivez l'activité en temps réel depuis le
              Dashboard.
            </p>
          </div>
        </div>
      )}

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
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span className="font-mono text-xs font-medium">
                      {step.num}
                    </span>
                  )}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <step.icon className="w-4 h-4 text-[#00D4FF]" />
                    <h3
                      className={`text-sm font-semibold ${
                        isDone ? "text-[#7B8A9A] line-through" : "text-[#F0F4F8]"
                      }`}
                    >
                      {step.title}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Step Content */}
              {!isDone && (
                <div className="px-5 pb-5 space-y-3">
                  <p className="text-[13px] text-[#7B8A9A] leading-relaxed">
                    {step.description}
                  </p>

                  {/* CTA Button */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleCta(step)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-black bg-[#00D4FF] hover:bg-[#00D4FF]/90 transition-colors cursor-pointer"
                    >
                      {step.ctaLabel}
                      {step.externalUrl && (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => copyCode(`Étape ${step.num}: ${step.title}`)}
                      className="text-[11px] text-[#7B8A9A] hover:text-[#00D4FF] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      Copier le récap
                    </button>
                  </div>

                  {/* Tip */}
                  <div className="bg-[#00C48C]/6 border border-[#00C48C]/15 rounded-lg p-3">
                    <p className="text-[12px] text-[#7B8A9A] leading-relaxed">
                      <span className="text-[#00C48C] font-semibold">
                        Conseil :
                      </span>{" "}
                      {step.tip}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help footer */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-[#00D4FF] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[#F0F4F8] mb-1">
            Besoin d'aide ?
          </p>
          <p className="text-xs text-[#7B8A9A] leading-relaxed">
            Consultez le guide de déploiement complet dans le fichier{" "}
            <code className="px-1 py-0.5 bg-[#18212F] rounded text-[#00D4FF] font-mono">
              DEPLOYMENT.md
            </code>{" "}
            à la racine du dépôt GitHub. Vous y trouverez toutes les
            instructions pour configurer LinkedIn OAuth, Stripe, les cron jobs
            Render, et le dépannage des erreurs courantes.
          </p>
        </div>
      </div>
    </div>
  );
}
