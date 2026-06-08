"use client";

import { useState } from "react";
import { MessageSquare, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SectionReveal from "@/components/ui-custom/SectionReveal";

const tabs = [
  { id: "first", label: "1er message", icon: "💬" },
  { id: "j3", label: "Relance J+3", icon: "🔄" },
  { id: "j7", label: "Relance J+7", icon: "📅" },
];

const scripts = {
  first: {
    num: 1,
    title: "Premier contact après interaction",
    timing: "Dans les 2h suivant l'interaction",
    context:
      "Le prospect a liké ou commenté un de vos posts. L'agent Qualification l'a scoré au-dessus de 70/100 sur votre ICP.",
    text: `Bonjour {prénom},

J'ai remarqué votre interaction sur mon post concernant {sujet_du_post}. Votre profil m'a interpelé — en tant que {fonction} chez {entreprise}, vous devez probablement faire face à {douleur_ICP}.

Plusieurs de nos clients dans le {secteur} ont résolu ce problème en {solution_courte}.

Ça vous dirait d'échanger 15 min pour voir si ça pourrait correspondre à votre situation ?

Robin`,
    notes: [
      "Le message est envoyé en DM LinkedIn, pas en InMail",
      "Le délai de 2h maximise le taux de réponse (le prospect est encore en ligne)",
      "La personnalisation provient du profil LinkedIn enrichi par l'agent Qualification",
      "Le lien Calendly n'est pas inclus dans le premier message (trop agressif)",
    ],
  },
  j3: {
    num: 2,
    title: "Relance douce à J+3",
    timing: "3 jours après le 1er message sans réponse",
    context:
      "Le prospect n'a pas répondu au premier message. L'agent vérifie s'il a vu le message et envoie une relance contextualisée.",
    text: `{prénom}, je me permets de revenir vers vous.

J'ai publié un nouveau post hier sur {nouveau_sujet} qui rejoint exactement le défi dont je vous parlais.

Si le timing n'est pas bon, pas de souci — dites-le moi et je ne vous relancerai plus.

Robin`,
    notes: [
      "Toujours offrir une porte de sortie (réduit le sentiment de pression)",
      "Le nouveau post sert de prétexte naturel à la relance",
      "Taux de réponse moyen sur cette relance : 35-40%",
      "L'agent ne relance jamais un prospect qui a marqué le message comme lu sans répondre",
    ],
  },
  j7: {
    num: 3,
    title: "Relance finale à J+7",
    timing: "7 jours après le 1er message, 4 jours après la relance J+3",
    context:
      "Le prospect n'a répondu ni au premier message ni à la relance. Dernière tentative avec une approche différente.",
    text: `Dernier message {prénom} 👋

Je comprends que le timing n'est peut-être pas le bon.

Si ça devient pertinent dans les prochaines semaines, voici mon lien pour réserver un créneau directement : {lien_calendly}

Bonne continuation pour vos projets !

Robin`,
    notes: [
      "Le lien Calendly est inclus uniquement à cette étape (le prospect est désormais 'tiède')",
      "L'agent arrête toute séquence après ce message",
      "Le prospect est tagué 'froid' dans le CRM et requalifié automatiquement 30 jours plus tard",
      "Taux de conversion sur cette relance : 10-15%",
    ],
  },
};

export default function ScriptsSection() {
  const [activeTab, setActiveTab] = useState("first");
  const script = scripts[activeTab as keyof typeof scripts];

  return (
    <section className="relative py-20 sm:py-28 px-5 sm:px-8 bg-[#080C10] overflow-hidden">
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-50" />
      <div className="relative z-10 max-w-4xl mx-auto">
        <SectionReveal>
          <div className="inline-flex items-center gap-1.5 bg-[#00D4FF]/10 border border-[#00D4FF]/15 text-[#00D4FF] text-[11px] font-semibold tracking-[0.5px] uppercase px-3 py-1 rounded-full mb-5">
            <MessageSquare className="w-3 h-3" />
            Partie 4 · Les scripts de prospection
          </div>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-light tracking-[-1px] text-[#F0F4F8] mb-4 leading-[1.1]">
            Les scripts de prospection
            <br />
            <span className="text-[#00D4FF] text-glow">prêts à l'emploi</span>
          </h2>
        </SectionReveal>

        <SectionReveal delay={0.2}>
          <p className="text-base sm:text-[17px] text-[#7B8A9A] leading-relaxed max-w-2xl mb-8">
            Chaque script est conçu pour être personnalisé automatiquement par
            l&apos;agent Prospection. Les variables entre accolades sont remplies
            dynamiquement à partir du profil LinkedIn du prospect.
          </p>
        </SectionReveal>

        {/* Tabs */}
        <SectionReveal delay={0.3}>
          <div className="flex gap-2 mb-6 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 text-[13px] font-medium px-4 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-[#00D4FF]/10 border-[#00D4FF]/30 text-[#00D4FF]"
                    : "bg-[#18212F] border-white/[0.06] text-[#7B8A9A] hover:text-[#F0F4F8] hover:border-white/[0.12]"
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </SectionReveal>

        {/* Script card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white border border-[#E2E5EA] rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E5EA] bg-[#F4F5F6]">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/20 text-[#00D4FF] text-[13px] font-semibold flex items-center justify-center">
                  {script.num}
                </div>
                <h5 className="text-[15px] font-semibold text-[#080C10]">
                  {script.title}
                </h5>
              </div>
              <div className="inline-flex items-center gap-1 text-[12px] text-[#6B7280] bg-[#E8EAED] px-2.5 py-1 rounded-full">
                <Clock className="w-3 h-3" />
                {script.timing}
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-[13px] text-[#6B7280] mb-4 leading-relaxed">
                {script.context}
              </p>
              <div className="bg-[#F4F5F6] border border-[#E2E5EA] rounded-lg p-4 text-[14px] text-[#3D4652] leading-relaxed whitespace-pre-line mb-4">
                {script.text.split("{").map((part, i) => {
                  if (i === 0) return part;
                  const closingBrace = part.indexOf("}");
                  if (closingBrace === -1) return part;
                  const variable = part.substring(0, closingBrace);
                  const rest = part.substring(closingBrace + 1);
                  return (
                    <span key={i}>
                      <span className="text-[#00D4FF] font-medium">
                        {variable}
                      </span>
                      {rest}
                    </span>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2">
                {script.notes.map((note, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-[13px] text-[#6B7280] leading-relaxed"
                  >
                    <span className="text-[#00D4FF] flex-shrink-0 text-xs mt-0.5">
                      →
                    </span>
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
