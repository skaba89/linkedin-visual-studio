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
  LayoutGrid,
  Table2,
  Link2,
  Download,
  CheckSquare,
  Square,
} from "lucide-react";

const statusColors: Record<Lead["statut"], { bg: string; text: string; label: string; kanban: string }> = {
  new: { bg: "bg-[#00D4FF]/10 border-[#00D4FF]/20", text: "text-[#00D4FF]", label: "Nouveau", kanban: "#00D4FF" },
  contacted: { bg: "bg-[#F4A100]/10 border-[#F4A100]/20", text: "text-[#F4A100]", label: "Contacté", kanban: "#F4A100" },
  replied: { bg: "bg-[#A78BFA]/10 border-[#A78BFA]/20", text: "text-[#A78BFA]", label: "Répondu", kanban: "#A78BFA" },
  booked: { bg: "bg-[#00C48C]/10 border-[#00C48C]/20", text: "text-[#00C48C]", label: "RDV pris", kanban: "#00C48C" },
  archived: { bg: "bg-[#7B8A9A]/10 border-[#7B8A9A]/20", text: "text-[#7B8A9A]", label: "Archivé", kanban: "#7B8A9A" },
};

const actionLabels: Record<Lead["action"], string> = {
  liked: "A aimé",
  commented: "A commenté",
  viewed: "A visité",
};

type ViewMode = "table" | "kanban";

