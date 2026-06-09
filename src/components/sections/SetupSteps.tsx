"use client";

import { Settings, CheckCircle2 } from "lucide-react";
import SectionReveal from "@/components/ui-custom/SectionReveal";

const steps = [
  {
    num: "01",
    title: "Configurer le workspace HERMÈS",
    description:
      "Créez votre workspace, connectez votre compte LinkedIn, définissez votre ICP (Ideal Customer Profile) et vos préférences éditoriales. L'ensemble prend moins de 30 minutes.",
    tip: "Plus votre ICP est précis, plus les agents produiront des résultats qualitatifs dès le premier jour.",
    tools: ["HERMÈS Dashboard", "LinkedIn API", "ICP Template"],
  },
  {
    num: "02",
    title: "Activer l'agent Contenu",
    description:
      "Paramétrez la fréquence de publication, les sujets de veille, le ton éditorial et les formats favoris. L'agent commence à générer et publier dès la première heure.",
    tip: "Commencez par 3 posts par semaine et montez progressivement. L'algorithme LinkedIn récompense la régularité avant la quantité.",
    tools: ["OpenAI GPT-4", "LinkedIn Publisher", "Trend Analyzer"],
  },
  {
    num: "03",
    title: "Connecter l'agent Qualification",
    description:
      "Définissez vos critères de scoring (secteur, taille d'entreprise, poste, niveau d'engagement). L'agent collecte automatiquement les interactions sur chaque post et génère un fichier de leads qualifiés.",
    tip: "Un score ICP supérieur à 70 signifie que le prospect correspond à votre cible idéale. En dessous de 40, l'agent Prospection ne le contactera pas.",
    tools: ["ICP Scoring Engine", "Profile Enrichment", "Segmentation AI"],
  },
  {
    num: "04",
    title: "Lancer l'agent Prospection",
    description:
      "Rédigez vos templates de séquences (premier message, relance J+3, J+7, J+14). L'agent personnalise chaque message en fonction du profil et de l'historique d'interaction du lead.",
    tip: "Ne jamais envoyer plus de 20 messages par jour depuis un profil LinkedIn personnel. L'agent respecte cette limite automatiquement.",
    tools: ["DM Sequencer", "Personalization AI", "Calendly Integration"],
  },
  {
    num: "05",
    title: "Monitorer et optimiser",
    description:
      "Consultez le tableau de bord HERMÈS chaque semaine pour suivre les métriques clés : taux de réponse, taux de conversion en RDV, qualité des leads. Ajustez les paramètres selon les résultats observés.",
    tip: "Les meilleures améliorations viennent de l'itération sur les scripts de prospection, pas du changement des paramètres système.",
    tools: ["HERMÈS Analytics", "A/B Testing", "Weekly Report"],
  },
];

const codeBlock = `# Structure du workspace HERMÈS
hermes-workspace/
├── agents/
│   ├── contenu.yaml      # Config agent Contenu
│   ├── qualification.yaml # Config agent Qualification
│   └── prospection.yaml   # Config agent Prospection
├── data/
│   ├── posts.json         # Posts publiés
│   ├── interactions.json  # Interactions collectées
│   ├── qualified.json     # Leads qualifiés (ICP > 70)
│   └── sequences.json     # Séquences en cours
├── templates/
│   ├── dm-first.txt       # Premier message
│   ├── dm-followup-j3.txt # Relance J+3
│   ├── dm-followup-j7.txt # Relance J+7
│   └── dm-followup-j14.txt # Relance J+14
└── config.yaml            # Configuration globale`;

export default function SetupSteps() {
  return (
    <section id="setup" className="relative py-20 sm:py-28 px-5 sm:px-8 bg-[#F4F5F6]">
      <div className="max-w-4xl mx-auto">
        <SectionReveal>
          <div className="inline-flex items-center gap-1.5 bg-[#00D4FF]/10 border border-[#00D4FF]/20 text-[#00D4FF] text-[11px] font-semibold tracking-[0.5px] uppercase px-3 py-1 rounded-full mb-5">
            <Settings className="w-3 h-3" />
            Partie 3 · Le setup
          </div>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-light tracking-[-1px] text-[#080C10] mb-4 leading-[1.1]">
            5 étapes pour déployer
            <br />
            votre <span className="text-[#00D4FF]">système HERMÈS</span>
          </h2>
        </SectionReveal>

        <SectionReveal delay={0.2}>
          <p className="text-base sm:text-[17px] text-[#6B7280] leading-relaxed max-w-2xl mb-12">
            Chaque étape est conçue pour être exécutée en moins de 30 minutes.
            Le système complet est opérationnel en une journée.
          </p>
        </SectionReveal>

        {/* Steps */}
        <div className="flex flex-col gap-6 mb-12">
          {steps.map((step, i) => (
            <SectionReveal key={i} delay={0.15 + i * 0.1}>
              <div className="grid grid-cols-1 sm:grid-cols-[56px_1fr] gap-4 sm:gap-6 items-start">
                <div className="font-mono text-[13px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 rounded-lg h-10 flex items-center justify-center">
                  {step.num}
                </div>
                <div>
                  <h5 className="text-base font-semibold text-[#080C10] mb-2">
                    {step.title}
                  </h5>
                  <p className="text-sm text-[#6B7280] leading-relaxed mb-3">
                    {step.description}
                  </p>
                  <div className="bg-[#00C48C]/6 border border-[#00C48C]/20 rounded-lg p-3 mb-3">
                    <div className="flex items-start gap-2 text-[13px] text-[#3D4652] leading-relaxed">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00C48C] flex-shrink-0 mt-0.5" />
                      {step.tip}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {step.tools.map((tool, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center gap-1 bg-[#F4F5F6] border border-[#E2E5EA] text-[#3D4652] text-[12px] font-medium px-2.5 py-1 rounded-full"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </SectionReveal>
          ))}
        </div>

        {/* Code block */}
        <SectionReveal delay={0.7}>
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
              </div>
              <span className="text-xs text-[#7B8A9A] font-mono">
                hermes-workspace/
              </span>
            </div>
            <pre className="p-5 text-[13px] leading-relaxed text-[#F0F4F8] overflow-x-auto font-mono">
              {codeBlock}
            </pre>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
