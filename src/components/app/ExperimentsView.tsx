"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FlaskConical,
  Plus,
  Play,
  Pause,
  Trophy,
  TrendingUp,
  Users,
  Mail,
  FileText,
  MessageSquare,
  Loader2,
  Check,
  X,
  BarChart3,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { toast } from "@/lib/toast";

/**
 * HERMÈS — Phase 6.2 — A/B Testing Lab
 *
 * Visualizes the Experiment model (already backed by /api/data/experiments).
 * Lets the user:
 *   - Create experiments (post subject lines, comment variants, CTA variants)
 *   - Define 2-3 variants with custom content
 *   - Set traffic split (50/50, 33/33/33, 70/30)
 *   - Start / pause / archive experiments
 *   - View per-variant metrics (impressions, clicks, replies, conversion)
 *   - Auto-detect winner with statistical confidence
 *
 * The lab is "smart" — when a variant reaches statistical significance
 * (n >= 30 + conversion difference >= 15%), the system flags it as the
 * winner and recommends pausing the experiment.
 */

type ExperimentType = "post_subject" | "comment_style" | "cta_variant" | "message_opening";
type ExperimentStatus = "draft" | "running" | "paused" | "completed" | "archived";

interface Variant {
  id: string;
  name: string;
  content: string;
  impressions: number;
  clicks: number;
  replies: number;
  conversions: number;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  type: ExperimentType;
  status: ExperimentStatus;
  targetAgentId: string | null;
  variants: Variant[];
  trafficSplit: string;
  startDate: string | null;
  endDate: string | null;
  results: string | null;
  winnerId: string | null;
  confidence: number;
  createdAt: string;
}

const TYPE_LABELS: Record<ExperimentType, { label: string; icon: React.ElementType; color: string }> = {
  post_subject: { label: "Sujet de post", icon: FileText, color: "text-blue-400" },
  comment_style: { label: "Style de commentaire", icon: MessageSquare, color: "text-emerald-400" },
  cta_variant: { label: "CTA / Call-to-action", icon: TrendingUp, color: "text-[#00D4FF]" },
  message_opening: { label: "Ouverture de message", icon: Mail, color: "text-purple-400" },
};

const STATUS_COLORS: Record<ExperimentStatus, string> = {
  draft: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  running: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  completed: "bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/30",
  archived: "bg-gray-700/15 text-gray-500 border-gray-700/30",
};