export default function LeadsView() {
  const { leads, updateLead, removeLead, addLead } = useAppStore();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSector, setFilterSector] = useState<string>("all");
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
  const [sortField, setSortField] = useState<"score" | "dateCollected">("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [newLead, setNewLead] = useState({ prenom: "", poste: "", entreprise: "", secteur: "", score: 60, action: "liked" as Lead["action"], postSujet: "" });

  // Get unique sectors for filter
  const sectors = Array.from(new Set(leads.map((l) => l.secteur))).filter(Boolean);

  const filtered = leads
    .filter((l) => {
      if (filterStatus !== "all" && l.statut !== filterStatus) return false;
      if (filterSector !== "all" && l.secteur !== filterSector) return false;
      if (l.score < scoreRange[0] || l.score > scoreRange[1]) return false;
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
      return a.dateCollected.localeCompare(b.dateCollected) * dir;
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

  const toggleSelectLead = (id: string) => {
    const newSet = new Set(selectedLeads);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedLeads(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filtered.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filtered.map((l) => l.id)));
    }
  };

  const bulkChangeStatus = (status: Lead["statut"]) => {
    for (const id of selectedLeads) {
      updateLead(id, { statut: status });
    }
    setSelectedLeads(new Set());
  };

  const bulkDelete = () => {
    for (const id of selectedLeads) {
      removeLead(id);
    }
    setSelectedLeads(new Set());
  };

  const exportLeads = () => {
    const data = filtered.map((l) => ({
      Prenom: l.prenom,
      Poste: l.poste,
      Entreprise: l.entreprise,
      Secteur: l.secteur,
      Score: l.score,
      Action: l.action,
      Statut: l.statut,
      Date: l.dateCollected,
    }));
    const csv = [
      Object.keys(data[0] || {}).join(","),
      ...data.map((row) => Object.values(row).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const linkToCRM = async (lead: Lead) => {
    try {
      const res = await fetch("/api/data/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prenom: lead.prenom,
          nom: "",
          email: "",
          entreprise: lead.entreprise,
          poste: lead.poste,
          secteur: lead.secteur,
          source: "linkedin",
          score: lead.score,
          tags: [lead.action, `score:${lead.score}`],
        }),
      });
      if (res.ok) {
        updateLead(lead.id, { statut: "contacted" });
      }
    } catch (e) {
      console.error("Failed to link lead to CRM:", e);
    }
  };

  // Kanban columns
  const kanbanColumns: Lead["statut"][] = ["new", "contacted", "replied", "booked", "archived"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Leads qualifiés</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">
            {leads.length} leads au total · {leads.filter((l) => l.statut === "new").length} nouveaux
            {selectedLeads.size > 0 && ` · ${selectedLeads.size} sélectionnés`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex gap-0.5 bg-[#0F1520] p-0.5 rounded-lg border border-white/[0.06]">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded cursor-pointer transition-colors ${viewMode === "table" ? "bg-[#00D4FF]/10 text-[#00D4FF]" : "text-[#7B8A9A]"}`}
            >
              <Table2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded cursor-pointer transition-colors ${viewMode === "kanban" ? "bg-[#00D4FF]/10 text-[#00D4FF]" : "text-[#7B8A9A]"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-3 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer"
          >
            {showAddForm ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            {showAddForm ? "Annuler" : "Ajouter"}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-[#0F1520] border border-[#00D4FF]/20 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Nouveau lead</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input value={newLead.prenom} onChange={(e) => setNewLead({ ...newLead, prenom: e.target.value })} placeholder="Prénom *" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
            <input value={newLead.poste} onChange={(e) => setNewLead({ ...newLead, poste: e.target.value })} placeholder="Poste" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
            <input value={newLead.entreprise} onChange={(e) => setNewLead({ ...newLead, entreprise: e.target.value })} placeholder="Entreprise *" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
            <input value={newLead.secteur} onChange={(e) => setNewLead({ ...newLead, secteur: e.target.value })} placeholder="Secteur" className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
            <input type="number" value={newLead.score} onChange={(e) => setNewLead({ ...newLead, score: Number(e.target.value) })} placeholder="Score ICP" min={0} max={100} className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30" />
            <select value={newLead.action} onChange={(e) => setNewLead({ ...newLead, action: e.target.value as Lead["action"] })} className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#00D4FF]/30">
              <option value="liked">A aimé</option>
              <option value="commented">A commenté</option>
              <option value="viewed">A visité</option>
            </select>
          </div>
          <button onClick={handleAddLead} className="flex items-center gap-1.5 text-[13px] font-medium text-[#080C10] bg-[#00D4FF] px-4 py-2 rounded-lg hover:bg-[#00AACF] transition-colors cursor-pointer">
            <UserPlus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedLeads.size > 0 && (
        <div className="flex items-center gap-2 bg-[#0F1520] border border-[#00D4FF]/20 rounded-xl px-4 py-3">
          <span className="text-[12px] text-[#7B8A9A]">{selectedLeads.size} sélectionné(s)</span>
          <div className="flex gap-1.5 ml-auto">
            {(["contacted", "replied", "booked", "archived"] as Lead["statut"][]).map((status) => (
              <button
                key={status}
                onClick={() => bulkChangeStatus(status)}
                className="text-[11px] px-2 py-1 rounded bg-[#18212F] text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"
              >
                → {statusColors[status].label}
              </button>
            ))}
            <button onClick={bulkDelete} className="text-[11px] px-2 py-1 rounded bg-[#E5263A]/10 text-[#E5263A] hover:bg-[#E5263A]/20 cursor-pointer">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
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
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors ${showFilters ? "bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/20" : "bg-[#0F1520] text-[#7B8A9A] border border-white/[0.06]"}`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filtres
        </button>
        <button onClick={exportLeads} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] text-[#7B8A9A] bg-[#0F1520] border border-white/[0.06] hover:text-[#F0F4F8] cursor-pointer">
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4 flex flex-wrap gap-4">
          <div>
            <label className="text-[11px] text-[#7B8A9A] uppercase tracking-wide block mb-1">Secteur</label>
            <select
              value={filterSector}
              onChange={(e) => setFilterSector(e.target.value)}
              className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-[#F0F4F8] focus:outline-none"
            >
              <option value="all">Tous</option>
              {sectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-[#7B8A9A] uppercase tracking-wide block mb-1">Score min</label>
            <input
              type="number"
              value={scoreRange[0]}
              onChange={(e) => setScoreRange([Number(e.target.value), scoreRange[1]])}
              min={0}
              max={100}
              className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-[#F0F4F8] focus:outline-none w-20"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#7B8A9A] uppercase tracking-wide block mb-1">Score max</label>
            <input
              type="number"
              value={scoreRange[1]}
              onChange={(e) => setScoreRange([scoreRange[0], Number(e.target.value)])}
              min={0}
              max={100}
              className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-[#F0F4F8] focus:outline-none w-20"
            />
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 w-8">
                    <button onClick={toggleSelectAll} className="cursor-pointer text-[#7B8A9A] hover:text-[#F0F4F8]">
                      {selectedLeads.size === filtered.length && filtered.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Prospect</th>
                  <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Entreprise</th>
                  <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-[#F0F4F8]" onClick={() => handleSort("score")}>
                    <span className="flex items-center gap-1">Score <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Action</th>
                  <th className="text-left text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Statut</th>
                  <th className="text-right text-[11px] font-semibold text-[#7B8A9A] uppercase tracking-wide px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const status = statusColors[lead.statut];
                  const isSelected = selectedLeads.has(lead.id);
                  return (
                    <tr key={lead.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] ${isSelected ? "bg-[#00D4FF]/5" : ""}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelectLead(lead.id)} className="cursor-pointer text-[#7B8A9A] hover:text-[#F0F4F8]">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-[#00D4FF]" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
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
                      <td className="px-4 py-3 text-[12px] text-[#7B8A9A]">{actionLabels[lead.action]}</td>
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
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => linkToCRM(lead)} className="text-[#7B8A9A] hover:text-[#00D4FF] transition-colors cursor-pointer" title="Ajouter au CRM">
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeLead(lead.id)} className="text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#7B8A9A]">Aucun lead trouvé</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {kanbanColumns.map((statut) => {
            const statusInfo = statusColors[statut];
            const columnLeads = filtered.filter((l) => l.statut === statut);
            return (
              <div key={statut} className="flex-shrink-0 w-[240px]">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusInfo.kanban }} />
                    <span className="text-[12px] font-semibold text-[#F0F4F8]">{statusInfo.label}</span>
                  </div>
                  <span className="text-[11px] text-[#7B8A9A]">{columnLeads.length}</span>
                </div>
                <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-2 min-h-[200px] space-y-2">
                  {columnLeads.map((lead) => (
                    <div key={lead.id} className="bg-[#18212F] border border-white/[0.06] rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium text-[#F0F4F8]">{lead.prenom}</span>
                        <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono font-medium"
                          style={{
                            backgroundColor: lead.score >= 70 ? "#00C48C15" : lead.score >= 50 ? "#F4A10015" : "#E5263A15",
                            color: lead.score >= 70 ? "#00C48C" : lead.score >= 50 ? "#F4A100" : "#E5263A",
                          }}
                        >
                          {lead.score}
                        </div>
                      </div>
                      <div className="text-[11px] text-[#7B8A9A] mt-0.5">{lead.poste} · {lead.entreprise}</div>
                      <div className="flex items-center gap-1 mt-2">
                        <button onClick={() => linkToCRM(lead)} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#7B8A9A] hover:text-[#00D4FF] cursor-pointer">
                          <Link2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => removeLead(lead.id)} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#7B8A9A] hover:text-[#E5263A] cursor-pointer">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {columnLeads.length === 0 && (
                    <div className="text-center py-4 text-[11px] text-[#7B8A9A]/40">Vide</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
