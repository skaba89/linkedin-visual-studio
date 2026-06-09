"use client";

import { useState } from "react";
import { useAppStore, type Lead } from "@/store/appStore";
import {
  Users,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  UserPlus,
  X,
  Trash2,
} from "lucide-react";

const statusColors: Record<Lead["statut"], { bg: string; text: string; label: string }> = {
  new: { bg: "bg-[#00D4FF]/10 border-[#00D4FF]/20", text: "text-[#00D4FF]", label: "Nouveau" },
  contacted: { bg: "bg-[#F4A100]/10 border-[#F4A100]/20", text: "text-[#F4A100]", label: "Contacté" },
  replied: { bg: "bg-[#A78BFA]/10 border-[#A78BFA]/20", text: "text-[#A78BFA]", label: "Répondu" },
  booked: { bg: "bg-[#00C48C]/10 border-[#00C48C]/20", text: "text-[#00C48C]", label: "RDV pris" },
  archived: { bg: "bg-[#7B8A9A]/10 border-[#7B8A9A]/20", text: "text-[#7B8A9A]", label: "Archivé" },
};

const actionLabels: Record<Lead["action"], string> = {
  liked: "A aimé",
  commented: "A commenté",
  viewed: "A visité",
};

export default function LeadsView() {
  const { leads, updateLead, removeLead, addLead } = useAppStore();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortField, setSortField] = useState<"score" | "dateCollected">("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLead, setNewLead] = useState({ prenom: "", poste: "", entreprise: "", secteur: "", score: 60, action: "liked" as Lead["action"], postSujet: "" });

  const filtered = leads
    .filter((l) => {
      if (filterStatus !== "all" && l.statut !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          l.prenom.toLowerCase().includes(s) ||
          l.poste.toLowerCase().includes(s) ||
          l.entreprise.toLowerCase().includes(s) ||
          l.secteur.toLowerCase().includes(s)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === "desc" ? -1 : 1;
      if (sortField === "score") return (a.score - b.score) * dir;
      return (a.dateCollected.localeCompare(b.dateCollected)) * dir;
    });

  const handleSort = (field: "score" | "dateCollected") => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const handleAddLead = () => {
    if (!newLead.prenom || !newLead.entreprise) return;
    addLead({
      id: Date.now().toString(),
      ...newLead,
      statut: "new",
      dateCollected: new Date().toISOString().split("T")[0],
    });
    setNewLead({ prenom: "", poste: "", entreprise: "", secteur: "", score: 60, action: "liked", postSujet: "" });
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Leads qualifiés</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">
            {leads.length} leads au total · {leads.filter((l) => l.statut === "new").length} nouveaux
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-3 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer"
        >
          {showAddForm ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
          {showAddForm ? "Annuler" : "Ajouter un lead"}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-[#0F1520] border border-[#00D4FF]/20 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Nouveau lead</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              value={newLead.prenom}
              onChange={(e) => setNewLead({ ...newLead, prenom: e.target.value })}
              placeholder="Prénom *"
              className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
            />
            <input
              value={newLead.poste}
              onChange={(e) => setNewLead({ ...newLead, poste: e.target.value })}
              placeholder="Poste"
              className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
            />
            <input
              value={newLead.entreprise}
              onChange={(e) => setNewLead({ ...newLead, entreprise: e.target.value })}
              placeholder="Entreprise *"
              className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
            />
            <input
              value={newLead.secteur}
              onChange={(e) => setNewLead({ ...newLead, secteur: e.target.value })}
              placeholder="Secteur"
              className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
            />
            <input
              type="number"
              value={newLead.score}
              onChange={(e) => setNewLead({ ...newLead, score: Number(e.target.value) })}
              placeholder="Score ICP"
              min={0}
              max={100}
              className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
            />
            <select
              value={newLead.action}
              onChange={(e) => setNewLead({ ...newLead, action: e.target.value as Lead["action"] })}
              className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30"
            >
              <option value="liked">A aimé</option>
              <option value="commented">A commenté</option>
              <option value="viewed">A visité</option>
            </select>
          </div>
          <button
            onClick={handleAddLead}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-4 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-[#7B8A9A] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, poste, entreprise…"
            className="w-full bg-[#0F1520] border border-white/[0.06] rounded-lg pl-10 pr-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
          />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none bg-[#0F1520] border border-white/[0.06] rounded-lg pl-3 pr-8 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30 cursor-pointer"
          >
            <option value="all">Tous les statuts</option>
            <option value="new">Nouveau</option>
            <option value="contacted">Contacté</option>
            <option value="replied">Répondu</option>
            <option value="booked">RDV pris</option>
            <option value="archived">Archivé</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#7B8A9A] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Prospect</th>
                <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Entreprise</th>
                <th
                  className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-[#F0F4F8]"
                  onClick={() => handleSort("score")}
                >
                  <span className="flex items-center gap-1">
                    Score <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Action</th>
                <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Statut</th>
                <th className="text-right text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const status = statusColors[lead.statut];
                return (
                  <tr key={lead.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-medium text-[#F0F4F8]">{lead.prenom}</div>
                      <div className="text-[11px] text-[#7B8A9A]">{lead.poste}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] text-[#F0F4F8]">{lead.entreprise}</div>
                      <div className="text-[11px] text-[#7B8A9A]">{lead.secteur}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-sm font-medium"
                          style={{
                            backgroundColor: lead.score >= 70 ? "#00C48C15" : lead.score >= 50 ? "#F4A10015" : "#E5263A15",
                            color: lead.score >= 70 ? "#00C48C" : lead.score >= 50 ? "#F4A100" : "#E5263A",
                          }}
                        >
                          {lead.score}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#7B8A9A]">
                      {actionLabels[lead.action]}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.statut}
                        onChange={(e) => updateLead(lead.id, { statut: e.target.value as Lead["statut"] })}
                        className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${status.bg} ${status.text} bg-transparent focus:outline-none cursor-pointer`}
                      >
                        <option value="new">Nouveau</option>
                        <option value="contacted">Contacté</option>
                        <option value="replied">Répondu</option>
                        <option value="booked">RDV pris</option>
                        <option value="archived">Archivé</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeLead(lead.id)}
                        className="text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#7B8A9A]">
                    Aucun lead trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
