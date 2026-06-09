"use client";

export default function Footer() {
  return (
    <footer className="bg-[#080C10] border-t border-white/[0.06] px-5 sm:px-8 py-8 mt-auto">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 36 48"
            fill="none"
            className="h-6 w-auto opacity-50"
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
          <div className="flex flex-col">
            <span className="text-[#F0F4F8] text-sm font-light tracking-[-0.5px] opacity-50">
              A.R.C Système
            </span>
          </div>
        </div>

        {/* Right */}
        <div className="text-center sm:text-right">
          <p className="text-[13px] text-[#7B8A9A] leading-relaxed">
            Acquisition LinkedIn 100% automatisée
          </p>
          <p className="text-[12px] text-[#7B8A9A]/40 mt-1">
            © {new Date().getFullYear()} A.R.C Système — Tous droits réservés
          </p>
        </div>
      </div>
    </footer>
  );
}
