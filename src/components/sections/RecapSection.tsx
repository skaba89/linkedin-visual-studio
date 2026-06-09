"use client";

import { CheckCircle2, ListChecks } from "lucide-react";
import SectionReveal from "@/components/ui-custom/SectionReveal";

const recapItems = [
  {
    title: "Le diagnostic",
    items: [
      "L'acquisition manuelle LinkedIn est un goulot d'étranglement structurel",
      "Le temps, la personnalisation et la régularité sont les 3 failles du modèle classique",
      "Les agents IA corrigent ces failles de manière systémique",
    ],
  },
  {
    title: "Le système",
    items: [
      "3 agents spécialisés : Contenu, Qualification, Prospection",
      "Pipeline entièrement autonome, du post au RDV Calendly",
      "Communication via un dossier data/ partagé dans le workspace",
    ],
  },
  {
    title: "Le setup",
    items: [
      "5 étapes, moins de 30 minutes chacune",
      "Système opérationnel en une journée",
      "Paramètres ajustables en temps réel depuis le dashboard",
    ],
  },
  {
    title: "Les résultats",
    items: [
      "35 RDVs qualifiés en 45 jours",
      "100% de l'acquisition automatisée",
      "Agents actifs 24h/7j sans intervention humaine",
    ],
  },
];

export default function RecapSection() {
  return (
    <section className="relative py-20 sm:py-28 px-5 sm:px-8 bg-[#080C10] overflow-hidden">
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-50" />
      <div className="relative z-10 max-w-4xl mx-auto">
        <SectionReveal>
          <div className="inline-flex items-center gap-1.5 bg-[#00D4FF]/10 border border-[#00D4FF]/15 text-[#00D4FF] text-[11px] font-semibold tracking-[0.5px] uppercase px-3 py-1 rounded-full mb-5">
            <ListChecks className="w-3 h-3" />
            Récapitulatif
          </div>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-light tracking-[-1px] text-[#F0F4F8] mb-12 leading-[1.1]">
            Ce que vous avez appris
          </h2>
        </SectionReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {recapItems.map((recap, i) => (
            <SectionReveal key={i} delay={0.1 + i * 0.1}>
              <div className="bg-[#0F1520] border border-white/[0.06] rounded-2xl p-5 sm:p-6 h-full hover:border-[#00D4FF]/15 transition-colors duration-300">
                <h5 className="text-[13px] font-semibold text-[#00D4FF] uppercase tracking-[0.5px] mb-3">
                  {recap.title}
                </h5>
                <div className="flex flex-col gap-2.5">
                  {recap.items.map((item, j) => (
                    <div
                      key={j}
                      className="flex items-start gap-2.5 text-sm text-[#7B8A9A] leading-snug"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00C48C] flex-shrink-0 mt-0.5" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
