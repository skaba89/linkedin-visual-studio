"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Navbar from "@/components/sections/Navbar";
import Hero from "@/components/sections/Hero";
import Diagnostic from "@/components/sections/Diagnostic";
import AgentsOverview from "@/components/sections/AgentsOverview";
import SetupSteps from "@/components/sections/SetupSteps";
import ScriptsSection from "@/components/sections/ScriptsSection";
import RoadmapSection from "@/components/sections/RoadmapSection";
import RecapSection from "@/components/sections/RecapSection";
import CTASection from "@/components/sections/CTASection";
import Footer from "@/components/sections/Footer";
import ParticleField from "@/components/ParticleField";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[#080C10] overflow-hidden">
      {/* Animated background gradient that moves with scroll */}
      <motion.div
        style={{ y: backgroundY }}
        className="fixed inset-0 pointer-events-none z-0"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-[radial-gradient(ellipse_at_center,rgba(0,212,255,0.06)_0%,transparent_70%)]" />
        <div className="absolute bottom-0 left-1/4 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(0,196,140,0.04)_0%,transparent_70%)]" />
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(0,212,255,0.03)_0%,transparent_70%)]" />
      </motion.div>

      {/* Particle field */}
      <ParticleField />

      {/* Main content */}
      <div className="relative z-10">
        <Navbar />
        <Hero />
        <Diagnostic />
        <AgentsOverview />
        <SetupSteps />
        <ScriptsSection />
        <RoadmapSection />
        <RecapSection />
        <CTASection />
        <Footer />
      </div>
    </div>
  );
}
