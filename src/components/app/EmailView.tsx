"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Send,
  Inbox,
  ListOrdered,
  Plus,
  Search,
  X,
  RefreshCw,
  Play,
  Pause,
  Eye,
  MousePointerClick,
  MessageSquare,
  AlertCircle,
  Clock,
  ChevronRight,
  Edit3,
  Trash2,
  Copy,
  BarChart3,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
} from "lucide-react";
import {
  type EmailSequenceData,
  type EmailSequenceStep,
  type EmailSequenceStatus,
  type EmailMessageData,
  type EmailMessageStatus,
  type EmailTemplate,
  type EmailStats,
  EMAIL_STATUS_COLORS,
  EMAIL_STATUS_LABELS,
  SEQUENCE_STATUS_LABELS,
  TRIGGER_EVENT_LABELS,
  DEFAULT_EMAIL_TEMPLATES,
  renderEmailTemplate,
} from "@/lib/email/types";
import { computeEmailStats } from "@/lib/email/email-engine";

type EmailTab = "sequences" | "inbox" | "compose";

// ---- Stats Cards ----

function EmailStatCard({ label, value, icon: Icon, color, trend }: { label: string; value: string | number; icon: React.ElementType; color: string; trend?: number }) {
  return (
    <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-3">
      <div className="flex items-center gap-2 text-[10px] text-[#7B8A9A] uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        {label}
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-lg font-semibold text-[#F0F4F8]">{value}</span>
        {trend !== undefined && (
          <span className={`text-[10px] font-medium flex items-center gap-0.5 ${trend >= 0 ? "text-[#00C48C]" : "text-[#E5263A]"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Sequence Form Dialog ----

function SequenceFormDialog({
  open,
  onClose,
  onSave,
  sequence,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description: string; triggerEvent: string; steps: EmailSequenceStep[] }) => void;
  sequence?: EmailSequenceData | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("manual");
  const [steps, setSteps] = useState<EmailSequenceStep[]>([
    { id: "step-1", order: 1, subject: "", body: "", delayDays: 0, trackOpens: true, trackClicks: true },
  ]);

  useEffect(() => {
    if (sequence) {
      setName(sequence.name);
      setDescription(sequence.description);
      setTriggerEvent(sequence.triggerEvent);
      const parsedSteps = Array.isArray(sequence.steps) ? sequence.steps : [];
      setSteps(parsedSteps.length > 0 ? parsedSteps : [{ id: "step-1", order: 1, subject: "", body: "", delayDays: 0, trackOpens: true, trackClicks: true }]);
    } else {
      setName("");
      setDescription("");
      setTriggerEvent("manual");
      setSteps([{ id: "step-1", order: 1, subject: "", body: "", delayDays: 0, trackOpens: true, trackClicks: true }]);
    }
  }, [sequence, open]);

  const addStep = () => {
    const newOrder = steps.length + 1;
    setSteps([...steps, { id: `step-${newOrder}`, order: newOrder, subject: "", body: "", delayDays: 3, trackOpens: true, trackClicks: true }]);
  };

  const updateStep = (index: number, updates: Partial<EmailSequenceStep>) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], ...updates };
    setSteps(updated);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    const updated = steps.filter((_, i) => i !== index);
    updated.forEach((s, i) => { s.order = i + 1; });
    setSteps(updated);
  };

  const applyTemplate = (stepIndex: number, template: EmailTemplate) => {
    updateStep(stepIndex, { subject: template.subject, body: template.body });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0F1520] border border-white/[0.08] rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#F0F4F8]">{sequence ? "Modifier la sequence" : "Nouvelle sequence email"}</h3>
          <button onClick={onClose} className="text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la sequence *" className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          <select value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value)} className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30">
            {Object.entries(TRIGGER_EVENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-semibold text-[#F0F4F8]">Etapes de la sequence</h4>
              <button onClick={addStep} className="flex items-center gap-1 text-[11px] text-[#00D4FF] hover:text-[#00AACF] cursor-pointer">
                <Plus className="w-3 h-3" /> Ajouter etape
              </button>
            </div>
            {steps.map((step, i) => (
              <div key={step.id} className="bg-[#18212F] border border-white/[0.06] rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#00D4FF]/10 text-[#00D4FF] flex items-center justify-center text-[10px] font-bold">{i + 1}</div>
                    {i > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-[#7B8A9A]">
                        <Clock className="w-3 h-3" /> J+{step.delayDays}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          const tmpl = DEFAULT_EMAIL_TEMPLATES.find((t) => t.id === e.target.value);
                          if (tmpl) applyTemplate(i, tmpl);
                        }
                      }}
                      className="bg-[#0F1520] border border-white/[0.06] rounded px-2 py-1 text-[10px] text-[#7B8A9A] focus:outline-none"
                    >
                      <option value="">Appliquer template...</option>
                      {DEFAULT_EMAIL_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    {steps.length > 1 && (
                      <button onClick={() => removeStep(i)} className="text-[#7B8A9A] hover:text-[#E5263A] cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                    )}
                  </div>
                </div>
                <input value={step.subject} onChange={(e) => updateStep(i, { subject: e.target.value })} placeholder="Sujet *" className="w-full bg-[#0F1520] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
                <textarea value={step.body} onChange={(e) => updateStep(i, { body: e.target.value })} placeholder="Corps du message * (utilisez {{prenom}}, {{entreprise}}, {{poste}}, {{secteur}})" rows={4} className="w-full bg-[#0F1520] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
                {i > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-[#7B8A9A]">Delai (jours)</label>
                    <input type="number" min={0} value={step.delayDays} onChange={(e) => updateStep(i, { delayDays: parseInt(e.target.value) || 0 })} className="w-16 bg-[#0F1520] border border-white/[0.06] rounded px-2 py-1 text-[11px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => { if (name && steps.every((s) => s.subject && s.body)) { onSave({ name, description, triggerEvent, steps }); onClose(); } }} className="text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-4 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer">
              {sequence ? "Enregistrer" : "Creer"}
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

// ---- Compose Dialog ----

function ComposeDialog({
  open,
  onClose,
  onSend,
  contacts,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (data: { contactId: string; subject: string; body: string; sequenceId?: string }) => void;
  contacts: Array<{ id: string; prenom: string; nom: string; entreprise: string }>;
}) {
  const [contactId, setContactId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (open) { setContactId(""); setSubject(""); setBody(""); }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0F1520] border border-white/[0.08] rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Nouvel email</h3>
          <button onClick={onClose} className="text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30">
            <option value="">Destinataire *</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom} - {c.entreprise}</option>
            ))}
          </select>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet *" className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Corps du message * (utilisez {{prenom}}, {{entreprise}}, {{poste}}, {{secteur}})" rows={8} className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
          <div className="flex items-center gap-2 text-[11px] text-[#7B8A9A]">
            <FileText className="w-3 h-3" />
            Templates rapides :
            {DEFAULT_EMAIL_TEMPLATES.slice(0, 3).map((t) => (
              <button
                key={t.id}
                onClick={() => { setSubject(t.subject); setBody(t.body); }}
                className="text-[#00D4FF] hover:text-[#00AACF] cursor-pointer underline"
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { if (contactId && subject && body) { onSend({ contactId, subject, body }); onClose(); } }}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-4 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Envoyer
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

// ---- Main EmailView ----

export default function EmailView() {
  const [tab, setTab] = useState<EmailTab>("sequences");
  const [sequences, setSequences] = useState<EmailSequenceData[]>([]);
  const [messages, setMessages] = useState<EmailMessageData[]>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; prenom: string; nom: string; entreprise: string; poste: string; secteur: string; email: string }>>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSeqForm, setShowSeqForm] = useState(false);
  const [editingSeq, setEditingSeq] = useState<EmailSequenceData | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [messageFilter, setMessageFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const [seqRes, msgRes, contactsRes] = await Promise.all([
        fetch("/api/data/email-sequences"),
        fetch("/api/data/email-messages"),
        fetch("/api/data/contacts"),
      ]);
      if (seqRes.ok) {
        const seqData = await seqRes.json();
        setSequences(seqData);
      }
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        setMessages(msgData);
        setStats(computeEmailStats(msgData));
      }
      if (contactsRes.ok) setContacts(await contactsRes.json());
    } catch (e) {
      console.error("Failed to fetch email data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sequence CRUD
  const saveSequence = async (data: { name: string; description: string; triggerEvent: string; steps: EmailSequenceStep[] }) => {
    if (editingSeq) {
      await fetch("/api/data/email-sequences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingSeq.id, ...data, steps: data.steps }),
      });
    } else {
      await fetch("/api/data/email-sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setEditingSeq(null);
    fetchData();
  };

  const toggleSequenceStatus = async (seq: EmailSequenceData) => {
    const newStatus: EmailSequenceStatus = seq.status === "active" ? "paused" : "active";
    await fetch("/api/data/email-sequences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: seq.id, status: newStatus }),
    });
    fetchData();
  };

  // Send email
  const sendEmail = async (data: { contactId: string; subject: string; body: string; sequenceId?: string }) => {
    const contact = contacts.find((c) => c.id === data.contactId);
    const rendered = renderEmailTemplate(
      { subject: data.subject, body: data.body } as EmailTemplate,
      { prenom: contact?.prenom, nom: contact?.nom, entreprise: contact?.entreprise, poste: contact?.poste, secteur: contact?.secteur }
    );
    await fetch("/api/data/email-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: data.contactId, subject: rendered.subject, body: rendered.body, sequenceId: data.sequenceId }),
    });
    fetchData();
  };

  // Filtered messages
  const filteredMessages = messages.filter((m) => {
    if (messageFilter === "all") return true;
    return m.status === messageFilter;
  });

  const tabs: { id: EmailTab; label: string; icon: React.ElementType }[] = [
    { id: "sequences", label: "Sequences", icon: ListOrdered },
    { id: "inbox", label: "Messages", icon: Inbox },
    { id: "compose", label: "Composer", icon: Send },
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
          <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Agent Email</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">Sequences email, inbox et prospection multi-canal</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingSeq(null); setShowSeqForm(true); }}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-3 py-1.5 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Sequence
          </button>
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#A78BFA] px-3 py-1.5 rounded-lg hover:bg-[#8B5CF6] transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Envoyer
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <EmailStatCard label="Envoyes" value={stats.totalSent} icon={Send} color="#00D4FF" />
          <EmailStatCard label="Ouverts" value={stats.totalOpened} icon={Eye} color="#A78BFA" />
          <EmailStatCard label="Cliques" value={stats.totalClicked} icon={MousePointerClick} color="#F4A100" />
          <EmailStatCard label="Reponses" value={stats.totalReplied} icon={MessageSquare} color="#00C48C" />
          <EmailStatCard label="Taux ouverture" value={`${stats.openRate.toFixed(1)}%`} icon={BarChart3} color="#00D4FF" />
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

      {/* Sequences Tab */}
      {tab === "sequences" && (
        <div className="space-y-3">
          {sequences.length === 0 ? (
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-8 text-center">
              <ListOrdered className="w-8 h-8 text-[#7B8A9A] mx-auto mb-2" />
              <p className="text-[13px] text-[#7B8A9A]">Aucune sequence email</p>
              <p className="text-[11px] text-[#7B8A9A]/60 mt-1">Creez votre premiere sequence pour automatiser votre prospection email</p>
            </div>
          ) : (
            sequences.map((seq) => {
              const parsedSteps: EmailSequenceStep[] = Array.isArray(seq.steps) ? seq.steps : [];
              const seqMessages = messages.filter((m) => m.sequenceId === seq.id);
              const seqStats = computeEmailStats(seqMessages);
              return (
                <div key={seq.id} className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-[#F0F4F8]">{seq.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          seq.status === "active"
                            ? "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]/20"
                            : seq.status === "paused"
                            ? "bg-[#F4A100]/10 text-[#F4A100] border-[#F4A100]/20"
                            : "bg-[#7B8A9A]/10 text-[#7B8A9A] border-[#7B8A9A]/20"
                        }`}>
                          {SEQUENCE_STATUS_LABELS[seq.status as EmailSequenceStatus] ?? seq.status}
                        </span>
                      </div>
                      {seq.description && <div className="text-[12px] text-[#7B8A9A] mt-0.5">{seq.description}</div>}
                      <div className="text-[11px] text-[#7B8A9A] mt-1">
                        Declencheur: {TRIGGER_EVENT_LABELS[seq.triggerEvent as keyof typeof TRIGGER_EVENT_LABELS] ?? seq.triggerEvent} · {parsedSteps.length} etapes
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleSequenceStatus(seq)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          seq.status === "active"
                            ? "text-[#F4A100] bg-[#F4A100]/10 hover:bg-[#F4A100]/20"
                            : "text-[#00C48C] bg-[#00C48C]/10 hover:bg-[#00C48C]/20"
                        }`}
                        title={seq.status === "active" ? "Mettre en pause" : "Activer"}
                      >
                        {seq.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => { setEditingSeq(seq); setShowSeqForm(true); }}
                        className="text-[#7B8A9A] hover:text-[#00D4FF] p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Sequence Steps */}
                  <div className="flex items-center gap-2 mb-3">
                    {parsedSteps.sort((a, b) => a.order - b.order).map((step, i) => (
                      <div key={step.id} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-[#18212F] rounded-lg px-2.5 py-1.5 border border-white/[0.06]">
                          <div className="w-4 h-4 rounded-full bg-[#00D4FF]/10 text-[#00D4FF] flex items-center justify-center text-[9px] font-bold">{i + 1}</div>
                          <div className="text-[11px] text-[#F0F4F8] max-w-[120px] truncate">{step.subject || "Sans sujet"}</div>
                          {i > 0 && <span className="text-[9px] text-[#7B8A9A]">J+{step.delayDays}</span>}
                        </div>
                        {i < parsedSteps.length - 1 && <ChevronRight className="w-3 h-3 text-[#7B8A9A]/40" />}
                      </div>
                    ))}
                  </div>

                  {/* Sequence Stats */}
                  {seqMessages.length > 0 && (
                    <div className="flex gap-4 text-[11px] text-[#7B8A9A]">
                      <span>Envoyes: <span className="text-[#F0F4F8]">{seqStats.totalSent}</span></span>
                      <span>Ouverture: <span className="text-[#A78BFA]">{seqStats.openRate.toFixed(1)}%</span></span>
                      <span>Reponses: <span className="text-[#00C48C]">{seqStats.replyRate.toFixed(1)}%</span></span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Inbox / Messages Tab */}
      {tab === "inbox" && (
        <div className="space-y-3">
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { value: "all", label: "Tous" },
              { value: "sent", label: "Envoyes" },
              { value: "opened", label: "Ouverts" },
              { value: "replied", label: "Reponses" },
              { value: "bounced", label: "Rebonds" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setMessageFilter(f.value)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  messageFilter === f.value
                    ? "bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20"
                    : "bg-[#0F1520] text-[#7B8A9A] border-white/[0.06] hover:text-[#F0F4F8]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredMessages.length === 0 ? (
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-8 text-center">
              <Inbox className="w-8 h-8 text-[#7B8A9A] mx-auto mb-2" />
              <p className="text-[13px] text-[#7B8A9A]">Aucun message</p>
              <p className="text-[11px] text-[#7B8A9A]/60 mt-1">Envoyez votre premier email ou activez une sequence</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMessages.map((msg) => {
                const contact = contacts.find((c) => c.id === msg.contactId);
                const seq = sequences.find((s) => s.id === msg.sequenceId);
                return (
                  <div key={msg.id} className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-3 hover:border-white/[0.1] transition-colors">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: EMAIL_STATUS_COLORS[msg.status as EmailMessageStatus] ?? "#7B8A9A" }}
                        />
                        <span className="text-[13px] font-medium text-[#F0F4F8]">{msg.subject}</span>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={{
                        backgroundColor: (EMAIL_STATUS_COLORS[msg.status as EmailMessageStatus] ?? "#7B8A9A") + "10",
                        color: EMAIL_STATUS_COLORS[msg.status as EmailMessageStatus] ?? "#7B8A9A",
                        borderColor: (EMAIL_STATUS_COLORS[msg.status as EmailMessageStatus] ?? "#7B8A9A") + "30",
                      }}>
                        {EMAIL_STATUS_LABELS[msg.status as EmailMessageStatus] ?? msg.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#7B8A9A]">
                      {contact ? `${contact.prenom} ${contact.nom} - ${contact.entreprise}` : msg.contactId}
                      {seq && ` · Sequence: ${seq.name}`}
                    </div>
                    <div className="text-[11px] text-[#7B8A9A]/60 mt-1 line-clamp-2">{msg.body.substring(0, 150)}...</div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-[#7B8A9A]">
                      {msg.sentAt && <span>Envoye: {new Date(msg.sentAt).toLocaleDateString("fr-FR")}</span>}
                      {msg.openedAt && <span className="text-[#A78BFA]">Ouvert: {new Date(msg.openedAt).toLocaleDateString("fr-FR")}</span>}
                      {msg.repliedAt && <span className="text-[#00C48C]">Repondu: {new Date(msg.repliedAt).toLocaleDateString("fr-FR")}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Compose Tab */}
      {tab === "compose" && (
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Composer un email</h3>

          <div className="space-y-3">
            <select id="compose-contact" className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30">
              <option value="">Selectionner un destinataire</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom} - {c.entreprise}</option>
              ))}
            </select>
            <input id="compose-subject" placeholder="Sujet *" className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
            <textarea id="compose-body" placeholder="Corps du message * (utilisez {{prenom}}, {{entreprise}}, {{poste}}, {{secteur}})" rows={10} className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />

            {/* Template shortcuts */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide">Templates</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DEFAULT_EMAIL_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      const subjEl = document.getElementById("compose-subject") as HTMLInputElement;
                      const bodyEl = document.getElementById("compose-body") as HTMLTextAreaElement;
                      if (subjEl) subjEl.value = t.subject;
                      if (bodyEl) bodyEl.value = t.body;
                    }}
                    className="text-left p-2 bg-[#18212F] border border-white/[0.06] rounded-lg hover:border-[#00D4FF]/20 transition-colors cursor-pointer"
                  >
                    <div className="text-[11px] font-medium text-[#F0F4F8]">{t.name}</div>
                    <div className="text-[9px] text-[#7B8A9A] mt-0.5 capitalize">{t.category}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  const contactEl = document.getElementById("compose-contact") as HTMLSelectElement;
                  const subjEl = document.getElementById("compose-subject") as HTMLInputElement;
                  const bodyEl = document.getElementById("compose-body") as HTMLTextAreaElement;
                  if (contactEl?.value && subjEl?.value && bodyEl?.value) {
                    sendEmail({ contactId: contactEl.value, subject: subjEl.value, body: bodyEl.value });
                  }
                }}
                className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-4 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Envoyer maintenant
              </button>
              <button
                onClick={() => {
                  const contactEl = document.getElementById("compose-contact") as HTMLSelectElement;
                  const subjEl = document.getElementById("compose-subject") as HTMLInputElement;
                  const bodyEl = document.getElementById("compose-body") as HTMLTextAreaElement;
                  if (contactEl?.value && subjEl?.value && bodyEl?.value) {
                    // Save as draft
                    fetch("/api/data/email-messages", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ contactId: contactEl.value, subject: subjEl.value, body: bodyEl.value, status: "draft" }),
                    }).then(() => fetchData());
                  }
                }}
                className="text-[13px] font-medium text-[#7B8A9A] bg-[#18212F] px-4 py-2 rounded-lg hover:text-[#F0F4F8] transition-colors cursor-pointer"
              >
                Sauvegarder brouillon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <SequenceFormDialog
        open={showSeqForm}
        onClose={() => { setShowSeqForm(false); setEditingSeq(null); }}
        onSave={saveSequence}
        sequence={editingSeq}
      />
      <ComposeDialog
        open={showCompose}
        onClose={() => setShowCompose(false)}
        onSend={sendEmail}
        contacts={contacts}
      />
    </div>
  );
}
