"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Heart,
  MessageCircle,
  Users,
  TrendingUp,
  Zap,
  RefreshCw,
  Check,
  X,
  Plus,
  Settings2,
  ExternalLink,
  AlertTriangle,
  Loader2,
  ThumbsUp,
} from "lucide-react";
import { toast } from "@/lib/toast";

/**
 * HERMÈS — Phase 3.8 — Engagement IA view
 *
 * Four tabs:
 *   - Réacteurs: list of people who liked/commented on your LinkedIn posts,
 *     with a "Sync to CRM" button to convert them into Contacts.
 *   - Visiteurs: manual import of profile visitors (LinkedIn Premium
 *     dashboard copy). Each visitor becomes a warm lead (score=60).
 *   - Tendances: trending topics detected by the AI in your niche.
 *     Each topic has a "Generate expert comment" button that produces
 *     3 variants in different tones.
 *   - Auto-Reply: opt-in settings for autonomous engagement on trending
 *     topics, with daily cap and tone selector.
 */

type Tab = "reactors" | "visitors" | "trending" | "auto-reply";

interface Reactor {
  id: string;
  postUrn: string;
  reactorLinkedInId: string;
  reactorName: string;
  reactorHeadline: string | null;
  reactorProfileUrl: string | null;
  reactorAvatarUrl: string | null;
  action: "like" | "comment";
  commentText: string | null;
  capturedAt: string;
  syncedToCrmAt: string | null;
  ignored: boolean;
  contact: { id: string; prenom: string; nom: string; entreprise: string; poste: string; score: number } | null;
}

interface ProfileVisitor {
  id: string;
  visitorName: string;
  visitorHeadline: string | null;
  visitorProfileUrl: string | null;
  visitedAt: string;
  note: string | null;
  syncedToCrmAt: string | null;
  ignored: boolean;
  contact: { id: string; prenom: string; nom: string; entreprise: string; poste: string; score: number } | null;
}

interface TrendingTopic {
  id: string;
  topic: string;
  angle: string;
  heat: "hot" | "warm" | "rising";
  suggestedHook: string;
  sourceUrl: string | null;
  detectedAt: string;
  status: "new" | "selected" | "commented" | "archived" | "failed";
  targetPostUrn: string | null;
  targetPostExcerpt: string | null;
  commentText: string | null;
  commentUrn: string | null;
  postedAt: string | null;
  error: string | null;
}

interface EngagementSettings {
  engagementAutoReply: boolean;
  engagementMaxDailyComments: number;
  engagementTone: "expert" | "analytical" | "contrarian" | "casual";
  engagementMinHoursBetween: number;
  // Phase 6.1 — Voice fingerprint + humanization
  engagementVoiceSamples?: string[];
  engagementHumanization?: boolean;
}

interface CommentPreview {
  comment: string;
  tone: string;
  model: string;
  passes: number;
  humannessScore: {
    openingVariation: number;
    specificity: number;
    sentenceRhythm: number;
    vocabularyNaturalness: number;
    opinionStrength: number;
    overall: number;
    feedback: string[];
  } | null;
  voiceFingerprintApplied: boolean;
}

interface ExpertCommentVariant {
  text: string;
  tone: string;
  model: string;
  fixedViolations: string[];
}

