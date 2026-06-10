"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Users,
  Kanban,
  Plus,
  Search,
  Mail,
  Phone,
  ExternalLink,
  ChevronRight,
  X,
  GripVertical,
  TrendingUp,
  DollarSign,
  Target,
  Calendar,
  Tag,
  RefreshCw,
  Edit3,
  Trash2,
  ArrowRight,
} from "lucide-react";
import {
  type ContactData,
  type DealData,
  type DealStage,
  type PipelineSummary,
  DEAL_STAGES,
  getDealStageLabel,
  getDealStageColor,
  isDealActive,
} from "@/lib/crm/types";
import {
  formatCurrency,
  formatPipelineValue,
  computePipelineSummary,
} from "@/lib/crm/crm-engine";

type CRMTab = "pipeline" | "contacts" | "deals";

// ---- Sub-components ----

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#00C48C" : score >= 60 ? "#00D4FF" : score >= 40 ? "#F4A100" : "#7B8A9A";
  return (
    <div className="flex items-center gap-1">
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: color + "20", color }}>
        {score}
      </div>
    </div>
  );
}

function StatusBadge({ status, color }: { status: string; color: string }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={{ backgroundColor: color + "10", color, borderColor: color + "30" }}>
      {status}
    </span>
  );
}

// ---- Contact Form Dialog ----

function ContactFormDialog({
  open,
  onClose,
  onSave,
  contact,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<ContactData>) => void;
  contact?: ContactData | null;
}) {
  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    entreprise: "",
    poste: "",
    secteur: "",
    siteWeb: "",
    linkedinUrl: "",
    source: "manual",
    notes: "",
    tags: "",
  });

  useEffect(() => {
    if (contact) {
      setForm({
        prenom: contact.prenom,
        nom: contact.nom,
        email: contact.email,
        telephone: contact.telephone ?? "",
        entreprise: contact.entreprise,
        poste: contact.poste,
        secteur: contact.secteur,
        siteWeb: contact.siteWeb ?? "",
        linkedinUrl: contact.linkedinUrl ?? "",
        source: contact.source,
        notes: contact.notes ?? "",
        tags: contact.tags.join(", "),
      });
    } else {
      setForm({ prenom: "", nom: "", email: "", telephone: "", entreprise: "", poste: "", secteur: "", siteWeb: "", linkedinUrl: "", source: "manual", notes: "", tags: "" });
    }
  }, [contact, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0F1520] border border-white/[0.08] rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#F0F4F8]">{contact ? "Modifier le contact" : "Nouveau contact"}</h3>
          <button onClick={onClose} className="text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} placeholder="Prenom *" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
            <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Nom" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
            <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="Telephone" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.entreprise} onChange={(e) => setForm({ ...form, entreprise: e.target.value })} placeholder="Entreprise" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
            <input value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} placeholder="Poste" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.secteur} onChange={(e) => setForm({ ...form, secteur: e.target.value })} placeholder="Secteur" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30">
              <option value="manual">Manuel</option>
              <option value="linkedin">LinkedIn</option>
              <option value="email">Email</option>
              <option value="import">Import</option>
              <option value="agent-qualif">Agent Qualification</option>
              <option value="website">Site web</option>
            </select>
          </div>
          <input value={form.siteWeb} onChange={(e) => setForm({ ...form, siteWeb: e.target.value })} placeholder="Site web" className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          <input value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="URL LinkedIn" className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags (separes par virgules)" className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" rows={2} className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          <div className="flex gap-2 pt-1">
            <button onClick={() => { onSave({ ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) }); onClose(); }} className="text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-4 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer">
              {contact ? "Enregistrer" : "Creer"}
            </button>
            <button onClick={onClose} className="text-[13px] font-medium text-[#7B8A9A] bg-[#18212F] px-4 py-2 rounded-lg hover:text-[#F0F4F8] transition-colors cursor-pointer">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Deal Form Dialog ----

