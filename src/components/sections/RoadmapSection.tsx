"use client";

import { Map } from "lucide-react";
import SectionReveal from "@/components/ui-custom/SectionReveal";

const roadmap = [
  {
    week: "Semaine 1",
    title: "Fondations",
    tasks: [
      "Créer le workspace HERMÈS",
      "Connecter le compte LinkedIn",
      "Définir l'ICP et les critères de scoring",
      "Paramétrer l'agent Contenu",
    ],
    goal: "Premier post publié automatiquement",
  },
  {
    week: "Semaine 2",
    title: "Qualification",
    tasks: [
      "Activer l'agent Qualification",
      "Vérifier les premiers scores ICP",
      "Ajuster les critères si nécessaire",
      "Connecter l'enrichissement de profils",
    ],
    goal: "Premiers leads qualifiés identifiés",
  },
  {
    week: "Semaine 3",
    title: "Prospection",
    tasks: [
      "Rédiger les templates de messages",
      "Activer l'agent Prospection",
      "Connecter Calendly pour les RDVs",
      "Lancer les premières séquences",
    ],
    goal: "Premiers messages de prospection envoyés",
  },
  {
    week: "Semaine 4+",
    title: "Optimisation",
    tasks: [
      "Analyser les métriques de la semaine 3",
      "A/B tester les scripts de prospection",
      "Ajuster la fréquence de publication",
      "Passer à 5 posts par semaine",
    ],
    goal: "35 RDVs qualifiés en 45 jours",
  },
];

export default function RoadmapSection() {
  return (
    <section className="relative py-20 sm:py-28 px-5 sm:px-8 bg-[#F4F5F6]">
      <div className="max-w-4xl mx-auto">
        <SectionReveal>
          <div className="inline-flex items-center gap-1.5 bg-[#00D4FF]/10 border border-[#00D4FF]/20 text-[#00D4FF] text-[11px] font-semibold tracking-[0.5px] uppercase px-3 py-1 rounded-full mb-5">
            <Map className="w-3 h-3" />
            Partie 5 · La roadmap
          </div>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-light tracking-[-1px] text-[#080C10] mb-4 leading-[1.1]">
            De zéro à <span className="text-[#00D4FF]">35 RDVs</span>
            <br />
            en 45 jours
          </h2>
        </SectionReveal>

        <SectionReveal delay={0.2}>
          <p className="text-base sm:text-[17px] text-[#6B7280] leading-relaxed max-w-2xl mb-12">
            Un déploiement progressif qui maximise l&apos;apprentissage des agents
            et garantit des résultats mesurables à chaque étape.
          </p>
        </SectionReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {roadmap.map((step, i) => (
            <SectionReveal key={i} delay={0.2 + i * 0.1}>
              <div className="bg-white border border-[#E2E5EA] rounded-2xl p-6 relative overflow-hidden h-full hover:shadow-lg hover:shadow-black/[0.04] transition-shadow duration-300">
                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#00D4FF]" />

                <div className="font-mono text-[11px] font-medium text-[#00D4FF] tracking-[0.5px] uppercase mb-2">
                  {step.week}
                </div>
                <h5 className="text-sm font-semibold text-[#080C10] mb-3.5">
                  {step.title}
                </h5>
                <ul className="flex flex-col gap-2 mb-4">
                  {step.tasks.map((task, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2 text-[13px] text-[#3D4652] leading-snug"
                    >
                      <span className="text-[#00D4FF] flex-shrink-0 text-sm mt-[-1px]">
                        •
                      </span>
                      {task}
                    </li>
                  ))}
                </ul>
                <div className="bg-[#00D4FF]/8 border border-[#00D4FF]/15 rounded-lg p-2.5 text-[12px] text-[#00D4FF] font-medium leading-snug">
                  {step.goal}
                </div>
              </div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
