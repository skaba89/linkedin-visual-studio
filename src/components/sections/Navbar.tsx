"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ArrowRight, Menu, X } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#080C10]/95 backdrop-blur-xl border-b border-white/[0.06] shadow-lg shadow-black/20"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-3 group">
          <div className="relative">
            <svg
              viewBox="0 0 36 48"
              fill="none"
              className="h-8 w-auto transition-transform group-hover:scale-105"
            >
              <rect x="0" y="28" width="7" height="16" rx="2" fill="#00D4FF" />
              <rect x="11" y="18" width="7" height="26" rx="2" fill="#00D4FF" />
              <rect x="22" y="8" width="7" height="36" rx="2" fill="#00D4FF" />
              <path
                d="M3.5 28 Q16 4 25.5 8"
                stroke="#00D4FF"
                strokeWidth="1.5"
                fill="none"
                opacity="0.4"
              />
            </svg>
            <div className="absolute inset-0 bg-[#00D4FF]/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex flex-col">
            <span className="text-[#F0F4F8] text-lg font-light tracking-[-0.5px] leading-tight">
              A.R.C
            </span>
            <span className="text-[#7B8A9A] text-[9px] font-medium tracking-[3px] uppercase">
              Système
            </span>
          </div>
        </a>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:inline-flex items-center gap-1.5 bg-[#00D4FF]/10 border border-[#00D4FF]/20 text-[#00D4FF] text-[11px] font-semibold tracking-[0.5px] uppercase px-3 py-1.5 rounded-full">
            <Zap className="w-3 h-3" />
            Ressource exclusive
          </div>
          <a
            href="https://calendly.com/robin-tempe/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 bg-[#00D4FF] text-[#080C10] text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-[#00AACF] active:scale-[0.98] transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]"
          >
            Réserver un appel
            <ArrowRight className="w-3.5 h-3.5" />
          </a>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="sm:hidden p-2 text-[#F0F4F8] hover:text-[#00D4FF] transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="sm:hidden bg-[#0F1520]/98 backdrop-blur-xl border-b border-white/[0.06] overflow-hidden"
          >
            <div className="px-5 py-4 flex flex-col gap-3">
              <a
                href="https://calendly.com/robin-tempe/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#00D4FF] text-[#080C10] text-sm font-semibold px-5 py-2.5 rounded-full"
              >
                Réserver un appel
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