const HEAT_COLORS: Record<string, string> = {
  hot: "bg-red-500/15 text-red-400 border-red-500/30",
  warm: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  rising: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  selected: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  commented: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  archived: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function EngagementView() {
  const [activeTab, setActiveTab] = useState<Tab>("reactors");
  const [reactors, setReactors] = useState<Reactor[]>([]);
  const [visitors, setVisitors] = useState<ProfileVisitor[]>([]);
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [settings, setSettings] = useState<EngagementSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncingCrm, setSyncingCrm] = useState(false);

  // Form state for visitor manual add
  const [newVisitor, setNewVisitor] = useState({
    visitorName: "",
    visitorHeadline: "",
    visitorProfileUrl: "",
    note: "",
  });

  // Form state for trending manual add
  const [newTopic, setNewTopic] = useState({
    topic: "",
    angle: "",
    suggestedHook: "",
  });

  // Generated variants per topic
  const [variantsByTopic, setVariantsByTopic] = useState<Record<string, ExpertCommentVariant[]>>({});
  const [generatingForTopic, setGeneratingForTopic] = useState<string | null>(null);

  const fetchReactors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/reactors?limit=200");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReactors(Array.isArray(data) ? data : []);
    } catch {
      setReactors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/profile-visitors?limit=200");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setVisitors(Array.isArray(data) ? data : []);
    } catch {
      setVisitors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/trending?limit=100");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTrending(Array.isArray(data) ? data : []);
    } catch {
      setTrending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/data/engagement-settings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSettings(data);
    } catch {
      // Use defaults
      setSettings({
        engagementAutoReply: false,
        engagementMaxDailyComments: 3,
        engagementTone: "expert",
        engagementMinHoursBetween: 2,
        engagementVoiceSamples: [],
        engagementHumanization: true,
      });
    }
  }, []);

  useEffect(() => {
    if (activeTab === "reactors") fetchReactors();
    else if (activeTab === "visitors") fetchVisitors();
    else if (activeTab === "trending") fetchTrending();
    else if (activeTab === "auto-reply") fetchSettings();
  }, [activeTab, fetchReactors, fetchVisitors, fetchTrending, fetchSettings]);

  const handleSyncCrm = async () => {
    setSyncingCrm(true);
    try {
      const res = await fetch("/api/data/reactors/sync-crm", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      toast.success("Sync CRM terminée", {
        description: `${result.created} créés, ${result.linked} liés, ${result.skipped} ignorés`,
      });
      fetchReactors();
    } catch (err) {
      toast.error("Échec de la sync CRM", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setSyncingCrm(false);
    }
  };

  const handleIgnoreReactor = async (id: string, ignored: boolean) => {
    try {
      const res = await fetch(`/api/data/reactors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignored: !ignored }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReactors((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ignored: !ignored } : r)),
      );
    } catch {
      toast.error("Impossible de modifier le réacteur");
    }
  };

  const handleAddVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVisitor.visitorName.trim()) {
      toast.error("Le nom du visiteur est requis");
      return;
    }
    try {
      const res = await fetch("/api/data/profile-visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorName: newVisitor.visitorName,
          visitorHeadline: newVisitor.visitorHeadline || undefined,
          visitorProfileUrl: newVisitor.visitorProfileUrl || undefined,
          note: newVisitor.note || undefined,
          syncToCrm: true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Visiteur ajouté", {
        description: "Créé comme contact tiède (score 60) dans le CRM",
      });
      setNewVisitor({ visitorName: "", visitorHeadline: "", visitorProfileUrl: "", note: "" });
      fetchVisitors();
    } catch (err) {
      toast.error("Échec de l'ajout", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.topic.trim()) {
      toast.error("Le sujet est requis");
      return;
    }
    try {
      const res = await fetch("/api/data/trending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: newTopic.topic,
          angle: newTopic.angle,
          suggestedHook: newTopic.suggestedHook,
          heat: "warm",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Sujet ajouté");
      setNewTopic({ topic: "", angle: "", suggestedHook: "" });
      fetchTrending();
    } catch (err) {
      toast.error("Échec de l'ajout", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  };

  const handleGenerateComment = async (topicId: string) => {
    setGeneratingForTopic(topicId);
    try {
      const res = await fetch(`/api/data/trending/${topicId}/generate-comment`, {
        method: "POST",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setVariantsByTopic((prev) => ({ ...prev, [topicId]: data.variants || [] }));
      toast.success("Commentaires générés", {
        description: `${data.variants?.length || 0} variantes prêtes`,
      });
    } catch (err) {
      toast.error("Génération échouée", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setGeneratingForTopic(null);
    }
  };

  const handleSaveSettings = async (newSettings: Partial<EngagementSettings>) => {
    try {
      const res = await fetch("/api/data/engagement-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setSettings(updated);
      toast.success("Préférences enregistrées");
    } catch (err) {
      toast.error("Échec de l'enregistrement", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  };

  const stats = {
    reactorsTotal: reactors.length,
    reactorsUnsynced: reactors.filter((r) => !r.syncedToCrmAt && !r.ignored).length,
    reactorsLikes: reactors.filter((r) => r.action === "like").length,
    reactorsComments: reactors.filter((r) => r.action === "comment").length,
    visitorsTotal: visitors.length,
    visitorsUnsynced: visitors.filter((v) => !v.syncedToCrmAt && !v.ignored).length,
    trendingNew: trending.filter((t) => t.status === "new").length,
    trendingCommented: trending.filter((t) => t.status === "commented").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-[#00D4FF]" />
          Engagement IA
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Capturez les réacteurs de vos posts, importez vos visiteurs de profil,
          et laissez l'IA engager des conversations expertes sur les sujets tendance.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-[#0F1419] border border-[#1F2937] rounded-lg p-1 w-fit">
        <TabButton active={activeTab === "reactors"} onClick={() => setActiveTab("reactors")} icon={Heart} label="Réacteurs" count={stats.reactorsUnsynced} />
        <TabButton active={activeTab === "visitors"} onClick={() => setActiveTab("visitors")} icon={Users} label="Visiteurs" count={stats.visitorsUnsynced} />
        <TabButton active={activeTab === "trending"} onClick={() => setActiveTab("trending")} icon={TrendingUp} label="Tendances" count={stats.trendingNew} />
        <TabButton active={activeTab === "auto-reply"} onClick={() => setActiveTab("auto-reply")} icon={Zap} label="Auto-Reply" />
      </div>

      {/* Tab content */}
      {activeTab === "reactors" && (
        <ReactorsTab
          reactors={reactors}
          loading={loading}
          syncingCrm={syncingCrm}
          onSyncCrm={handleSyncCrm}
          onIgnore={handleIgnoreReactor}
          onRefresh={fetchReactors}
          stats={stats}
        />
      )}

      {activeTab === "visitors" && (
        <VisitorsTab
          visitors={visitors}
          loading={loading}
          newVisitor={newVisitor}
          setNewVisitor={setNewVisitor}
          onAdd={handleAddVisitor}
          onRefresh={fetchVisitors}
          stats={stats}
        />
      )}

      {activeTab === "trending" && (
        <TrendingTab
          trending={trending}
          loading={loading}
          newTopic={newTopic}
          setNewTopic={setNewTopic}
          onAdd={handleAddTopic}
          onGenerate={handleGenerateComment}
          generatingForTopic={generatingForTopic}
          variantsByTopic={variantsByTopic}
          onRefresh={fetchTrending}
        />
      )}

      {activeTab === "auto-reply" && settings && (
        <AutoReplyTab settings={settings} onSave={handleSaveSettings} stats={stats} />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-[#00D4FF] text-black"
          : "text-gray-400 hover:text-white hover:bg-[#1F2937]"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {count !== undefined && count > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-xs ${active ? "bg-black/20" : "bg-[#1F2937] text-[#00D4FF]"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number | string; accent: string }) {
  return (
    <div className="bg-[#0F1419] border border-[#1F2937] rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        {label}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function ReactorsTab({
  reactors,
  loading,
  syncingCrm,
  onSyncCrm,
  onIgnore,
  onRefresh,
  stats,
}: {
  reactors: Reactor[];
  loading: boolean;
  syncingCrm: boolean;
  onSyncCrm: () => void;
  onIgnore: (id: string, ignored: boolean) => void;
  onRefresh: () => void;
  stats: { reactorsTotal: number; reactorsUnsynced: number; reactorsLikes: number; reactorsComments: number };
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Heart} label="Total réacteurs" value={stats.reactorsTotal} accent="text-red-400" />
        <StatCard icon={ThumbsUp} label="Likes" value={stats.reactorsLikes} accent="text-blue-400" />
        <StatCard icon={MessageCircle} label="Commentaires" value={stats.reactorsComments} accent="text-purple-400" />
        <StatCard icon={Users} label="Non synchronisés CRM" value={stats.reactorsUnsynced} accent="text-orange-400" />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSyncCrm}
          disabled={syncingCrm || stats.reactorsUnsynced === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[#00D4FF] text-black rounded-md text-sm font-medium hover:bg-[#00B8D9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {syncingCrm ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncingCrm ? "Synchronisation..." : "Sync vers CRM"}
        </button>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-[#1F2937] text-white rounded-md text-sm font-medium hover:bg-[#374151] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
        <p className="text-xs text-gray-500 ml-auto">
          Capturés automatiquement toutes les 2h via le cron reactor-capture
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
        </div>
      ) : reactors.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Aucun réacteur capturé"
          description="Une fois que vous publiez sur LinkedIn, les likes et commentaires seront capturés ici automatiquement toutes les 2 heures."
        />
      ) : (
        <div className="space-y-2">
          {reactors.map((r) => (
            <div
              key={r.id}
              className={`flex items-start gap-3 p-3 bg-[#0F1419] border border-[#1F2937] rounded-lg ${
                r.ignored ? "opacity-50" : ""
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {r.reactorAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.reactorAvatarUrl} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#1F2937] flex items-center justify-center text-xs text-gray-400">
                    {r.reactorName.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{r.reactorName || "Anonyme"}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-xs ${
                      r.action === "like"
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-purple-500/15 text-purple-400"
                    }`}
                  >
                    {r.action === "like" ? "Like" : "Commentaire"}
                  </span>
                  {r.syncedToCrmAt && (
                    <span className="px-1.5 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-400">
                      CRM
                    </span>
                  )}
                  {r.ignored && (
                    <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-500/15 text-gray-400">
                      Ignoré
                    </span>
                  )}
                </div>
                {r.reactorHeadline && (
                  <p className="text-xs text-gray-400 mt-0.5">{r.reactorHeadline}</p>
                )}
                {r.commentText && (
                  <p className="text-xs text-gray-300 mt-1 line-clamp-2 italic">
                    "{r.commentText}"
                  </p>
                )}
                {r.contact && (
                  <p className="text-xs text-[#00D4FF] mt-1">
                    Contact: {r.contact.prenom} {r.contact.nom} · score {r.contact.score}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center gap-1">
                {r.reactorProfileUrl && (
                  <a
                    href={r.reactorProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1F2937] rounded-md transition-colors"
                    title="Voir le profil LinkedIn"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => onIgnore(r.id, r.ignored)}
                  className={`p-1.5 rounded-md transition-colors ${
                    r.ignored
                      ? "text-gray-500 hover:text-white hover:bg-[#1F2937]"
                      : "text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                  }`}
                  title={r.ignored ? "Restaurer" : "Ignorer (pas un lead)"}
                >
                  {r.ignored ? <Plus className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VisitorsTab({
  visitors,
  loading,
  newVisitor,
  setNewVisitor,
  onAdd,
  onRefresh,
  stats,
}: {
  visitors: ProfileVisitor[];
  loading: boolean;
  newVisitor: { visitorName: string; visitorHeadline: string; visitorProfileUrl: string; note: string };
  setNewVisitor: (v: { visitorName: string; visitorHeadline: string; visitorProfileUrl: string; note: string }) => void;
  onAdd: (e: React.FormEvent) => void;
  onRefresh: () => void;
  stats: { visitorsTotal: number; visitorsUnsynced: number };
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="Visiteurs importés" value={stats.visitorsTotal} accent="text-blue-400" />
        <StatCard icon={AlertTriangle} label="En attente de sync CRM" value={stats.visitorsUnsynced} accent="text-orange-400" />
      </div>

      <div className="bg-[#0F1419] border border-[#1F2937] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#00D4FF]" />
          Ajouter un visiteur manuellement
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          LinkedIn Premium uniquement: copiez les noms depuis "Qui a consulté votre profil"
          et ajoutez-les ici. Chaque visiteur devient un contact tiède (score 60) dans votre CRM.
        </p>
        <form onSubmit={onAdd} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Nom complet *"
              value={newVisitor.visitorName}
              onChange={(e) => setNewVisitor({ ...newVisitor, visitorName: e.target.value })}
              className="bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]"
            />
            <input
              type="text"
              placeholder="Titre / poste (ex: Head of Growth @ Acme)"
              value={newVisitor.visitorHeadline}
              onChange={(e) => setNewVisitor({ ...newVisitor, visitorHeadline: e.target.value })}
              className="bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]"
            />
          </div>
          <input
            type="url"
            placeholder="URL profil LinkedIn (https://www.linkedin.com/in/...)"
            value={newVisitor.visitorProfileUrl}
            onChange={(e) => setNewVisitor({ ...newVisitor, visitorProfileUrl: e.target.value })}
            className="w-full bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]"
          />
          <textarea
            placeholder="Note (optionnel)"
            value={newVisitor.note}
            onChange={(e) => setNewVisitor({ ...newVisitor, note: e.target.value })}
            rows={2}
            className="w-full bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]"
          />
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-[#00D4FF] text-black rounded-md text-sm font-medium hover:bg-[#00B8D9] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter au CRM
          </button>
        </form>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Visiteurs importés ({visitors.length})</h3>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#1F2937] text-white rounded-md text-xs font-medium hover:bg-[#374151] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
        </div>
      ) : visitors.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun visiteur importé"
          description="Ajoutez manuellement les visiteurs depuis votre dashboard LinkedIn Premium. LinkedIn ne expose pas cette donnée via l'API standard."
        />
      ) : (
        <div className="space-y-2">
          {visitors.map((v) => (
            <div key={v.id} className="flex items-start gap-3 p-3 bg-[#0F1419] border border-[#1F2937] rounded-lg">
              <div className="w-8 h-8 rounded-full bg-[#1F2937] flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                {v.visitorName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{v.visitorName}</span>
                  {v.syncedToCrmAt && (
                    <span className="px-1.5 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-400">
                      CRM
                    </span>
                  )}
                </div>
                {v.visitorHeadline && <p className="text-xs text-gray-400 mt-0.5">{v.visitorHeadline}</p>}
                {v.note && <p className="text-xs text-gray-300 mt-1 italic">{v.note}</p>}
                {v.contact && (
                  <p className="text-xs text-[#00D4FF] mt-1">
                    Contact: {v.contact.prenom} {v.contact.nom} · score {v.contact.score}
                  </p>
                )}
              </div>
              {v.visitorProfileUrl && (
                <a
                  href={v.visitorProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1F2937] rounded-md transition-colors flex-shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendingTab({
  trending,
  loading,
  newTopic,
  setNewTopic,
  onAdd,
  onGenerate,
  generatingForTopic,
  variantsByTopic,
  onRefresh,
}: {
  trending: TrendingTopic[];
  loading: boolean;
  newTopic: { topic: string; angle: string; suggestedHook: string };
  setNewTopic: (v: { topic: string; angle: string; suggestedHook: string }) => void;
  onAdd: (e: React.FormEvent) => void;
  onGenerate: (id: string) => void;
  generatingForTopic: string | null;
  variantsByTopic: Record<string, ExpertCommentVariant[]>;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-[#0F1419] border border-[#1F2937] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#00D4FF]" />
          Ajouter un sujet manuellement
        </h3>
        <form onSubmit={onAdd} className="space-y-3">
          <input
            type="text"
            placeholder="Sujet (ex: AI agents B2B prospection) *"
            value={newTopic.topic}
            onChange={(e) => setNewTopic({ ...newTopic, topic: e.target.value })}
            className="w-full bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]"
          />
          <input
            type="text"
            placeholder="Angle spécifique (ex: coût d'acquisition comparé)"
            value={newTopic.angle}
            onChange={(e) => setNewTopic({ ...newTopic, angle: e.target.value })}
            className="w-full bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]"
          />
          <input
            type="text"
            placeholder="Hook suggéré"
            value={newTopic.suggestedHook}
            onChange={(e) => setNewTopic({ ...newTopic, suggestedHook: e.target.value })}
            className="w-full bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]"
          />
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-[#00D4FF] text-black rounded-md text-sm font-medium hover:bg-[#00B8D9] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </form>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Sujets tendance ({trending.length})</h3>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#1F2937] text-white rounded-md text-xs font-medium hover:bg-[#374151] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
        </div>
      ) : trending.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Aucun sujet tendance"
          description="Les sujets tendance sont détectés automatiquement chaque jour à 6h UTC par le cron trending-detect, en fonction de votre ICP. Vous pouvez aussi en ajouter manuellement ci-dessus."
        />
      ) : (
        <div className="space-y-3">
          {trending.map((t) => (
            <div key={t.id} className="bg-[#0F1419] border border-[#1F2937] rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-sm font-semibold text-white">{t.topic}</h4>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs border ${HEAT_COLORS[t.heat]}`}>
                      {t.heat}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs border ${STATUS_COLORS[t.status]}`}>
                      {t.status}
                    </span>
                  </div>
                  {t.angle && <p className="text-xs text-gray-400">{t.angle}</p>}
                  {t.suggestedHook && (
                    <p className="text-xs text-gray-300 mt-1 italic">Hook: "{t.suggestedHook}"</p>
                  )}
                  {t.sourceUrl && (
                    <a
                      href={t.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#00D4FF] hover:underline mt-1 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Source
                    </a>
                  )}
                </div>
              </div>

              {t.status === "commented" && t.commentText && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-md p-2">
                  <p className="text-xs text-emerald-400 mb-1 font-medium">Commentaire publié:</p>
                  <p className="text-xs text-gray-200">{t.commentText}</p>
                  {t.postedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Posté le {new Date(t.postedAt).toLocaleString("fr-FR")}
                    </p>
                  )}
                </div>
              )}

              {t.status === "failed" && t.error && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-md p-2">
                  <p className="text-xs text-red-400">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Erreur: {t.error}
                  </p>
                </div>
              )}

              {t.status === "new" && (
                <button
                  onClick={() => onGenerate(t.id)}
                  disabled={generatingForTopic === t.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30 rounded-md text-xs font-medium hover:bg-[#00D4FF]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generatingForTopic === t.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {generatingForTopic === t.id ? "Génération..." : "Générer un commentaire expert"}
                </button>
              )}

              {variantsByTopic[t.id] && variantsByTopic[t.id].length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 font-medium">
                    Variantes générées ({variantsByTopic[t.id].length}) — sélectionnez celle à publier:
                  </p>
                  {variantsByTopic[t.id].map((v, i) => (
                    <div key={i} className="bg-[#080C10] border border-[#1F2937] rounded-md p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#1F2937] text-gray-300">
                          {v.tone}
                        </span>
                        <span className="text-xs text-gray-500">{v.text.length} caractères</span>
                        {v.fixedViolations.length > 0 && (
                          <span className="text-xs text-yellow-500" title={v.fixedViolations.join(", ")}>
                            {v.fixedViolations.length} correction(s) auto
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-200">{v.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AutoReplyTab({
  settings,
  onSave,
  stats,
}: {
  settings: EngagementSettings;
  onSave: (s: Partial<EngagementSettings>) => void;
  stats: { trendingNew: number; trendingCommented: number };
}) {
  const [local, setLocal] = useState(settings);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={TrendingUp} label="Sujets en attente" value={stats.trendingNew} accent="text-blue-400" />
        <StatCard icon={Check} label="Commentaires publiés" value={stats.trendingCommented} accent="text-emerald-400" />
      </div>

      <div className="bg-[#0F1419] border border-[#1F2937] rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-[#00D4FF]" />
          <h3 className="text-sm font-semibold text-white">Configuration Auto-Reply</h3>
        </div>

        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-md p-3">
          <p className="text-xs text-yellow-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              L'Auto-Reply publie automatiquement des commentaires expertes sur des posts LinkedIn
              liés à vos sujets tendance. Désactivé par défaut. Activé, il respecte vos limites
              LinkedIn compliance (max 12 commentaires/jour) et la limite ci-dessous.
            </span>
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-white">Activer l'Auto-Reply</p>
              <p className="text-xs text-gray-400">
                Publie automatiquement des commentaires sur les sujets tendance détectés
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLocal({ ...local, engagementAutoReply: !local.engagementAutoReply })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                local.engagementAutoReply ? "bg-[#00D4FF]" : "bg-[#1F2937]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  local.engagementAutoReply ? "translate-x-5" : ""
                }`}
              />
            </button>
          </label>

          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Commentaires maximum par jour
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Plafond quotidien pour les commentaires publiés par l'IA (1-5)
            </p>
            <input
              type="number"
              min={1}
              max={5}
              value={local.engagementMaxDailyComments}
              onChange={(e) =>
                setLocal({ ...local, engagementMaxDailyComments: parseInt(e.target.value, 10) || 1 })
              }
              className="w-24 bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00D4FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Heures minimum entre deux commentaires
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Espacement temporel pour paraître humain (1-24h)
            </p>
            <input
              type="number"
              min={1}
              max={24}
              step={0.5}
              value={local.engagementMinHoursBetween}
              onChange={(e) =>
                setLocal({ ...local, engagementMinHoursBetween: parseFloat(e.target.value) || 1 })
              }
              className="w-24 bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00D4FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Ton de l'IA</label>
            <p className="text-xs text-gray-400 mb-2">
              Style de commentaire généré (indétectable comme IA dans tous les cas)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(["expert", "analytical", "contrarian", "casual"] as const).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setLocal({ ...local, engagementTone: tone })}
                  className={`px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
                    local.engagementTone === tone
                      ? "bg-[#00D4FF] text-black border-[#00D4FF]"
                      : "bg-[#080C10] text-gray-400 border-[#1F2937] hover:border-[#00D4FF]/50"
                  }`}
                >
                  {tone === "expert" && "Expert"}
                  {tone === "analytical" && "Analytique"}
                  {tone === "contrarian" && "Contrarien"}
                  {tone === "casual" && "Casual"}
                </button>
              ))}
            </div>
          </div>

          {/* Phase 6.1 — Humanization toggle */}
          <div>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-white">Humanisation multi-passes</p>
                <p className="text-xs text-gray-400">
                  Audit IA + régénération jusqu'à 3 passes (score 7.5/10 minimum)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLocal({ ...local, engagementHumanization: !local.engagementHumanization })}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  local.engagementHumanization ? "bg-[#00D4FF]" : "bg-[#1F2937]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    local.engagementHumanization ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        <button
          onClick={() => onSave(local)}
          className="flex items-center gap-2 px-4 py-2 bg-[#00D4FF] text-black rounded-md text-sm font-medium hover:bg-[#00B8D9] transition-colors"
        >
          <Check className="w-4 h-4" />
          Enregistrer
        </button>
      </div>

      {/* Phase 6.1 — Voice Fingerprint */}
      <VoiceFingerprintCard
        samples={local.engagementVoiceSamples ?? []}
        onChange={(samples) => setLocal({ ...local, engagementVoiceSamples: samples })}
        onSave={() => onSave(local)}
      />

      {/* Phase 6.1 — Comment Preview */}
      <CommentPreviewCard
        tone={local.engagementTone}
        humanizationEnabled={local.engagementHumanization ?? true}
        voiceSamplesCount={local.engagementVoiceSamples?.length ?? 0}
      />

      <div className="bg-[#0F1419] border border-[#1F2937] rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-2">Comment ça marche</h4>
        <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
          <li>Le cron <code className="text-[#00D4FF]">trending-detect</code> (quotidien 6h UTC) détecte les sujets tendance dans votre niche</li>
          <li>Le cron <code className="text-[#00D4FF]">trending-engage</code> (toutes les 2h) prend chaque sujet en attente</li>
          <li>Pour chaque sujet, il cherche un post LinkedIn pertinent via web search</li>
          <li>L'IA génère un commentaire expert (anti-détection: pas de tics, pas d'émojis, micro-détail spécifique)</li>
          {local.engagementHumanization && (
            <li className="text-[#00D4FF]">Phase 6.1 — Le commentaire est audit + régénéré jusqu'à 3 passes pour atteindre un score d'humain 7.5/10</li>
          )}
          <li>Le commentaire est publié via l'API LinkedIn, dans le respect de vos limites</li>
          <li>Le sujet est marqué comme "commented" avec le texte et l'URN du commentaire</li>
        </ol>
      </div>
    </div>
  );
}

/**
 * Phase 6.1 — Voice Fingerprint card
 *
 * Lets the user paste 3-5 of their real LinkedIn comments. The samples are
 * stored on UserSettings.engagementVoiceSamples and used by the humanizer
 * to mimic the user's voice (avg sentence length, preferred openers,
 * vocabulary, punctuation profile).
 */
function VoiceFingerprintCard({
  samples,
  onChange,
  onSave,
}: {
  samples: string[];
  onChange: (samples: string[]) => void;
  onSave: () => void;
}) {
  const [draft, setDraft] = useState("");

  const addSample = () => {
    const trimmed = draft.trim();
    if (trimmed.length < 20) return;
    if (trimmed.length > 500) return;
    if (samples.length >= 5) return;
    onChange([...samples, trimmed]);
    setDraft("");
  };

  const removeSample = (idx: number) => {
    onChange(samples.filter((_, i) => i !== idx));
  };

  const ready = samples.length >= 3;

  return (
    <div className="bg-[#0F1419] border border-[#1F2937] rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-[#00D4FF]" />
        <h3 className="text-sm font-semibold text-white">Empreinte vocale</h3>
        {ready && (
          <span className="ml-auto text-xs px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">
            {samples.length}/5 actives
          </span>
        )}
        {!ready && (
          <span className="ml-auto text-xs px-2 py-0.5 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full">
            {samples.length}/5 — min 3
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Collez 3 à 5 de vos VRAIS commentaires LinkedIn. L'IA en extrait votre signature vocale
        (longueur moyenne de phrases, ouvertures préférées, vocabulaire récurrent) et l'imite
        lors de la génération. Le commentaire produit ressemblera à VOTRE écriture, pas à un
        expert générique.
      </p>

      {samples.length > 0 && (
        <div className="space-y-2">
          {samples.map((s, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-[#080C10] border border-[#1F2937] rounded-md p-3">
              <p className="text-xs text-gray-300 flex-1 line-clamp-3">{s}</p>
              <button
                onClick={() => removeSample(idx)}
                className="text-gray-500 hover:text-red-400 transition-colors"
                aria-label="Supprimer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {samples.length < 5 && (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Collez un de vos commentaires LinkedIn ici (20-500 caractères)..."
            rows={3}
            className="w-full bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D4FF] resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{draft.trim().length} caractères</span>
            <button
              onClick={addSample}
              disabled={draft.trim().length < 20 || draft.trim().length > 500}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#00D4FF] text-black rounded-md text-xs font-medium hover:bg-[#00B8D9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-3 h-3" />
              Ajouter
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onSave}
        className="flex items-center gap-2 px-4 py-2 bg-[#00D4FF] text-black rounded-md text-sm font-medium hover:bg-[#00B8D9] transition-colors"
      >
        <Check className="w-4 h-4" />
        Enregistrer l'empreinte
      </button>
    </div>
  );
}

/**
 * Phase 6.1 — Comment Preview card
 *
 * Lets the user test the humanization pipeline by pasting a sample LinkedIn
 * post and seeing the generated comment, its humanness score (5 criteria),
 * and the number of passes the pipeline took.
 */
function CommentPreviewCard({
  tone,
  humanizationEnabled,
  voiceSamplesCount,
}: {
  tone: string;
  humanizationEnabled: boolean;
  voiceSamplesCount: number;
}) {
  const [postText, setPostText] = useState("");
  const [preview, setPreview] = useState<CommentPreview | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (postText.trim().length < 10) return;
    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch("/api/data/engagement-settings/preview-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postText }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPreview(data);
    } catch (err) {
      toast.error("Échec de génération du commentaire de preview", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0F1419] border border-[#1F2937] rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-[#00D4FF]" />
        <h3 className="text-sm font-semibold text-white">Test du pipeline d'humanisation</h3>
      </div>

      <p className="text-xs text-gray-400">
        Collez un post LinkedIn pour voir le commentaire que l'IA génère, avec son score
        d'humain sur 5 critères. {humanizationEnabled ? "Multi-passes activé." : "Multi-passes désactivé."}{" "}
        Ton: <span className="text-[#00D4FF]">{tone}</span>.{" "}
        {voiceSamplesCount >= 3 ? `Empreinte vocale active (${voiceSamplesCount}/5).` : "Pas d'empreinte vocale (min 3 samples)."}
      </p>

      <div className="space-y-2">
        <textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="Collez ici le texte d'un post LinkedIn..."
          rows={5}
          className="w-full bg-[#080C10] border border-[#1F2937] rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D4FF] resize-none"
        />
        <button
          onClick={generate}
          disabled={postText.trim().length < 10 || loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#00D4FF] text-black rounded-md text-sm font-medium hover:bg-[#00B8D9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {loading ? "Génération..." : "Générer un commentaire test"}
        </button>
      </div>

      {preview && (
        <div className="space-y-3 border-t border-[#1F2937] pt-4">
          <div className="bg-[#080C10] border border-[#1F2937] rounded-md p-3">
            <p className="text-xs text-gray-500 mb-2">Commentaire généré</p>
            <p className="text-sm text-white leading-relaxed">{preview.comment}</p>
          </div>

          {preview.humannessScore && (
            <div className="bg-[#080C10] border border-[#1F2937] rounded-md p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Score d'humain</p>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${
                    preview.humannessScore.overall >= 8 ? "text-emerald-400" :
                    preview.humannessScore.overall >= 7 ? "text-[#00D4FF]" :
                    "text-yellow-400"
                  }`}>
                    {preview.humannessScore.overall.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-500">/ 10</span>
                  <span className="text-xs text-gray-500 ml-2">({preview.passes} passe{preview.passes > 1 ? "s" : ""})</span>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: "Ouverture", value: preview.humannessScore.openingVariation },
                  { label: "Spécificité", value: preview.humannessScore.specificity },
                  { label: "Rythme", value: preview.humannessScore.sentenceRhythm },
                  { label: "Vocabulaire", value: preview.humannessScore.vocabularyNaturalness },
                  { label: "Opinion", value: preview.humannessScore.opinionStrength },
                ].map((c) => (
                  <div key={c.label} className="bg-[#0F1419] rounded p-2">
                    <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                    <p className={`text-sm font-semibold ${
                      c.value >= 8 ? "text-emerald-400" :
                      c.value >= 6 ? "text-[#00D4FF]" :
                      "text-yellow-400"
                    }`}>{c.value.toFixed(1)}</p>
                  </div>
                ))}
              </div>

              {preview.humannessScore.feedback.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Feedback audit</p>
                  <ul className="text-xs text-gray-400 space-y-0.5 list-disc list-inside">
                    {preview.humannessScore.feedback.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Modèle: <span className="text-gray-400">{preview.model}</span></span>
            {preview.voiceFingerprintApplied && (
              <span className="px-2 py-0.5 bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30 rounded-full">
                Empreinte vocale appliquée
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-12 bg-[#0F1419] border border-[#1F2937] rounded-lg">
      <Icon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-400 max-w-md mx-auto">{description}</p>
    </div>
  );
}
