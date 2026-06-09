"use client";

import { motion } from "framer-motion";
import { Bot, ArrowDown, Calendar, ArrowRight } from "lucide-react";
import AnimatedCounter from "@/components/ui-custom/AnimatedCounter";
import SectionReveal from "@/components/ui-custom/SectionReveal";

const beforeItems = [
  "Journées entières passées en DM sans résultats",
  "Contenu publié de façon irrégulière, faible portée",
  "Prospects contactés manuellement, sans personnalisation",
  "Dépendance à un SDR ou assistant pour prospecter",
  "Pipeline vide le week-end et pendant les vacances",
];

const afterItems = [
  "3 agents actifs 24h/7j, zéro intervention manuelle",
  "Posts générés, optimisés et publiés automatiquement",
  "Prospects qualifiés en temps réel selon votre ICP",
  "Séquences ultra-personnalisées envoyées sans effort",
  "35 RDVs qualifiés générés en 45 jours",
];

export default function Hero() {
  return (
    <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 px-5 sm:px-8 overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 grid-pattern pointer-events-none" />

      {/* Top gradient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(0,212,255,0.1)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Eyebrow */}
        <SectionReveal delay={0.1}>
          <div className="inline-flex items-center gap-2 bg-[#00D4FF]/10 border border-[#00D4FF]/20 text-[#00D4FF] text-[11px] font-semibold tracking-[0.5px] uppercase px-3.5 py-1.5 rounded-full mb-8">
            <Bot className="w-3.5 h-3.5" />
            Agents IA LinkedIn · Guide complet HERMÈS
          </div>
        </SectionReveal>

        {/* Title */}
        <SectionReveal delay={0.2}>
          <h1 className="text-[clamp(2.2rem,5.5vw,4.2rem)] font-light leading-[1.05] tracking-[-2px] text-[#F0F4F8] mb-6">
            35 RDVs générés
            <br />
            avec <span className="text-[#00D4FF] text-glow">3 agents HERMÈS</span>
            <br />
            100 % autonomes
          </h1>
        </SectionReveal>

        {/* Subtitle */}
        <SectionReveal delay={0.3}>
          <p className="text-lg text-[#7B8A9A] leading-relaxed max-w-xl mb-10">
            Sans assistant. Sans SDR. Sans passer vos journées en DM. Ce guide
            vous montre exactement comment paramétrer les 3 agents HERMÈS qui
            gèrent votre acquisition LinkedIn de bout en bout, 24h/7j.
          </p>
        </SectionReveal>

        {/* CTAs */}
        <SectionReveal delay={0.4}>
          <div className="flex flex-col sm:flex-row gap-3 mb-16">
            <a
              href="#setup"
              className="inline-flex items-center justify-center gap-2.5 bg-[#00D4FF] text-[#080C10] text-base font-semibold px-8 py-4 rounded-full hover:bg-[#00AACF] active:scale-[0.98] transition-all duration-200 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)]"
            >
              Voir le setup complet
              <ArrowDown className="w-4.5 h-4.5" />
            </a>
            <a
              href="https://calendly.com/robin-tempe/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-transparent text-[#F0F4F8] text-sm font-semibold px-5 py-3 rounded-full border border-white/20 hover:border-white/40 transition-colors duration-200"
            >
              Parler à Robin
              <Calendar className="w-4 h-4" />
            </a>
          </div>
        </SectionReveal>

        {/* Before/After */}
        <SectionReveal delay={0.5}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center mb-8">
            {/* Before */}
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-2xl p-6">
              <div className="text-[11px] font-semibold tracking-[0.5px] uppercase text-[#7B8A9A] mb-4">
                Avant HERMÈS
              </div>
              <div className="flex flex-col gap-2.5">
                {beforeItems.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                    className="flex items-start gap-2.5 text-sm text-[#F0F4F8] leading-snug"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E5263A] flex-shrink-0 mt-1.5" />
                    {item}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex flex-col items-center gap-2 text-[#00D4FF] px-3">
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowRight className="w-6 h-6" />
              </motion.div>
              <span className="text-[11px] font-medium text-[#7B8A9A] text-center leading-tight">
                Après
                <br />
                déploiement
              </span>
            </div>

            {/* After */}
            <div className="bg-[#0F1520] border border-[#00D4FF]/10 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00D4FF]/40 to-transparent" />
              <div className="text-[11px] font-semibold tracking-[0.5px] uppercase text-[#7B8A9A] mb-4">
                Avec 3 agents HERMÈS
              </div>
              <div className="flex flex-col gap-2.5">
                {afterItems.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 + i * 0.1 }}
                    className="flex items-start gap-2.5 text-sm text-[#F0F4F8] leading-snug"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00C48C] flex-shrink-0 mt-1.5" />
                    {item}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </SectionReveal>

        {/* Metrics band */}
        <SectionReveal delay={0.6}>
          <div className="grid grid-cols-1 sm:grid-cols-3 border border-white/[0.06] rounded-2xl overflow-hidden">
            {[
              {
                value: 35,
                suffix: "",
                label: "RDVs qualifiés en 45 jours",
              },
              {
                value: 100,
                suffix: "%",
                label: "Acquisition automatisée",
              },
              {
                value: 24,
                suffix: "/7",
                label: "Agents actifs en continu",
              },
            ].map((metric, i) => (
              <div
                key={i}
                className="p-6 text-center bg-[#0F1520] border-b sm:border-b-0 first:border-r sm:border-r border-white/[0.06] last:border-r-0"
              >
                <span className="block font-mono text-4xl font-medium text-[#00D4FF] tracking-[-1px] mb-1 text-glow">
                  <AnimatedCounter
                    end={metric.value}
                    suffix={metric.suffix}
                    duration={2500}
                  />
                </span>
                <span className="text-xs text-[#7B8A9A] font-medium">
                  {metric.label}
                </span>
              </div>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
