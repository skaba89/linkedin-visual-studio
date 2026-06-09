"use client";

import { useState } from "react";
import { useAppStore } from "@/store/appStore";
import { MessageSquare, Save, CheckCircle2, Copy, Clock } from "lucide-react";

export default function TemplatesView() {
  const { templates, updateTemplate } = useAppStore();
  const [activeId, setActiveId] = useState(templates[0]?.id || "");
  const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeTemplate = templates.find((t) => t.id === activeId);

  const handleContentChange = (id: string, content: string) => {
    setEditedTemplates((prev) => ({ ...prev, [id]: content }));
  };

  const handleSave = () => {
    Object.entries(editedTemplates).forEach(([id, content]) => {
      updateTemplate(id, { content });
    });
    setEditedTemplates({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Templates de messages</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">
            4 templates de prospection personnalisables — les variables [entre crochets] sont remplies dynamiquement par l&apos;agent
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
          {saved ? "Sauvegardé !" : "Sauvegarder tout"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={`flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-lg border whitespace-nowrap transition-all cursor-pointer ${
              activeId === t.id
                ? "bg-[#00D4FF]/10 border-[#00D4FF]/25 text-[#00D4FF]"
                : "bg-[#0F1520] border-white/[0.06] text-[#7B8A9A] hover:text-[#F0F4F8] hover:border-white/[0.12]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {t.name.split("—")[0].trim()}
          </button>
        ))}
      </div>

      {/* Active template */}
      {activeTemplate && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Editor */}
          <div className="lg:col-span-2 bg-[#0F1520] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <div>
                <h3 className="text-sm font-semibold text-[#F0F4F8]">{activeTemplate.name}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3 h-3 text-[#7B8A9A]" />
                  <span className="text-[11px] text-[#7B8A9A]">{activeTemplate.timing}</span>
                </div>
              </div>
              <button
                onClick={() => handleCopy(editedTemplates[activeId] || activeTemplate.content, activeId)}
                className="text-[11px] text-[#7B8A9A] hover:text-[#00D4FF] flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedId === activeId ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-[#00C48C]" />
                    <span className="text-[#00C48C]">Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copier
                  </>
                )}
              </button>
            </div>
            <textarea
              value={editedTemplates[activeId] || activeTemplate.content}
              onChange={(e) => handleContentChange(activeId, e.target.value)}
              className="w-full min-h-[250px] p-5 bg-transparent text-[14px] leading-relaxed text-[#F0F4F8] font-mono resize-y focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* Notes */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Notes</h3>
            <div className="space-y-2">
              {activeTemplate.notes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px] text-[#7B8A9A] leading-relaxed">
                  <span className="text-[#00D4FF] flex-shrink-0 mt-0.5">→</span>
                  {note}
                </div>
              ))}
            </div>

            {/* Variables reference */}
            <div className="mt-6 pt-4 border-t border-white/[0.06]">
              <h4 className="text-xs font-semibold text-[#7B8A9A] uppercase tracking-wide mb-2">Variables disponibles</h4>
              <div className="space-y-1.5">
                {[
                  "[prénom]",
                  "[poste]",
                  "[entreprise]",
                  "[secteur]",
                  "[sujet du post]",
                  "[lien Calendly]",
                ].map((v) => (
                  <div key={v} className="text-[12px] font-mono text-[#00D4FF] bg-[#00D4FF]/5 px-2 py-1 rounded">
                    {v}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