function DealFormDialog({
  open,
  onClose,
  onSave,
  contacts,
  deal,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<DealData>) => void;
  contacts: ContactData[];
  deal?: DealData | null;
}) {
  const [form, setForm] = useState({
    contactId: "",
    titre: "",
    valeur: 0,
    devise: "EUR",
    stage: "prospect" as DealStage,
    probabilite: 20,
    dateCloturePrevue: "",
    sourceCanal: "",
    notes: "",
  });

  useEffect(() => {
    if (deal) {
      setForm({
        contactId: deal.contactId,
        titre: deal.titre,
        valeur: deal.valeur,
        devise: deal.devise,
        stage: deal.stage,
        probabilite: deal.probabilite,
        dateCloturePrevue: deal.dateCloturePrevue ?? "",
        sourceCanal: deal.sourceCanal ?? "",
        notes: deal.notes ?? "",
      });
    } else {
      setForm({ contactId: "", titre: "", valeur: 0, devise: "EUR", stage: "prospect", probabilite: 20, dateCloturePrevue: "", sourceCanal: "", notes: "" });
    }
  }, [deal, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0F1520] border border-white/[0.08] rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#F0F4F8]">{deal ? "Modifier le deal" : "Nouveau deal"}</h3>
          <button onClick={onClose} className="text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })} className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30">
            <option value="">Selectionner un contact *</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom} - {c.entreprise}</option>
            ))}
          </select>
          <input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Titre du deal *" className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={form.valeur} onChange={(e) => setForm({ ...form, valeur: parseFloat(e.target.value) || 0 })} placeholder="Valeur (EUR)" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
            <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as DealStage })} className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30">
              {DEAL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min={0} max={100} value={form.probabilite} onChange={(e) => setForm({ ...form, probabilite: parseInt(e.target.value) || 0 })} placeholder="Probabilite %" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
            <input type="date" value={form.dateCloturePrevue} onChange={(e) => setForm({ ...form, dateCloturePrevue: e.target.value })} className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30" />
          </div>
          <select value={form.sourceCanal} onChange={(e) => setForm({ ...form, sourceCanal: e.target.value })} className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30">
            <option value="">Canal source</option>
            <option value="linkedin">LinkedIn</option>
            <option value="email">Email</option>
            <option value="website">Site web</option>
            <option value="referral">Referral</option>
            <option value="manual">Manuel</option>
          </select>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" rows={2} className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          <div className="flex gap-2 pt-1">
            <button onClick={() => { onSave(form); onClose(); }} className="text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-4 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer">
              {deal ? "Enregistrer" : "Creer"}
            </button>
            <button onClick={onClose} className="text-[13px] font-medium text-[#7B8A9A] bg-[#18212F] px-4 py-2 rounded-lg hover:text-[#F0F4F8] transition-colors cursor-pointer">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Deal Card for Kanban ----

function DealCard({ deal, contacts, onAdvance, onEdit }: { deal: DealData; contacts: ContactData[]; onAdvance: (id: string) => void; onEdit: (deal: DealData) => void }) {
  const contact = contacts.find((c) => c.id === deal.contactId);
  return (
    <div className="bg-[#18212F] border border-white/[0.06] rounded-lg p-3 hover:border-[#00D4FF]/20 transition-colors group">
      <div className="flex items-start justify-between mb-2">
        <div className="text-[13px] font-medium text-[#F0F4F8] leading-tight">{deal.titre}</div>
        <button onClick={() => onEdit(deal)} className="opacity-0 group-hover:opacity-100 text-[#7B8A9A] hover:text-[#00D4FF] transition-all cursor-pointer">
          <Edit3 className="w-3 h-3" />
        </button>
      </div>
      {contact && (
        <div className="text-[11px] text-[#7B8A9A] mb-2">
          {contact.prenom} {contact.nom} - {contact.entreprise}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#00D4FF]">{formatCurrency(deal.valeur, deal.devise)}</span>
        <span className="text-[10px] text-[#7B8A9A]">{deal.probabilite}%</span>
      </div>
      {isDealActive(deal.stage) && (
        <button
          onClick={() => onAdvance(deal.id)}
          className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] text-[#00C48C] bg-[#00C48C]/5 border border-[#00C48C]/10 rounded-md py-1 hover:bg-[#00C48C]/10 transition-colors cursor-pointer"
        >
          Avancer <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ---- Main CRMView ----

export default function CRMView() {
  const [tab, setTab] = useState<CRMTab>("pipeline");
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [deals, setDeals] = useState<DealData[]>([]);
  const [pipelineData, setPipelineData] = useState<PipelineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);
  const [showDealForm, setShowDealForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactData | null>(null);
  const [editingDeal, setEditingDeal] = useState<DealData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [contactsRes, dealsRes, pipelineRes] = await Promise.all([
        fetch("/api/data/contacts"),
        fetch("/api/data/deals"),
        fetch("/api/data/pipeline"),
      ]);
      if (contactsRes.ok) setContacts(await contactsRes.json());
      if (dealsRes.ok) setDeals(await dealsRes.json());
      if (pipelineRes.ok) {
        const pData = await pipelineRes.json();
        // Compute full summary from pipeline data
        const summary = computePipelineSummary(dealsRes.ok ? await dealsRes.clone().json() : []);
        // Override with pipeline API data for stages
        setPipelineData({ ...summary, stages: pData.stages });
      }
    } catch (e) {
      console.error("Failed to fetch CRM data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Contact CRUD
  const saveContact = async (data: Partial<ContactData>) => {
    if (editingContact) {
      await fetch("/api/data/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingContact.id, ...data }),
      });
    } else {
      await fetch("/api/data/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setEditingContact(null);
    fetchData();
  };

  const deleteContact = async (id: string) => {
    await fetch(`/api/data/contacts?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  // Deal CRUD
  const saveDeal = async (data: Partial<DealData>) => {
    if (editingDeal) {
      await fetch("/api/data/deals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingDeal.id, ...data }),
      });
    } else {
      await fetch("/api/data/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setEditingDeal(null);
    fetchData();
  };

  const advanceDeal = async (dealId: string) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const stageOrder: DealStage[] = ["prospect", "qualification", "proposition", "negociation", "closed_won"];
    const idx = stageOrder.indexOf(deal.stage);
    if (idx === -1 || idx >= stageOrder.length - 1) return;
    const nextStage = stageOrder[idx + 1];
    const probMap: Record<DealStage, number> = { prospect: 10, qualification: 25, proposition: 50, negociation: 75, closed_won: 100, closed_lost: 0 };
    await fetch("/api/data/deals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dealId, stage: nextStage, probabilite: probMap[nextStage] }),
    });
    fetchData();
  };

  const deleteDeal = async (id: string) => {
    await fetch(`/api/data/deals?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  // Filtered contacts
  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.prenom.toLowerCase().includes(q) ||
      c.nom.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.entreprise.toLowerCase().includes(q) ||
      c.poste.toLowerCase().includes(q)
    );
  });

  const tabs: { id: CRMTab; label: string; icon: React.ElementType }[] = [
    { id: "pipeline", label: "Pipeline", icon: Kanban },
    { id: "contacts", label: "Contacts", icon: Users },
    { id: "deals", label: "Deals", icon: DollarSign },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-[#00D4FF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">CRM & Pipeline</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">Gestion des contacts, pipeline commercial et deals</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingContact(null); setShowContactForm(true); }}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-3 py-1.5 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Contact
          </button>
          <button
            onClick={() => { setEditingDeal(null); setShowDealForm(true); }}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#A78BFA] px-3 py-1.5 rounded-lg hover:bg-[#8B5CF6] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Deal
          </button>
        </div>
      </div>

      {/* Pipeline Summary Cards */}
      {pipelineData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] text-[#7B8A9A] uppercase tracking-wide">Pipeline total</div>
            <div className="text-lg font-semibold text-[#00D4FF] mt-1">{formatPipelineValue(pipelineData.totalPipelineValue)}</div>
          </div>
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] text-[#7B8A9A] uppercase tracking-wide">Pipeline pondere</div>
            <div className="text-lg font-semibold text-[#A78BFA] mt-1">{formatPipelineValue(pipelineData.weightedPipeline)}</div>
          </div>
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] text-[#7B8A9A] uppercase tracking-wide">Deals actifs</div>
            <div className="text-lg font-semibold text-[#F0F4F8] mt-1">{pipelineData.activeDeals}</div>
          </div>
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] text-[#7B8A9A] uppercase tracking-wide">Taux de gain</div>
            <div className="text-lg font-semibold text-[#00C48C] mt-1">{pipelineData.winRate.toFixed(0)}%</div>
          </div>
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] text-[#7B8A9A] uppercase tracking-wide">Taille moyenne</div>
            <div className="text-lg font-semibold text-[#F4A100] mt-1">{formatCurrency(pipelineData.avgDealSize)}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0F1520] p-1 rounded-lg border border-white/[0.06]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
              tab === t.id ? "bg-[#00D4FF]/10 text-[#00D4FF]" : "text-[#7B8A9A] hover:text-[#F0F4F8]"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search bar for contacts/deals */}
      {tab !== "pipeline" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7B8A9A]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="w-full bg-[#0F1520] border border-white/[0.06] rounded-lg pl-10 pr-4 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
          />
        </div>
      )}

      {/* Pipeline Tab — Kanban */}
      {tab === "pipeline" && (
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-[900px] pb-4">
            {DEAL_STAGES.filter((s) => s.id !== "closed_lost").map((stageConfig) => {
              const stageDeals = deals.filter((d) => d.stage === stageConfig.id);
              const stageTotal = stageDeals.reduce((sum, d) => sum + d.valeur, 0);
              return (
                <div key={stageConfig.id} className="flex-1 min-w-[200px]">
                  {/* Stage Header */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stageConfig.color }} />
                      <span className="text-[12px] font-semibold text-[#F0F4F8]">{stageConfig.label}</span>
                    </div>
                    <span className="text-[10px] text-[#7B8A9A]">{stageDeals.length}</span>
                  </div>
                  <div className="text-[10px] text-[#7B8A9A] mb-2 px-1">{formatCurrency(stageTotal)}</div>

                  {/* Deal Cards */}
                  <div className="space-y-2">
                    {stageDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        contacts={contacts}
                        onAdvance={advanceDeal}
                        onEdit={(d) => { setEditingDeal(d); setShowDealForm(true); }}
                      />
                    ))}
                    {stageDeals.length === 0 && (
                      <div className="bg-[#0F1520] border border-white/[0.04] border-dashed rounded-lg p-4 text-center">
                        <p className="text-[11px] text-[#7B8A9A]/50">Aucun deal</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contacts Tab */}
      {tab === "contacts" && (
        <div className="space-y-2">
          {filteredContacts.length === 0 ? (
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-8 text-center">
              <Users className="w-8 h-8 text-[#7B8A9A] mx-auto mb-2" />
              <p className="text-[13px] text-[#7B8A9A]">Aucun contact trouve</p>
              <p className="text-[11px] text-[#7B8A9A]/60 mt-1">Ajoutez votre premier contact ou importez depuis LinkedIn</p>
            </div>
          ) : (
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-[10px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-2">Contact</th>
                    <th className="text-left text-[10px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-2">Entreprise</th>
                    <th className="text-left text-[10px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-2">Source</th>
                    <th className="text-center text-[10px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-2">Score</th>
                    <th className="text-right text-[10px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((c) => (
                    <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="text-[13px] font-medium text-[#F0F4F8]">{c.prenom} {c.nom}</div>
                        <div className="text-[11px] text-[#7B8A9A]">{c.email}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-[12px] text-[#F0F4F8]">{c.entreprise}</div>
                        <div className="text-[11px] text-[#7B8A9A]">{c.poste}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={c.source} color={c.source === "linkedin" ? "#0A66C2" : c.source === "email" ? "#00D4FF" : "#7B8A9A"} />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <ScoreBadge score={c.score} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="text-[#7B8A9A] hover:text-[#00D4FF] transition-colors"><Mail className="w-3.5 h-3.5" /></a>
                          )}
                          {c.linkedinUrl && (
                            <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[#7B8A9A] hover:text-[#0A66C2] transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a>
                          )}
                          <button onClick={() => { setEditingContact(c); setShowContactForm(true); }} className="text-[#7B8A9A] hover:text-[#00D4FF] transition-colors cursor-pointer"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteContact(c.id)} className="text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Deals Tab — Table View */}
      {tab === "deals" && (
        <div className="space-y-2">
          {deals.length === 0 ? (
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-8 text-center">
              <DollarSign className="w-8 h-8 text-[#7B8A9A] mx-auto mb-2" />
              <p className="text-[13px] text-[#7B8A9A]">Aucun deal</p>
              <p className="text-[11px] text-[#7B8A9A]/60 mt-1">Creez votre premier deal pour commencer a suivre votre pipeline</p>
            </div>
          ) : (
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-[10px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-2">Deal</th>
                    <th className="text-left text-[10px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-2">Contact</th>
                    <th className="text-left text-[10px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-2">Stage</th>
                    <th className="text-right text-[10px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-2">Valeur</th>
                    <th className="text-center text-[10px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-2">Prob.</th>
                    <th className="text-right text-[10px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d) => {
                    const contact = contacts.find((c) => c.id === d.contactId);
                    return (
                      <tr key={d.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="text-[13px] font-medium text-[#F0F4F8]">{d.titre}</div>
                          {d.sourceCanal && <div className="text-[10px] text-[#7B8A9A]">via {d.sourceCanal}</div>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-[12px] text-[#F0F4F8]">{contact ? `${contact.prenom} ${contact.nom}` : "-"}</div>
                          <div className="text-[11px] text-[#7B8A9A]">{contact?.entreprise}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={getDealStageLabel(d.stage)} color={getDealStageColor(d.stage)} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-[13px] font-semibold text-[#00D4FF]">{formatCurrency(d.valeur, d.devise)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-[12px] text-[#7B8A9A]">{d.probabilite}%</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {isDealActive(d.stage) && (
                              <button onClick={() => advanceDeal(d.id)} className="text-[#00C48C] hover:text-[#00E5A0] transition-colors cursor-pointer" title="Avancer">
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => { setEditingDeal(d); setShowDealForm(true); }} className="text-[#7B8A9A] hover:text-[#00D4FF] transition-colors cursor-pointer"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteDeal(d.id)} className="text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <ContactFormDialog
        open={showContactForm}
        onClose={() => { setShowContactForm(false); setEditingContact(null); }}
        onSave={saveContact}
        contact={editingContact}
      />
      <DealFormDialog
        open={showDealForm}
        onClose={() => { setShowDealForm(false); setEditingDeal(null); }}
        onSave={saveDeal}
        contacts={contacts}
        deal={editingDeal}
      />
    </div>
  );
}
