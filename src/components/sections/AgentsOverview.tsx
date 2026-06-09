"use client";

import { LayoutGrid, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import SectionReveal from "@/components/ui-custom/SectionReveal";

const agents = [
  {
    num: "AGENT 01",
    name: "Contenu",
    role: "Génération & publication éditoriale",
    features: [
      "Veille des sujets tendance LinkedIn chaque matin",
      "Analyse des formats qui génèrent de l'engagement",
      "Génération de posts avec hooks optimisés",
      "Publication automatique selon un calendrier",
      "Déclencheur : active l'agent Qualification",
    ],
  },
  {
    num: "AGENT 02",
    name: "Qualification",
    role: "Analyse & segmentation du réseau",
    features: [
      "Collecte des interactions sur chaque post publié",
      "Enrichissement des profils (fonction, secteur, taille)",
      "Scoring automatique selon votre ICP (0–100)",
      "Segmentation en listes priorisées",
      "Sortie : fichier de leads vers l'agent Prospection",
    ],
  },
  {
    num: "AGENT 03",
    name: "Prospection",
    role: "Séquences & gestion des réponses",
    features: [
      "Messages ultra-personnalisés par profil",
      "Séquences adaptées à l'historique d'interaction",
      "Relances intelligentes à J+3, J+7, J+14",
      "Filtrage automatique des réponses qualifiées",
      "Sortie : RDVs Calendly créés automatiquement",
    ],
  },
];

const flowNodes = [
  { label: "Agent 01", name: "Contenu" },
  { label: "Déclenche", name: "Collecte interactions" },
  { label: "Agent 02", name: "Qualification" },
  { label: "Produit", name: "Leads qualifiés" },
  { label: "Agent 03", name: "Prospection" },
  { label: "Résultat", name: "RDVs Calendly" },
];

export default function AgentsOverview() {
  return (
    <section className="relative py-20 sm:py-28 px-5 sm:px-8 bg-[#080C10] overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-50" />

      <div className="relative z-10 max-w-4xl mx-auto">
        <SectionReveal>
          <div className="inline-flex items-center gap-1.5 bg-[#00D4FF]/10 border border-[#00D4FF]/15 text-[#00D4FF] text-[11px] font-semibold tracking-[0.5px] uppercase px-3 py-1 rounded-full mb-5">
            <LayoutGrid className="w-3 h-3" />
            Partie 2 · Vue d&apos;ensemble
          </div>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-light tracking-[-1px] text-[#F0F4F8] mb-4 leading-[1.1]">
            Le système à <span className="text-[#00D4FF] text-glow">3 agents HERMÈS</span>
          </h2>
        </SectionReveal>

        <SectionReveal delay={0.2}>
          <p className="text-base sm:text-[17px] text-[#7B8A9A] leading-relaxed max-w-2xl mb-12">
            Chaque agent a une responsabilité unique et des sorties claires qui
            alimentent les agents suivants. Le système fonctionne en continu sans
            votre intervention.
          </p>
        </SectionReveal>

        {/* Agent cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          {agents.map((agent, i) => (
            <SectionReveal key={i} delay={0.2 + i * 0.15}>
              <div className="bg-[#0F1520] border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden group hover:border-[#00D4FF]/20 transition-colors duration-300 h-full">
                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#00D4FF] opacity-80" />

                {/* Glow on hover */}
                <div className="absolute inset-0 bg-[#00D4FF]/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative z-10">
                  <div className="font-mono text-[11px] font-medium text-[#00D4FF] tracking-[1px] mb-3">
                    {agent.num}
                  </div>
                  <h4 className="text-lg font-semibold text-[#F0F4F8] mb-1">
                    {agent.name}
                  </h4>
                  <div className="text-xs text-[#7B8A9A] mb-5">
                    {agent.role}
                  </div>
                  <div className="flex flex-col gap-2">
                    {agent.features.map((feat, j) => (
                      <div
                        key={j}
                        className="flex items-start gap-2.5 text-[13px] text-[#7B8A9A] leading-snug"
                      >
                        <div className="w-1 h-1 rounded-full bg-[#00D4FF] flex-shrink-0 mt-1.5" />
                        {feat}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionReveal>
          ))}
        </div>

        {/* How agents communicate */}
        <SectionReveal delay={0.5}>
          <div className="bg-[#00D4FF]/6 border border-[#00D4FF]/20 rounded-2xl p-5 sm:p-6 mb-8">
            <p className="text-sm text-[#7B8A9A] leading-relaxed">
              <strong className="text-[#F0F4F8]">
                Comment les agents communiquent :
              </strong>{" "}
              L&apos;agent Contenu publie un post → l&apos;agent Qualification
              collecte les interactions et écrit les leads qualifiés dans{" "}
              <code className="text-[#00D4FF] bg-[#00D4FF]/10 px-1.5 py-0.5 rounded text-[12px]">
                data/qualified.json
              </code>{" "}
              → l&apos;agent Prospection lit ce fichier et lance les séquences.
              Les trois partagent un dossier{" "}
              <code className="text-[#00D4FF] bg-[#00D4FF]/10 px-1.5 py-0.5 rounded text-[12px]">
                data/
              </code>{" "}
              commun dans votre workspace HERMÈS.
            </p>
          </div>
        </SectionReveal>

        {/* Flow chart */}
        <SectionReveal delay={0.6}>
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {flowNodes.map((node, i) => (
              <div key={i} className="flex items-center flex-shrink-0">
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  className="bg-[#0F1520] border border-white/[0.06] rounded-lg px-4 py-3 min-w-[130px] text-center"
                >
                  <div className="text-[10px] text-[#7B8A9A] uppercase tracking-[0.5px] mb-1">
                    {node.label}
                  </div>
                  <div className="text-sm font-semibold text-[#F0F4F8]">
                    {node.name}
                  </div>
                </motion.div>
                {i < flowNodes.length - 1 && (
                  <div className="px-2.5 flex-shrink-0 text-[#00D4FF]">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
