"use client";

import { useState } from "react";
import { useAppStore } from "@/store/appStore";
import { Target, Plus, X, Save, CheckCircle2 } from "lucide-react";

export default function ICPView() {
  const { icpConfig, updateICPConfig } = useAppStore();
  const [titles, setTitles] = useState(icpConfig.titles);
  const [sectors, setSectors] = useState(icpConfig.sectors);
  const [companySizes, setCompanySizes] = useState(icpConfig.companySizes);
  const [minScore, setMinScore] = useState(icpConfig.minScore);
  const [newTitle, setNewTitle] = useState("");
  const [newSector, setNewSector] = useState("");
  const [newSize, setNewSize] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateICPConfig({ titles, sectors, companySizes, minScore });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addItem = (
    item: string,
    list: string[],
    setter: (v: string[]) => void,
    clearInput: () => void
  ) => {
    if (item.trim()) {
      setter([...list, item.trim()]);
      clearInput();
    }
  };

  const removeItem = (index: number, list: string[], setter: (v: string[]) => void) => {
    setter(list.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">ICP & Scoring</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">
            Définissez votre Ideal Customer Profile et les critères de scoring des leads
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-lg transition-all cursor-pointer ${
            saved
              ? "text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20"
              : "text-[#080C10] bg-[#00D4FF] hover:bg-[#00AACF]"
          }`}
        >
          {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? "Sauvegardé !" : "Sauvegarder"}
        </button>
      </div>

      {/* Scoring explanation */}
      <div className="bg-[#00D4FF]/6 border border-[#00D4FF]/15 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Comment fonctionne le scoring ICP</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <ScoringRule label="Titre correspond" points={30} color="#00D4FF" />
          <ScoringRule label="Secteur correspond" points={20} color="#A78BFA" />
          <ScoringRule label="Taille entreprise" points={20} color="#F4A100" />
          <ScoringRule label="A commenté" points={15} color="#00C48C" />
          <ScoringRule label="1er degré" points={15} color="#E5263A" />
        </div>
        <p className="text-xs text-[#7B8A9A] mt-3">
          Score maximum : 100. Un lead est qualifié si son score est ≥ {minScore}.
        </p>
      </div>

      {/* ICP Titles */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-[#00D4FF]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Titres cibles (+30 pts chacun)</h3>
        </div>
        <div className="space-y-2 mb-3">
          {titles.map((title, i) => (
            <div key={i} className="flex items-center gap-2 bg-[#18212F] border border-white/[0.04] rounded-lg px-3 py-2">
              <span className="flex-1 text-[13px] text-[#F0F4F8]">{title}</span>
              <button
                onClick={() => removeItem(i, titles, setTitles)}
                className="text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem(newTitle, titles, setTitles, () => setNewTitle(""))}
            placeholder="Ajouter un titre (ex: CTO, Directeur Technique…)"
            className="flex-1 bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
          />
          <button
            onClick={() => addItem(newTitle, titles, setTitles, () => setNewTitle(""))}
            className="flex items-center gap-1 text-[13px] text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-3 py-2 rounded-lg hover:bg-[#00D4FF]/15 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
      </div>

      {/* ICP Sectors */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-[#A78BFA]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Secteurs prioritaires (+20 pts chacun)</h3>
        </div>
        <div className="space-y-2 mb-3">
          {sectors.map((sector, i) => (
            <div key={i} className="flex items-center gap-2 bg-[#18212F] border border-white/[0.04] rounded-lg px-3 py-2">
              <span className="flex-1 text-[13px] text-[#F0F4F8]">{sector}</span>
              <button
                onClick={() => removeItem(i, sectors, setSectors)}
                className="text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newSector}
            onChange={(e) => setNewSector(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem(newSector, sectors, setSectors, () => setNewSector(""))}
            placeholder="Ajouter un secteur (ex: Fintech, E-commerce…)"
            className="flex-1 bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
          />
          <button
            onClick={() => addItem(newSector, sectors, setSectors, () => setNewSector(""))}
            className="flex items-center gap-1 text-[13px] text-[#A78BFA] bg-[#A78BFA]/10 border border-[#A78BFA]/20 px-3 py-2 rounded-lg hover:bg-[#A78BFA]/15 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
      </div>

      {/* Company Size + Min Score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-[#F4A100]" />
            <h3 className="text-sm font-semibold text-[#F0F4F8]">Tailles d&apos;entreprise (+20 pts)</h3>
          </div>
          <div className="space-y-2 mb-3">
            {companySizes.map((size, i) => (
              <div key={i} className="flex items-center gap-2 bg-[#18212F] border border-white/[0.04] rounded-lg px-3 py-2">
                <span className="flex-1 text-[13px] text-[#F0F4F8]">{size}</span>
                <button
                  onClick={() => removeItem(i, companySizes, setCompanySizes)}
                  className="text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem(newSize, companySizes, setCompanySizes, () => setNewSize(""))}
              placeholder="Ajouter une taille"
              className="flex-1 bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
            />
            <button
              onClick={() => addItem(newSize, companySizes, setCompanySizes, () => setNewSize(""))}
              className="flex items-center gap-1 text-[13px] text-[#F4A100] bg-[#F4A100]/10 border border-[#F4A100]/20 px-3 py-2 rounded-lg hover:bg-[#F4A100]/15 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
        </div>

        {/* Min Score */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#F0F4F8] mb-4">Score minimum de qualification</h3>
          <p className="text-xs text-[#7B8A9A] mb-4">
            Les leads avec un score inférieur à ce seuil ne seront pas remontés à l&apos;agent Prospection.
          </p>
          <div className="space-y-3">
            <input
              type="range"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-[#00D4FF]"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#7B8A9A]">0</span>
              <span className="font-mono text-2xl font-medium text-[#00D4FF]">{minScore}</span>
              <span className="text-xs text-[#7B8A9A]">100</span>
            </div>
          </div>
          <div className="mt-4 bg-[#00C48C]/6 border border-[#00C48C]/15 rounded-lg p-3">
            <p className="text-[12px] text-[#7B8A9A] leading-relaxed">
              <span className="text-[#00C48C] font-semibold">Conseil :</span> Commencez avec un threshold élevé (70+) pendant les 2 premières semaines pour valider la qualité des leads avant de le baisser à 60 une fois le système calibré.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoringRule({ label, points, color }: { label: string; points: number; color: string }) {
  return (
    <div className="bg-[#18212F] border border-white/[0.04] rounded-lg p-3 text-center">
      <div className="font-mono text-lg font-medium mb-1" style={{ color }}>
        +{points}
      </div>
      <div className="text-[11px] text-[#7B8A9A]">{label}</div>
    </div>
  );
}
