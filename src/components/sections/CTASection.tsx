"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import SectionReveal from "@/components/ui-custom/SectionReveal";

export default function CTASection() {
  return (
    <section className="relative py-24 sm:py-32 px-5 sm:px-8 bg-[#080C10] overflow-hidden text-center">
      {/* Grid pattern */}
      <div className="absolute inset-0 grid-pattern pointer-events-none" />

      {/* Radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(0,212,255,0.1)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative z-10 max-w-xl mx-auto">
        <SectionReveal>
          <div className="inline-flex items-center gap-1.5 bg-[#00D4FF]/10 border border-[#00D4FF]/20 text-[#00D4FF] text-[11px] font-semibold tracking-[0.5px] uppercase px-3 py-1 rounded-full mb-8">
            <Sparkles className="w-3 h-3" />
            Prêt à automatiser ?
          </div>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-light tracking-[-1.5px] text-[#F0F4F8] mb-4 leading-[1.05]">
            Passez à l&apos;action
            <br />
            avec <span className="text-[#00D4FF] text-glow">HERMÈS</span>
          </h2>
        </SectionReveal>

        <SectionReveal delay={0.2}>
          <p className="text-base sm:text-[17px] text-[#7B8A9A] leading-relaxed mb-10">
            Réservez un appel de 30 minutes avec Robin pour découvrir comment
            déployer les 3 agents HERMÈS dans votre entreprise et commencer à
            générer des RDVs qualifiés dès la première semaine.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.3}>
          <motion.a
            href="https://calendly.com/robin-tempe/30min"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-3 bg-[#00D4FF] text-[#080C10] text-base font-semibold px-10 py-4 rounded-full hover:bg-[#00AACF] transition-colors duration-200 shadow-[0_0_30px_rgba(0,212,255,0.25)] hover:shadow-[0_0_40px_rgba(0,212,255,0.35)]"
          >
            Réserver un appel
            <ArrowRight className="w-5 h-5" />
          </motion.a>
          <p className="text-[13px] text-[#7B8A9A]/70 mt-4">
            Appel gratuit · Sans engagement · 30 minutes
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}
