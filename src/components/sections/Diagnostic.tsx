"use client";

import { AlertTriangle, Clock, Target, TrendingDown } from "lucide-react";
import SectionReveal from "@/components/ui-custom/SectionReveal";

const diagnostics = [
  {
    icon: Clock,
    title: "Le temps est le goulot d'étranglement",
    description:
      "Un commercial efficace peut contacter 20 à 30 prospects qualifiés par jour. Un agent HERMÈS en contacte 200 à 300, sans fatigue, sans oublis, sans variation de qualité. L'écart se creuse de façon exponentielle dès la première semaine.",
  },
  {
    icon: Target,
    title: "La personnalisation est impossible à l'échelle",
    description:
      "Écrire un message vraiment personnalisé prend 5 à 10 minutes par prospect. Multiplié par 50 contacts par jour, c'est 4 à 8 heures perdues sur une seule tâche de prospection. L'agent Prospection d'HERMÈS le fait en 3 secondes par profil.",
  },
  {
    icon: TrendingDown,
    title: "Le contenu irrégulier détruit votre portée",
    description:
      "L'algorithme LinkedIn pénalise les créateurs qui publient irrégulièrement. Sans un système de génération automatisé, votre présence fluctue, votre audience se refroidit, et vos posts de prospection tombent dans le vide faute d'audience engagée.",
  },
];

export default function Diagnostic() {
  return (
    <section className="relative py-20 sm:py-28 px-5 sm:px-8 bg-[#F4F5F6]">
      <div className="max-w-4xl mx-auto">
        <SectionReveal>
          <div className="inline-flex items-center gap-1.5 bg-[#00D4FF]/10 border border-[#00D4FF]/20 text-[#00D4FF] text-[11px] font-semibold tracking-[0.5px] uppercase px-3 py-1 rounded-full mb-5">
            <AlertTriangle className="w-3 h-3" />
            Partie 1 · Le diagnostic
          </div>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-light tracking-[-1px] text-[#080C10] mb-4 leading-[1.1]">
            Pourquoi l&apos;acquisition LinkedIn
            <br />
            manuelle est une <span className="text-[#00D4FF]">impasse</span>
          </h2>
        </SectionReveal>

        <SectionReveal delay={0.2}>
          <p className="text-base sm:text-[17px] text-[#6B7280] leading-relaxed max-w-2xl mb-12">
            Avant de déployer HERMÈS, il faut comprendre pourquoi le modèle
            classique ne fonctionne plus — et ce que les agents IA viennent
            corriger structurellement.
          </p>
        </SectionReveal>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {diagnostics.map((diag, i) => (
            <SectionReveal key={i} delay={0.2 + i * 0.1}>
              <div className="bg-white border border-[#E2E5EA] rounded-2xl p-6 hover:shadow-lg hover:shadow-black/[0.04] transition-shadow duration-300 h-full">
                <div className="w-9 h-9 rounded-lg bg-[#E5263A]/8 flex items-center justify-center text-[#E5263A] mb-4">
                  <diag.icon className="w-[18px] h-[18px]" />
                </div>
                <h5 className="text-[15px] font-semibold text-[#080C10] mb-2">
                  {diag.title}
                </h5>
                <p className="text-sm text-[#6B7280] leading-relaxed">
                  {diag.description}
                </p>
              </div>
            </SectionReveal>
          ))}
        </div>

        <SectionReveal delay={0.5}>
          <div className="bg-[#00D4FF]/8 border border-[#00D4FF]/20 rounded-2xl p-5 sm:p-6">
            <p className="text-sm text-[#3D4652] leading-relaxed">
              <strong>La bonne nouvelle :</strong> Ces 3 problèmes ont une seule
              solution. Trois agents HERMÈS spécialisés, chacun focalisé sur un
              seul travail, connectés entre eux pour former un pipeline
              d&apos;acquisition entièrement autonome. C&apos;est exactement ce
              que ce guide vous montre à construire.
            </p>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
