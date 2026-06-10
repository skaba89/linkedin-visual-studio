"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Users,
  Mail,
  Plus,
  Search,
  X,
  ChevronDown,
  Trash2,
  UserPlus,
  DollarSign,
  ArrowRight,
  Eye,
  MousePointer,
  Reply,
  Send,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

type Tab = "contacts" | "pipeline" | "emails";

interface Contact {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  entreprise: string;
  poste: string;
  secteur: string;
  siteWeb?: string;
  linkedinUrl?: string;
  source: string;
  notes?: string;
  tags: string[];
  score: number;
  createdAt: string;
  updatedAt: string;
}

interface Deal {
  id: string;
  contactId: string;
  titre: string;
  valeur: number;
  devise: string;
  stage: string;
  probabilite: number;
  dateCloturePrevue?: string;
  sourceCanal?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  contact?: Contact | null;
}

interface PipelineStage {
  id: string;
  label: string;
  color: string;
  order: number;
  deals: Deal[];
  totalValue: number;
  count: number;
}

interface EmailSequence {
  id: string;
  name: string;
  description: string;
  status: string;
  steps: Array<{
    order: number;
    subject: string;
    body: string;
    delayDays: number;
  }>;
}

interface EmailMessage {
  id: string;
  contactId: string;
  sequenceId?: string;
  subject: string;
  body: string;
  status: string;
  sentAt?: string;
  openedAt?: string;
  clickedAt?: string;
  repliedAt?: string;
  createdAt: string;
}

const STAGES = [
  { id: "prospect", label: "Prospect", color: "#7B8A9A" },
  { id: "qualification", label: "Qualification", color: "#00D4FF" },
  { id: "proposition", label: "Proposition", color: "#A78BFA" },
  { id: "negociation", label: "Négociation", color: "#F4A100" },
  { id: "closed_won", label: "Closed Won", color: "#00C48C" },
  { id: "closed_lost", label: "Closed Lost", color: "#E5263A" },
];