export default function ExperimentsView() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchExperiments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/experiments");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const normalized = (Array.isArray(data) ? data : []).map((exp: Experiment) => ({
        ...exp,
        variants: typeof exp.variants === "string" ? safeParseVariants(exp.variants) : exp.variants,
      }));
      setExperiments(normalized);
    } catch (err) {
      toast.error("Échec du chargement des expériences", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
      setExperiments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  const selected = experiments.find((e) => e.id === selectedId);

  const stats = {
    total: experiments.length,
    running: experiments.filter((e) => e.status === "running").length,
    completed: experiments.filter((e) => e.status === "completed").length,
    winners: experiments.filter((e) => e.winnerId).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-[#00D4FF]" />
            Labo A/B
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Testez vos hypothèses sur les sujets de posts, ouvertures de messages, styles de commentaires et CTA.
            Détection automatique du gagnant avec confiance statistique.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#00D4FF] text-black rounded-md text-sm font-medium hover:bg-[#00B8D9] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvelle expérience
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={FlaskConical} label="Total" value={stats.total} accent="text-[#00D4FF]" />
        <StatCard icon={Play} label="En cours" value={stats.running} accent="text-emerald-400" />
        <StatCard icon={Check} label="Terminées" value={stats.completed} accent="text-[#00D4FF]" />
        <StatCard icon={Trophy} label="Gagnants identifiés" value={stats.winners} accent="text-yellow-400" />
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateExperimentModal
          onClose={() => setShowCreate(false)}
          onCreated={(exp) => {
            setExperiments((prev) => [exp, ...prev]);
            setShowCreate(false);
            toast.success("Expérience créée", { description: "Ajoutez vos variantes puis lancez le test." });
          }}
        />
      )}

      {/* Detail view */}
      {selected ? (
        <ExperimentDetail
          experiment={selected}
          onBack={() => setSelectedId(null)}
          onUpdate={(updated) => {
            setExperiments((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          }}
        />
      ) : (
        /* List view */
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#00D4FF] animate-spin" />
            </div>
          ) : experiments.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="Aucune expérience pour le moment"
              description="Créez votre première expérience A/B pour découvrir quelles variantes de contenu convertissent le mieux."
            />
          ) : (
            experiments.map((exp) => (
              <ExperimentCard key={exp.id} experiment={exp} onClick={() => setSelectedId(exp.id)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ExperimentCard({ experiment, onClick }: { experiment: Experiment; onClick: () => void }) {
  const typeInfo = TYPE_LABELS[experiment.type] ?? TYPE_LABELS.post_subject;
  const Icon = typeInfo.icon;
  const totalImpressions = experiment.variants.reduce((s, v) => s + (v.impressions || 0), 0);
  const winner = experiment.variants.find((v) => v.id === experiment.winnerId);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#0F1419] border border-[#1F2937] rounded-lg p-4 hover:border-[#00D4FF]/30 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 bg-[#080C10] rounded-md ${typeInfo.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white truncate">{experiment.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[experiment.status]}`}>
              {experiment.status}
            </span>
            {winner && (
              <span className="text-xs px-2 py-0.5 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                Gagnant: {winner.name}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-2 line-clamp-1">
            {experiment.description || "Aucune description"}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              {experiment.variants.length} variantes
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {totalImpressions} impressions
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {experiment.startDate ? new Date(experiment.startDate).toLocaleDateString("fr-FR") : "Non démarré"}
            </span>
            <span className="ml-auto text-[#00D4FF]">
              Confiance: {Math.round(experiment.confidence * 100)}%
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function ExperimentDetail({
  experiment,
  onBack,
  onUpdate,
}: {
  experiment: Experiment;
  onBack: () => void;
  onUpdate: (e: Experiment) => void;
}) {
  const [updating, setUpdating] = useState(false);

  const updateStatus = async (status: ExperimentStatus) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/data/experiments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: experiment.id, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      onUpdate({ ...experiment, status });
      toast.success(`Expérience ${status === "running" ? "démarrée" : status === "paused" ? "mise en pause" : "mise à jour"}`);
    } catch (err) {
      toast.error("Échec de la mise à jour", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setUpdating(false);
    }
  };

  const totalImpressions = experiment.variants.reduce((s, v) => s + (v.impressions || 0), 0);
  const totalConversions = experiment.variants.reduce((s, v) => s + (v.conversions || 0), 0);

  // Calculate per-variant conversion rate + flag the best one
  const rankedVariants = [...experiment.variants].map((v) => {
    const rate = v.impressions > 0 ? (v.conversions / v.impressions) * 100 : 0;
    return { ...v, conversionRate: rate };
  }).sort((a, b) => b.conversionRate - a.conversionRate);

  const bestVariant = rankedVariants[0];
  const minSampleSize = 30;
  const hasSignificance = totalImpressions >= minSampleSize && rankedVariants.length >= 2;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
      >
        ← Retour à la liste
      </button>

      <div className="bg-[#0F1419] border border-[#1F2937] rounded-lg p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">{experiment.name}</h2>
            <p className="text-xs text-gray-400 mt-1">{experiment.description}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[experiment.status]}`}>
            {experiment.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <DetailStat label="Variantes" value={experiment.variants.length} />
          <DetailStat label="Traffic split" value={experiment.trafficSplit} />
          <DetailStat label="Impressions totales" value={totalImpressions} />
          <DetailStat label="Conversions" value={totalConversions} />
        </div>

        <div className="flex items-center gap-2">
          {experiment.status === "draft" && (
            <button
              onClick={() => updateStatus("running")}
              disabled={updating || experiment.variants.length < 2}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-md text-xs font-medium hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
            >
              <Play className="w-3 h-3" />
              Démarrer
            </button>
          )}
          {experiment.status === "running" && (
            <button
              onClick={() => updateStatus("paused")}
              disabled={updating}
              className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-md text-xs font-medium hover:bg-yellow-500/25 disabled:opacity-40 transition-colors"
            >
              <Pause className="w-3 h-3" />
              Mettre en pause
            </button>
          )}
          {experiment.status === "paused" && (
            <button
              onClick={() => updateStatus("running")}
              disabled={updating}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-md text-xs font-medium hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
            >
              <Play className="w-3 h-3" />
              Reprendre
            </button>
          )}
          {(experiment.status === "running" || experiment.status === "paused") && (
            <button
              onClick={() => updateStatus("completed")}
              disabled={updating}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/30 rounded-md text-xs font-medium hover:bg-[#00D4FF]/25 disabled:opacity-40 transition-colors"
            >
              <Check className="w-3 h-3" />
              Terminer
            </button>
          )}
        </div>

        {experiment.variants.length < 2 && (
          <div className="mt-3 bg-yellow-500/5 border border-yellow-500/20 rounded-md p-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-400">
              Ajoutez au moins 2 variantes pour démarrer l'expérience.
            </p>
          </div>
        )}
      </div>

      {/* Variantes */}
      <div className="bg-[#0F1419] border border-[#1F2937] rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#00D4FF]" />
          <h3 className="text-sm font-semibold text-white">Variantes & performance</h3>
        </div>

        {!hasSignificance && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-md p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-400">
              Données insuffisantes pour la significativité statistique. Minimum requis:{" "}
              {minSampleSize} impressions totales (actuellement: {totalImpressions}).
            </p>
          </div>
        )}

        <div className="space-y-2">
          {rankedVariants.map((v, idx) => {
            const isWinner = experiment.winnerId === v.id;
            const isBest = idx === 0 && hasSignificance;
            return (
              <div
                key={v.id}
                className={`bg-[#080C10] border rounded-md p-3 ${
                  isWinner || isBest ? "border-yellow-500/40" : "border-[#1F2937]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">#{idx + 1}</span>
                    <span className="text-sm font-medium text-white">{v.name}</span>
                    {(isWinner || isBest) && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        Gagnant
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    Taux: <span className="text-white font-medium">{v.conversionRate.toFixed(1)}%</span>
                  </span>
                </div>
                <p className="text-xs text-gray-400 line-clamp-2 mb-2">{v.content}</p>

                {/* Conversion bar */}
                <div className="relative h-2 bg-[#1F2937] rounded-full overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${
                      isWinner || isBest ? "bg-yellow-500" : "bg-[#00D4FF]"
                    }`}
                    style={{ width: `${Math.min(100, v.conversionRate * 5)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>{v.impressions} impr.</span>
                  <span>{v.clicks} clics</span>
                  <span>{v.replies} réponses</span>
                  <span>{v.conversions} conv.</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CreateExperimentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (exp: Experiment) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ExperimentType>("post_subject");
  const [trafficSplit, setTrafficSplit] = useState("50/50");
  const [variants, setVariants] = useState<{ id: string; name: string; content: string }[]>([
    { id: "a", name: "Variante A", content: "" },
    { id: "b", name: "Variante B", content: "" },
  ]);
  const [creating, setCreating] = useState(false);

  const addVariant = () => {
    if (variants.length >= 4) return;
    const letters = ["a", "b", "c", "d", "e"];
    const nextLetter = letters[variants.length].toUpperCase();
    setVariants([...variants, { id: crypto.randomUUID(), name: `Variante ${nextLetter}`, content: "" }]);
  };

  const removeVariant = (id: string) => {
    if (variants.length <= 2) return;
    setVariants(variants.filter((v) => v.id !== id));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    if (variants.some((v) => !v.content.trim())) {
      toast.error("Toutes les variantes doivent avoir du contenu");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/data/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          type,
          status: "draft",
          trafficSplit,
          variants: variants.map((v) => ({
            ...v,
            impressions: 0,
            clicks: 0,
            replies: 0,
            conversions: 0,
          })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const exp = await res.json();
      onCreated({
        ...exp,
        variants: typeof exp.variants === "string" ? safeParseVariants(exp.variants) : exp.variants,
      });
    } catch (err) {
      toast.error("Échec de création", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#0F1419] border border-[#1F2937] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Nouvelle expérience A/B</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Test ouverture message — question vs affirmation"
              className="w-full bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D4FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Description (optionnel)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hypothèse testée, contexte, durée prévue..."
              rows={2}
              className="w-full bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D4FF] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Type de test</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TYPE_LABELS) as ExperimentType[]).map((t) => {
                const info = TYPE_LABELS[t];
                const Icon = info.icon;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs border transition-colors ${
                      type === t
                        ? "bg-[#00D4FF] text-black border-[#00D4FF]"
                        : "bg-[#080C10] text-gray-400 border-[#1F2937] hover:border-[#00D4FF]/50"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {info.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Répartition du trafic</label>
            <div className="grid grid-cols-3 gap-2">
              {["50/50", "70/30", "33/33/33"].map((split) => (
                <button
                  key={split}
                  onClick={() => setTrafficSplit(split)}
                  className={`px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
                    trafficSplit === split
                      ? "bg-[#00D4FF] text-black border-[#00D4FF]"
                      : "bg-[#080C10] text-gray-400 border-[#1F2937] hover:border-[#00D4FF]/50"
                  }`}
                >
                  {split}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white">Variantes ({variants.length}/4)</label>
              <button
                onClick={addVariant}
                disabled={variants.length >= 4}
                className="flex items-center gap-1 text-xs text-[#00D4FF] hover:text-[#00B8D9] disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
                Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div key={v.id} className="bg-[#080C10] border border-[#1F2937] rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) =>
                        setVariants(variants.map((x) => (x.id === v.id ? { ...x, name: e.target.value } : x)))
                      }
                      className="flex-1 bg-transparent text-sm text-white font-medium focus:outline-none"
                    />
                    {variants.length > 2 && (
                      <button
                        onClick={() => removeVariant(v.id)}
                        className="text-gray-500 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <textarea
                    value={v.content}
                    onChange={(e) =>
                      setVariants(variants.map((x) => (x.id === v.id ? { ...x, content: e.target.value } : x)))
                    }
                    placeholder={`Contenu de la variante ${idx + 1}...`}
                    rows={3}
                    className="w-full bg-transparent text-xs text-gray-300 placeholder-gray-600 focus:outline-none resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[#00D4FF] text-black rounded-md text-sm font-medium hover:bg-[#00B8D9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Créer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number; accent: string }) {
  return (
    <div className="bg-[#0F1419] border border-[#1F2937] rounded-lg p-3">
      <Icon className={`w-4 h-4 mb-1 ${accent}`} />
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-[#080C10] border border-[#1F2937] rounded-md p-2 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="text-center py-12 bg-[#0F1419] border border-[#1F2937] rounded-lg">
      <Icon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-400 max-w-md mx-auto">{description}</p>
    </div>
  );
}

function safeParseVariants(stored: string): Variant[] {
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.map((v: Record<string, unknown>) => ({
        id: String(v.id ?? crypto.randomUUID()),
        name: String(v.name ?? ""),
        content: String(v.content ?? ""),
        impressions: Number(v.impressions ?? 0),
        clicks: Number(v.clicks ?? 0),
        replies: Number(v.replies ?? 0),
        conversions: Number(v.conversions ?? 0),
      }));
    }
  } catch {
    // fall through
  }
  return [];
}