export default function CRMView() {
  const [tab, setTab] = useState<Tab>("contacts");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [emailSequences, setEmailSequences] = useState<EmailSequence[]>([]);
  const [emailMessages, setEmailMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [newContact, setNewContact] = useState({ prenom: "", nom: "", email: "", entreprise: "", poste: "", secteur: "", source: "manual" });
  const [newDeal, setNewDeal] = useState({ titre: "", contactId: "", valeur: 0, stage: "prospect" });
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const fetchContacts = useCallback(async () => {
    const res = await fetch("/api/data/contacts");
    if (res.ok) setContacts(await res.json());
  }, []);

  const fetchPipeline = useCallback(async () => {
    const res = await fetch("/api/data/pipeline");
    if (res.ok) {
      const data = await res.json();
      setPipelineStages(data.stages || []);
    }
  }, []);

  const fetchEmails = useCallback(async () => {
    const [seqRes, msgRes] = await Promise.all([
      fetch("/api/data/email-sequences"),
      fetch("/api/data/email-messages"),
    ]);
    if (seqRes.ok) setEmailSequences(await seqRes.json());
    if (msgRes.ok) setEmailMessages(await msgRes.json());
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchContacts(), fetchPipeline(), fetchEmails()]);
    setLoading(false);
  }, [fetchContacts, fetchPipeline, fetchEmails]);

  useEffect(() => {
    queueMicrotask(() => { fetchAll(); });
  }, [fetchAll]);

  const addContact = async () => {
    if (!newContact.prenom) return;
    await fetch("/api/data/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newContact),
    });
    setNewContact({ prenom: "", nom: "", email: "", entreprise: "", poste: "", secteur: "", source: "manual" });
    setShowAddContact(false);
    fetchContacts();
    fetchPipeline();
  };

  const deleteContact = async (id: string) => {
    await fetch(`/api/data/contacts?id=${id}`, { method: "DELETE" });
    fetchContacts();
  };

  const addDeal = async () => {
    if (!newDeal.titre || !newDeal.contactId) return;
    await fetch("/api/data/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDeal),
    });
    setNewDeal({ titre: "", contactId: "", valeur: 0, stage: "prospect" });
    setShowAddDeal(false);
    fetchPipeline();
  };

  const moveDeal = async (dealId: string, newStage: string) => {
    await fetch("/api/data/deals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dealId, stage: newStage }),
    });
    fetchPipeline();
  };

  const deleteDeal = async (id: string) => {
    await fetch(`/api/data/deals?id=${id}`, { method: "DELETE" });
    fetchPipeline();
  };

  const filteredContacts = contacts.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.prenom.toLowerCase().includes(s) ||
      c.nom.toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s) ||
      c.entreprise.toLowerCase().includes(s)
    );
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent": return <Send className="w-3 h-3 text-[#7B8A9A]" />;
      case "opened": return <Eye className="w-3 h-3 text-[#00D4FF]" />;
      case "clicked": return <MousePointer className="w-3 h-3 text-[#A78BFA]" />;
      case "replied": return <Reply className="w-3 h-3 text-[#00C48C]" />;
      default: return <Mail className="w-3 h-3 text-[#7B8A9A]" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Brouillon",
      queued: "En attente",
      sent: "Envoyé",
      opened: "Ouvert",
      clicked: "Cliqué",
      replied: "Répondu",
      bounced: "Rebondi",
      failed: "Échoué",
    };
    return labels[status] || status;
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "contacts", label: "Contacts", icon: Users },
    { id: "pipeline", label: "Pipeline", icon: Building2 },
    { id: "emails", label: "Emails", icon: Mail },
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">CRM & Pipeline</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">{contacts.length} contacts · {pipelineStages.reduce((sum, s) => sum + s.count, 0)} deals</p>
        </div>
      </div>

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

      {/* Contacts Tab */}
      {tab === "contacts" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-[#7B8A9A] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un contact…"
                className="w-full bg-[#0F1520] border border-white/[0.06] rounded-lg pl-10 pr-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
              />
            </div>
            <button
              onClick={() => setShowAddContact(!showAddContact)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-3 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer"
            >
              {showAddContact ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              {showAddContact ? "Annuler" : "Ajouter"}
            </button>
          </div>

          {showAddContact && (
            <div className="bg-[#0F1520] border border-[#00D4FF]/20 rounded-xl p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <input value={newContact.prenom} onChange={(e) => setNewContact({ ...newContact, prenom: e.target.value })} placeholder="Prénom *" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
                <input value={newContact.nom} onChange={(e) => setNewContact({ ...newContact, nom: e.target.value })} placeholder="Nom" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
                <input value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} placeholder="Email" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
                <input value={newContact.entreprise} onChange={(e) => setNewContact({ ...newContact, entreprise: e.target.value })} placeholder="Entreprise" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
                <input value={newContact.poste} onChange={(e) => setNewContact({ ...newContact, poste: e.target.value })} placeholder="Poste" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
                <input value={newContact.secteur} onChange={(e) => setNewContact({ ...newContact, secteur: e.target.value })} placeholder="Secteur" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
              </div>
              <button onClick={addContact} className="text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-4 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer">
                Ajouter le contact
              </button>
            </div>
          )}

          {/* Contact Table */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Contact</th>
                    <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Entreprise</th>
                    <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Email</th>
                    <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Source</th>
                    <th className="text-right text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-medium text-[#F0F4F8]">{contact.prenom} {contact.nom}</div>
                        <div className="text-[11px] text-[#7B8A9A]">{contact.poste}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[13px] text-[#F0F4F8]">{contact.entreprise}</div>
                        <div className="text-[11px] text-[#7B8A9A]">{contact.secteur}</div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#7B8A9A]">{contact.email}</td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#18212F] text-[#7B8A9A]">{contact.source}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteContact(contact.id)} className="text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredContacts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#7B8A9A]">Aucun contact</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Tab */}
      {tab === "pipeline" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#F0F4F8]">Pipeline Kanban</h3>
            <button
              onClick={() => setShowAddDeal(!showAddDeal)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-3 py-1.5 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Deal
            </button>
          </div>

          {showAddDeal && (
            <div className="bg-[#0F1520] border border-[#00D4FF]/20 rounded-xl p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={newDeal.titre} onChange={(e) => setNewDeal({ ...newDeal, titre: e.target.value })} placeholder="Titre du deal *" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
                <select value={newDeal.contactId} onChange={(e) => setNewDeal({ ...newDeal, contactId: e.target.value })} className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30">
                  <option value="">Contact *</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.prenom} {c.nom} ({c.entreprise})</option>
                  ))}
                </select>
                <input type="number" value={newDeal.valeur || ""} onChange={(e) => setNewDeal({ ...newDeal, valeur: Number(e.target.value) })} placeholder="Valeur (€)" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
                <select value={newDeal.stage} onChange={(e) => setNewDeal({ ...newDeal, stage: e.target.value })} className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30">
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <button onClick={addDeal} className="text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-4 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer">
                Créer le deal
              </button>
            </div>
          )}

          {/* Kanban Board */}
          <div className="flex gap-3 overflow-x-auto pb-4">
            {pipelineStages.map((stage) => (
              <div key={stage.id} className="flex-shrink-0 w-[220px]">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-[12px] font-semibold text-[#F0F4F8]">{stage.label}</span>
                  </div>
                  <span className="text-[11px] text-[#7B8A9A]">{stage.count}</span>
                </div>
                <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-2 min-h-[200px] space-y-2">
                  {stage.totalValue > 0 && (
                    <div className="text-[10px] text-[#7B8A9A] px-1 mb-1">{stage.totalValue.toFixed(0)}€</div>
                  )}
                  {stage.deals.map((deal) => (
                    <div key={deal.id} className="bg-[#18212F] border border-white/[0.06] rounded-lg p-3 group">
                      <div className="text-[12px] font-medium text-[#F0F4F8] truncate">{deal.titre}</div>
                      <div className="text-[11px] text-[#7B8A9A] mt-0.5">{deal.valeur.toFixed(0)}€</div>
                      {deal.contact && (
                        <div className="text-[10px] text-[#7B8A9A]/60 mt-1">{deal.contact.prenom} {deal.contact.nom}</div>
                      )}
                      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {STAGES.filter((s) => s.id !== stage.id).slice(0, 3).map((s) => (
                          <button
                            key={s.id}
                            onClick={() => moveDeal(deal.id, s.id)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"
                            style={{ borderColor: s.color + "40" }}
                          >
                            → {s.label}
                          </button>
                        ))}
                        <button onClick={() => deleteDeal(deal.id)} className="text-[#7B8A9A] hover:text-[#E5263A] cursor-pointer ml-auto">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {stage.deals.length === 0 && (
                    <div className="text-center py-4 text-[11px] text-[#7B8A9A]/40">Vide</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emails Tab */}
      {tab === "emails" && (
        <div className="space-y-4">
          {/* Sequences */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Séquences email</h3>
            {emailSequences.length === 0 ? (
              <div className="text-center py-4 text-[13px] text-[#7B8A9A]">Aucune séquence configurée</div>
            ) : (
              <div className="space-y-2">
                {emailSequences.map((seq) => (
                  <div key={seq.id} className="flex items-center justify-between p-3 bg-[#18212F] rounded-lg">
                    <div>
                      <div className="text-[13px] font-medium text-[#F0F4F8]">{seq.name}</div>
                      <div className="text-[11px] text-[#7B8A9A]">{seq.steps.length} étapes · {seq.status}</div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      seq.status === "active" ? "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]/20" :
                      seq.status === "draft" ? "bg-[#7B8A9A]/10 text-[#7B8A9A] border-[#7B8A9A]/20" :
                      "bg-[#F4A100]/10 text-[#F4A100] border-[#F4A100]/20"
                    }`}>
                      {seq.status === "active" ? "Active" : seq.status === "draft" ? "Brouillon" : "En pause"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message History */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Historique des messages</h3>
            {emailMessages.length === 0 ? (
              <div className="text-center py-4 text-[13px] text-[#7B8A9A]">Aucun message envoyé</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {emailMessages.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-3 p-3 bg-[#18212F] rounded-lg">
                    {getStatusIcon(msg.status)}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-[#F0F4F8] truncate">{msg.subject}</div>
                      <div className="text-[11px] text-[#7B8A9A] mt-0.5 flex items-center gap-2">
                        <span>{getStatusLabel(msg.status)}</span>
                        {msg.openedAt && <span className="text-[#00D4FF]">· Ouvert</span>}
                        {msg.clickedAt && <span className="text-[#A78BFA]">· Cliqué</span>}
                        {msg.repliedAt && <span className="text-[#00C48C]">· Répondu</span>}
                      </div>
                    </div>
                    <div className="text-[10px] text-[#7B8A9A]">
                      {new Date(msg.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4 text-center">
              <Send className="w-4 h-4 text-[#7B8A9A] mx-auto mb-1" />
              <div className="text-lg font-semibold text-[#F0F4F8]">{emailMessages.filter((m) => m.status === "sent" || m.status === "opened" || m.status === "clicked" || m.status === "replied").length}</div>
              <div className="text-[10px] text-[#7B8A9A]">Envoyés</div>
            </div>
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4 text-center">
              <Eye className="w-4 h-4 text-[#00D4FF] mx-auto mb-1" />
              <div className="text-lg font-semibold text-[#F0F4F8]">{emailMessages.filter((m) => m.openedAt).length}</div>
              <div className="text-[10px] text-[#7B8A9A]">Ouverts</div>
            </div>
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4 text-center">
              <MousePointer className="w-4 h-4 text-[#A78BFA] mx-auto mb-1" />
              <div className="text-lg font-semibold text-[#F0F4F8]">{emailMessages.filter((m) => m.clickedAt).length}</div>
              <div className="text-[10px] text-[#7B8A9A]">Cliqués</div>
            </div>
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4 text-center">
              <Reply className="w-4 h-4 text-[#00C48C] mx-auto mb-1" />
              <div className="text-lg font-semibold text-[#F0F4F8]">{emailMessages.filter((m) => m.repliedAt).length}</div>
              <div className="text-[10px] text-[#7B8A9A]">Réponses</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
