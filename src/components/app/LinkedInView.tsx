"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore, type LinkedInPost, type ScheduledPost } from "@/store/appStore";
import {
  generatePostSuggestions,
  generateCommentSuggestions,
  generateTrendingTopics,
  improvePost,
  getBestPostingTimes,
  getNextBestTime,
  analyzeMyPosts,
  generateExpertPosts,
} from "@/lib/linkedin-ai";
import type {
  LinkedInPostSuggestion,
  LinkedInCommentSuggestion,
  TrendingTopic,
  BestTimeSlot,
  PostAnalysis,
} from "@/lib/linkedin-ai";
import {
  Linkedin,
  Link2,
  Unlink,
  Send,
  ThumbsUp,
  MessageCircle,
  Globe,
  Users,
  Sparkles,
  Search,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  Activity,
  Eye,
  X,
  RotateCcw,
  Calendar,
  Wand2,
  CalendarClock,
  Timer,
  BarChart3,
  Flame,
  ArrowUpRight,
  TrendingUp,
  Copy,
  Trash2,
  Brain,
  Target,
  Lightbulb,
  Star,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type LinkedInTab = "connexion" | "publier" | "planifier" | "feed" | "engager" | "tendances" | "expert";

export default function LinkedInView() {
  const [activeTab, setActiveTab] = useState<LinkedInTab>("connexion");
  const [prefillTopic, setPrefillTopic] = useState<string | null>(null);
  const [prefillPostText, setPrefillPostText] = useState<string | null>(null);

  const handleUseTopic = (topic: string) => {
    setPrefillTopic(topic);
    setActiveTab("publier");
  };

  const handleUsePost = (postText: string) => {
    setPrefillPostText(postText);
    setActiveTab("publier");
  };

  const tabs: { id: LinkedInTab; label: string; icon: React.ElementType }[] = [
    { id: "connexion", label: "Connexion", icon: Link2 },
    { id: "publier", label: "Publier", icon: Send },
    { id: "planifier", label: "Planifier", icon: CalendarClock },
    { id: "feed", label: "Feed", icon: Eye },
    { id: "engager", label: "Engager", icon: Zap },
    { id: "tendances", label: "Tendances", icon: TrendingUp },
    { id: "expert", label: "Expert", icon: Brain },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0A66C2]/15 border border-[#0A66C2]/20 flex items-center justify-center">
            <Linkedin className="w-5 h-5 text-[#0A66C2]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">LinkedIn</h1>
            <p className="text-sm text-[#7B8A9A] mt-0.5">Intégration OAuth 2.0 — Publication, planification et prospection</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-[#0F1520] border border-white/[0.06] rounded-xl p-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all flex-1 justify-center cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[#0A66C2]/15 text-[#0A66C2] border border-[#0A66C2]/20"
                  : "text-[#7B8A9A] hover:text-[#F0F4F8] hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "connexion" && <ConnexionTab />}
          {activeTab === "publier" && <PublierTab prefillTopic={prefillTopic} prefillPostText={prefillPostText} onClearPrefill={() => { setPrefillTopic(null); setPrefillPostText(null); }} />}
          {activeTab === "planifier" && <PlanifierTab />}
          {activeTab === "feed" && <FeedTab />}
          {activeTab === "engager" && <EngagerTab />}
          {activeTab === "tendances" && <TendancesTab onUseTopic={handleUseTopic} />}
          {activeTab === "expert" && <ExpertTab onUsePost={handleUsePost} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ========== CONNEXION TAB ========== */
function ConnexionTab() {
  const {
    linkedInConnected,
    setLinkedInConnected,
    linkedInProfile,
    setLinkedInProfile,
    linkedInConfig,
    updateLinkedInConfig,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);

  useEffect(() => { checkConnection(); }, []);

  const checkConnection = async () => {
    setCheckingConnection(true);
    try {
      const res = await fetch("/api/linkedin/me");
      if (res.ok) {
        const data = await res.json();
        setLinkedInConnected(true);
        setLinkedInProfile({
          id: data.id,
          firstName: data.firstName,
          lastName: data.lastName,
          profilePictureUrl: data.profilePictureUrl || null,
          headline: data.headline || null,
        });
      } else {
        setLinkedInConnected(false);
        setLinkedInProfile(null);
      }
    } catch {
      setLinkedInConnected(false);
      setLinkedInProfile(null);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleConnect = async () => {
    setError(null);
    if (!linkedInConfig.clientId) {
      setError("Veuillez configurer votre Client ID LinkedIn dans les Paramètres avant de vous connecter.");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailPattern.test(linkedInConfig.clientId)) {
      setError("Le Client ID LinkedIn n'est pas une adresse email. C'est un identifiant alphanumérique (ex: 78abcdefghijk) obtenu depuis le LinkedIn Developer Portal.");
      return;
    }
    if (linkedInConfig.clientId.length < 3) {
      setError("Le Client ID LinkedIn semble trop court. Vérifiez la valeur copiée depuis le LinkedIn Developer Portal.");
      return;
    }
    setLoading(true);
    try {
      const redirectUri = linkedInConfig.redirectUri || `${window.location.origin}/api/linkedin/callback`;
      const prepareRes = await fetch("/api/linkedin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: linkedInConfig.clientId, clientSecret: linkedInConfig.clientSecret || undefined, redirectUri }),
      });
      if (!prepareRes.ok) {
        const data = await prepareRes.json().catch(() => ({ error: "Erreur de validation" }));
        setError(data.error || "Client ID invalide. Vérifiez votre configuration LinkedIn.");
        setLoading(false);
        return;
      }
      const origin = window.location.origin;
      window.location.href = `/api/linkedin/auth?origin=${encodeURIComponent(origin)}&client_id=${encodeURIComponent(linkedInConfig.clientId)}`;
    } catch {
      setError("Erreur lors de la redirection vers LinkedIn.");
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try { await fetch("/api/linkedin/disconnect", { method: "POST" }); } catch { /* */ }
    setLinkedInConnected(false);
    setLinkedInProfile(null);
  };

  if (checkingConnection) {
    return (
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-12 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#0A66C2] animate-spin mb-3" />
        <p className="text-[13px] text-[#7B8A9A]">Vérification de la connexion LinkedIn...</p>
      </div>
    );
  }

  if (!linkedInConnected) {
    return (
      <div className="space-y-4">
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-6">
          <div className="text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#0A66C2]/15 border border-[#0A66C2]/20 flex items-center justify-center mx-auto mb-4">
              <Linkedin className="w-8 h-8 text-[#0A66C2]" />
            </div>
            <h3 className="text-lg font-semibold text-[#F0F4F8] mb-2">Connecter votre compte LinkedIn</h3>
            <p className="text-[13px] text-[#7B8A9A] mb-6">Autorisez HERMÈS à publier, liker et commenter en votre nom sur LinkedIn via OAuth 2.0.</p>
            <div className="space-y-3 text-left mb-6">
              <div>
                <label className="text-[12px] font-medium text-[#7B8A9A] mb-1.5 block">Client ID LinkedIn</label>
                <input type="text" value={linkedInConfig.clientId} onChange={(e) => updateLinkedInConfig({ clientId: e.target.value })} placeholder="78abcdefghijk..."
                  className={`w-full bg-[#18212F] border rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] font-mono placeholder:text-[#7B8A9A]/50 focus:outline-none ${linkedInConfig.clientId && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkedInConfig.clientId) ? "border-[#E5263A]/40 focus:border-[#E5263A]/60" : "border-white/[0.06] focus:border-[#0A66C2]/30"}`} />
                {linkedInConfig.clientId && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkedInConfig.clientId) && (
                  <p className="text-[11px] text-[#E5263A] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Ce champ attend un Client ID (alphanumérique), pas une adresse email.</p>
                )}
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#7B8A9A] mb-1.5 block">Client Secret LinkedIn</label>
                <input type="password" value={linkedInConfig.clientSecret} onChange={(e) => updateLinkedInConfig({ clientSecret: e.target.value })} placeholder="WPLxxxxxxxxxx"
                  className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] font-mono placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#0A66C2]/30" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#7B8A9A] mb-1.5 block">Redirect URI (à configurer dans LinkedIn)</label>
                <div className="flex gap-2">
                  <input type="text" readOnly value={linkedInConfig.redirectUri || `${typeof window !== "undefined" ? window.location.origin : ""}/api/linkedin/callback`}
                    className="flex-1 bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#7B8A9A] font-mono focus:outline-none cursor-text" />
                  <button onClick={() => { const uri = linkedInConfig.redirectUri || `${window.location.origin}/api/linkedin/callback`; navigator.clipboard.writeText(uri); }}
                    className="flex items-center gap-1 text-[12px] font-medium text-[#0A66C2] bg-[#0A66C2]/10 border border-[#0A66C2]/20 px-3 py-2 rounded-lg hover:bg-[#0A66C2]/15 transition-colors cursor-pointer whitespace-nowrap">Copier</button>
                </div>
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-[#F4A100] bg-[#F4A100]/5 border border-[#F4A100]/10 rounded-lg px-2.5 py-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span><strong>Étape obligatoire :</strong> Ajoutez cette URL exacte dans LinkedIn Developer Portal → My Apps → Auth → Authorized redirect URLs.</span>
                </div>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-[12px] text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20 rounded-lg px-3 py-2 mb-4">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
              </div>
            )}
            <button onClick={handleConnect} disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-[14px] font-semibold text-white bg-[#0A66C2] hover:bg-[#004182] px-6 py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
              {loading ? "Redirection..." : "Se connecter avec LinkedIn"}
            </button>
          </div>
        </div>
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <h4 className="text-sm font-semibold text-[#F0F4F8] mb-4">Comment ça fonctionne</h4>
          <div className="space-y-3">
            {[
              { step: "1", text: "Configurez votre Client ID dans les Paramètres (obtenu depuis LinkedIn Developer Portal)" },
              { step: "2", text: "Cliquez sur \"Se connecter\" — vous êtes redirigé vers LinkedIn pour autoriser l'accès" },
              { step: "3", text: "LinkedIn vous redirige ici avec un code d'autorisation sécurisé" },
              { step: "4", text: "HERMÈS échange le code contre un token d'accès (stocké en cookie sécurisé)" },
              { step: "5", text: "Vous pouvez maintenant publier, liker et commenter via l'API LinkedIn" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#0A66C2]/15 text-[#0A66C2] text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{item.step}</div>
                <p className="text-[13px] text-[#7B8A9A]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <h4 className="text-sm font-semibold text-[#F0F4F8] mb-3">Permissions requises (OpenID Connect)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { scope: "openid", desc: "Authentification OpenID Connect" },
              { scope: "profile", desc: "Lire votre profil (nom, photo)" },
              { scope: "email", desc: "Lire votre adresse email" },
              { scope: "w_member_social", desc: "Publier en votre nom" },
            ].map((perm) => (
              <div key={perm.scope} className="flex items-center gap-2 bg-[#18212F] rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00C48C] flex-shrink-0" />
                <div><code className="text-[11px] text-[#0A66C2] font-mono">{perm.scope}</code><p className="text-[11px] text-[#7B8A9A]">{perm.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#0A66C2]/15 border border-[#0A66C2]/20 flex items-center justify-center flex-shrink-0">
            {linkedInProfile?.profilePictureUrl ? (
              <img src={linkedInProfile.profilePictureUrl} alt="LinkedIn Profile" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <span className="text-2xl font-semibold text-[#0A66C2]">{linkedInProfile?.firstName?.[0] || "?"}{linkedInProfile?.lastName?.[0] || ""}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-[#F0F4F8]">{linkedInProfile?.firstName} {linkedInProfile?.lastName}</h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20 px-2 py-0.5 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-[#00C48C]" />Connecté</span>
            </div>
            {linkedInProfile?.headline && <p className="text-[13px] text-[#7B8A9A] mb-2">{linkedInProfile.headline}</p>}
            <p className="text-[11px] text-[#7B8A9A]/60 font-mono">ID: {linkedInProfile?.id}</p>
          </div>
          <button onClick={handleDisconnect} className="flex items-center gap-1.5 text-[12px] font-medium text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20 px-3 py-1.5 rounded-lg hover:bg-[#E5263A]/15 transition-colors cursor-pointer">
            <Unlink className="w-3.5 h-3.5" />Déconnecter
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Posts cette semaine" value="5" icon={Send} color="#0A66C2" />
        <StatCard label="Impressions" value="2.3K" icon={Eye} color="#00D4FF" />
        <StatCard label="Taux engagement" value="3.8%" icon={ThumbsUp} color="#00C48C" />
        <StatCard label="Dernière sync" value="À l'instant" icon={Clock} color="#F4A100" />
      </div>
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <h4 className="text-sm font-semibold text-[#F0F4F8] mb-3">Détails de la connexion</h4>
        <div className="space-y-2">
          <InfoRow label="Token" value="••••••••••••••••" />
          <InfoRow label="Portée" value="openid, profile, email, w_member_social" />
          <InfoRow label="Méthode" value="OAuth 2.0 Authorization Code" />
          <InfoRow label="Stockage" value="Cookie httpOnly sécurisé" />
          <InfoRow label="Statut" value="Valide" valueColor="text-[#00C48C]" />
        </div>
      </div>
    </div>
  );
}

/* ========== PUBLIER TAB (UPGRADED) ========== */
function PublierTab({ prefillTopic, prefillPostText, onClearPrefill }: { prefillTopic: string | null; prefillPostText: string | null; onClearPrefill: () => void }) {
  const { linkedInConnected, linkedInProfile, linkedInPosts, addLinkedInPost, addScheduledPost, templates } = useAppStore();
  const [postText, setPostText] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "CONNECTIONS">("PUBLIC");
  const [publishing, setPublishing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // AI states
  const [aiSuggestions, setAiSuggestions] = useState<LinkedInPostSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [improving, setImproving] = useState(false);
  const [aiTopic, setAiTopic] = useState("");

  const maxChars = 3000;
  const charCount = postText.length;
  const charPercentage = (charCount / maxChars) * 100;

  // Handle prefill from Tendances or Expert
  useEffect(() => {
    if (prefillTopic) {
      setPostText((prev) => prev ? prev : `Sujet : ${prefillTopic}\n\n`);
      onClearPrefill();
    }
    if (prefillPostText) {
      setPostText(prefillPostText);
      onClearPrefill();
    }
  }, [prefillTopic, prefillPostText, onClearPrefill]);

  const handleGenerateAI = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const suggestions = await generatePostSuggestions(3, undefined, aiTopic || undefined);
      setAiSuggestions(suggestions);
    } catch {
      setAiError("Impossible de générer des suggestions IA. Vérifiez votre clé API dans les Paramètres.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleImprove = async () => {
    if (!postText.trim()) return;
    setImproving(true);
    try {
      const result = await improvePost(postText);
      if (result.improved) setPostText(result.improved);
    } catch {
      setAiError("Impossible d'améliorer le post. Vérifiez votre clé API.");
    } finally {
      setImproving(false);
    }
  };

  const handlePublish = async () => {
    if (!postText.trim() || !linkedInProfile?.id) return;
    setPublishing(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/linkedin/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: postText, visibility, linkedinId: linkedInProfile.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur lors de la publication"); return; }
      setSuccess(true);
      addLinkedInPost({ id: data.postId || `post-${Date.now()}`, text: postText, createdAt: new Date().toISOString(), likes: 0, comments: 0, visibility });
      setPostText("");
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Erreur réseau lors de la publication");
    } finally {
      setPublishing(false);
    }
  };

  const handleSchedule = async () => {
    if (!postText.trim() || !scheduledAt || !linkedInProfile?.id) return;
    setScheduling(true);
    setError(null);
    try {
      const res = await fetch("/api/linkedin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: postText, visibility, linkedinId: linkedInProfile.id, scheduledAt }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur lors de la planification"); return; }
      addScheduledPost({
        id: data.postId || `sched-${Date.now()}`,
        text: postText,
        visibility,
        scheduledAt,
        status: "scheduled",
        createdAt: new Date().toISOString(),
      });
      setPostText("");
      setScheduledAt("");
      setScheduleMode(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Erreur réseau lors de la planification");
    } finally {
      setScheduling(false);
    }
  };

  const loadLastTemplate = () => { if (templates.length > 0) setPostText(templates[0].content); };

  const nextBest = getNextBestTime();

  if (!linkedInConnected) return <NotConnectedBanner />;

  return (
    <div className="space-y-4">
      {/* AI Generation Section */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00D4FF]" />
            <h3 className="text-sm font-semibold text-[#F0F4F8]">Génération IA</h3>
          </div>
          <button onClick={handleGenerateAI} disabled={aiLoading}
            className="flex items-center gap-1.5 text-[12px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-3 py-1.5 rounded-lg hover:bg-[#00D4FF]/15 transition-colors cursor-pointer disabled:opacity-50">
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            Générer avec l&apos;IA
          </button>
        </div>

        {/* Topic Input */}
        <div className="mb-4">
          <label className="text-[11px] font-medium text-[#7B8A9A] mb-1.5 flex items-center gap-1.5">
            <Target className="w-3 h-3 text-[#F4A100]" />
            Sujet (optionnel)
          </label>
          <input
            type="text"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder="Sujet ou titre (ex: Data Architecture B2B)"
            className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
          />
        </div>

        {aiError && (
          <div className="flex items-center gap-2 text-[12px] text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20 rounded-lg px-3 py-2 mb-3">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{aiError}
          </div>
        )}

        {aiLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-[#18212F] rounded-lg p-3 animate-pulse">
                <div className="h-3 bg-white/[0.06] rounded mb-2 w-3/4" />
                <div className="h-2 bg-white/[0.04] rounded mb-1.5 w-full" />
                <div className="h-2 bg-white/[0.04] rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {aiSuggestions.length > 0 && !aiLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {aiSuggestions.map((sug) => (
              <button key={sug.id} onClick={() => setPostText(sug.text)}
                className="bg-[#18212F] border border-white/[0.04] rounded-lg p-3 text-left hover:border-[#0A66C2]/30 hover:bg-[#18212F]/80 transition-all cursor-pointer group">
                <p className="text-[12px] text-[#F0F4F8] line-clamp-2 mb-2 group-hover:text-[#00D4FF] transition-colors">{sug.hook}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-medium text-[#7B8A9A] bg-white/[0.06] px-1.5 py-0.5 rounded">{sug.topic}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sug.estimatedEngagement === "high" ? "text-[#00C48C] bg-[#00C48C]/10" : "text-[#F4A100] bg-[#F4A100]/10"}`}>
                    {sug.estimatedEngagement === "high" ? "🔥 Élevé" : "📊 Moyen"}
                  </span>
                  <span className="text-[10px] font-medium text-[#0A66C2] bg-[#0A66C2]/10 px-1.5 py-0.5 rounded">{sug.format}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Post Composer */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Nouveau post</h3>
          <div className="flex items-center gap-2">
            {postText.trim() && (
              <button onClick={handleImprove} disabled={improving}
                className="flex items-center gap-1.5 text-[12px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-2.5 py-1 rounded-lg hover:bg-[#00D4FF]/15 transition-colors cursor-pointer disabled:opacity-50">
                {improving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Améliorer
              </button>
            )}
            <button onClick={loadLastTemplate}
              className="flex items-center gap-1.5 text-[12px] font-medium text-[#0A66C2] bg-[#0A66C2]/10 border border-[#0A66C2]/20 px-2.5 py-1 rounded-lg hover:bg-[#0A66C2]/15 transition-colors cursor-pointer">
              <Sparkles className="w-3 h-3" />Template
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <textarea value={postText} onChange={(e) => setPostText(e.target.value.slice(0, maxChars))}
            placeholder="Écrivez votre post LinkedIn ici...&#10;&#10;Astuce : Commencez par un hook percutant pour forcer le 'voir plus'."
            rows={8}
            className="w-full bg-[#18212F] border border-white/[0.06] rounded-xl px-4 py-3 text-[14px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/40 focus:outline-none focus:border-[#0A66C2]/30 resize-none leading-relaxed" />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <div className="w-16 h-1.5 rounded-full bg-[#18212F] overflow-hidden">
              <div className={`h-full rounded-full transition-all ${charPercentage > 90 ? "bg-[#E5263A]" : charPercentage > 70 ? "bg-[#F4A100]" : "bg-[#0A66C2]"}`}
                style={{ width: `${Math.min(charPercentage, 100)}%` }} />
            </div>
            <span className={`text-[11px] font-mono ${charPercentage > 90 ? "text-[#E5263A]" : "text-[#7B8A9A]"}`}>{charCount}/{maxChars}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-[#18212F] border border-white/[0.04] rounded-lg p-0.5">
            <button onClick={() => setVisibility("PUBLIC")}
              className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md transition-all cursor-pointer ${visibility === "PUBLIC" ? "bg-[#0A66C2]/15 text-[#0A66C2]" : "text-[#7B8A9A] hover:text-[#F0F4F8]"}`}>
              <Globe className="w-3.5 h-3.5" />Public
            </button>
            <button onClick={() => setVisibility("CONNECTIONS")}
              className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md transition-all cursor-pointer ${visibility === "CONNECTIONS" ? "bg-[#0A66C2]/15 text-[#0A66C2]" : "text-[#7B8A9A] hover:text-[#F0F4F8]"}`}>
              <Users className="w-3.5 h-3.5" />Connexions
            </button>
          </div>

          {/* Schedule toggle */}
          <button onClick={() => setScheduleMode(!scheduleMode)}
            className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer border ${scheduleMode ? "text-[#F4A100] bg-[#F4A100]/10 border-[#F4A100]/20" : "text-[#7B8A9A] hover:text-[#F0F4F8] border-white/[0.06]"}`}>
            <CalendarClock className="w-3.5 h-3.5" />{scheduleMode ? "Planifier" : "Planifier"}
          </button>

          {!scheduleMode ? (
            <button onClick={handlePublish} disabled={publishing || !postText.trim()}
              className="flex items-center gap-2 text-[13px] font-semibold text-white bg-[#0A66C2] hover:bg-[#004182] px-5 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ml-auto">
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : success ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {publishing ? "Publication..." : success ? "Publié !" : "Publier maintenant"}
            </button>
          ) : (
            <button onClick={handleSchedule} disabled={scheduling || !postText.trim() || !scheduledAt}
              className="flex items-center gap-2 text-[13px] font-semibold text-white bg-[#F4A100] hover:bg-[#d4900a] px-5 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ml-auto">
              {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
              {scheduling ? "Planification..." : "Planifier la publication"}
            </button>
          )}
        </div>

        {/* Schedule datetime + best time suggestion */}
        {scheduleMode && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3">
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                className="bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#F4A100]/30" />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#00C48C] bg-[#00C48C]/5 border border-[#00C48C]/10 rounded-lg px-2.5 py-2">
              <Timer className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Meilleur moment : <strong>{nextBest.day} à {nextBest.time}</strong> — {nextBest.reason}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-[12px] text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20 rounded-lg px-3 py-2 mt-3">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
          </div>
        )}
      </div>

      {/* Post Preview */}
      {postText.trim() && (
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <h4 className="text-[12px] font-semibold text-[#7B8A9A] uppercase tracking-wide mb-3">Aperçu du post</h4>
          <div className="bg-[#18212F] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#0A66C2]/15 flex items-center justify-center">
                <span className="text-sm font-semibold text-[#0A66C2]">{linkedInProfile?.firstName?.[0] || "?"}{linkedInProfile?.lastName?.[0] || ""}</span>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#F0F4F8]">{linkedInProfile?.firstName} {linkedInProfile?.lastName}</p>
                <p className="text-[11px] text-[#7B8A9A]">{linkedInProfile?.headline || "Membre LinkedIn"} · {visibility === "PUBLIC" ? "🌐 Public" : "👥 Connexions"}</p>
              </div>
            </div>
            <div className="text-[13px] text-[#F0F4F8] whitespace-pre-wrap leading-relaxed">{postText}</div>
            <div className="flex items-center gap-6 mt-4 pt-3 border-t border-white/[0.06] text-[12px] text-[#7B8A9A]">
              <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" /> 0</span>
              <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> 0 commentaires</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Posts */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <h4 className="text-sm font-semibold text-[#F0F4F8] mb-4">Posts récents</h4>
        {linkedInPosts.length === 0 ? (
          <div className="text-center py-8">
            <Send className="w-8 h-8 text-[#7B8A9A]/30 mx-auto mb-2" />
            <p className="text-[13px] text-[#7B8A9A]">Aucun post publié pour le moment</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {linkedInPosts.map((post) => (
              <div key={post.id} className="bg-[#18212F] rounded-lg p-3">
                <p className="text-[13px] text-[#F0F4F8] line-clamp-3 mb-2">{post.text}</p>
                <div className="flex items-center gap-4 text-[11px] text-[#7B8A9A]">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(post.createdAt).toLocaleDateString("fr-FR")}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {post.likes}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.comments}</span>
                  <span className={`ml-auto ${post.visibility === "PUBLIC" ? "text-[#0A66C2]" : "text-[#F4A100]"}`}>{post.visibility === "PUBLIC" ? "Public" : "Connexions"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== PLANIFIER TAB (NEW) ========== */
function PlanifierTab() {
  const { linkedInConnected, scheduledPosts, setScheduledPosts, removeScheduledPost, linkedInProfile } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScheduled = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/linkedin/schedule");
      if (res.ok) {
        const data = await res.json();
        if (data.posts) setScheduledPosts(data.posts);
      }
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, [setScheduledPosts]);

  useEffect(() => {
    if (linkedInConnected) {
      fetchScheduled();
      intervalRef.current = setInterval(fetchScheduled, 30000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [linkedInConnected, fetchScheduled]);

  const handleCancel = async (id: string) => {
    setCancelling(id);
    try {
      await fetch(`/api/linkedin/schedule?id=${id}`, { method: "DELETE" });
      removeScheduledPost(id);
    } catch { /* */ } finally {
      setCancelling(null);
    }
  };

  const [bestTimes, setBestTimes] = useState<BestTimeSlot[]>([]);
  const nextBest = getNextBestTime();

  useEffect(() => {
    getBestPostingTimes().then(setBestTimes).catch(() => setBestTimes([]));
  }, []);

  if (!linkedInConnected) return <NotConnectedBanner />;

  const statusColors: Record<string, string> = {
    scheduled: "text-[#0A66C2] bg-[#0A66C2]/10 border-[#0A66C2]/20",
    publishing: "text-[#F4A100] bg-[#F4A100]/10 border-[#F4A100]/20",
    published: "text-[#00C48C] bg-[#00C48C]/10 border-[#00C48C]/20",
    failed: "text-[#E5263A] bg-[#E5263A]/10 border-[#E5263A]/20",
  };
  const statusLabels: Record<string, string> = { scheduled: "Planifié", publishing: "Publication...", published: "Publié", failed: "Échoué" };

  return (
    <div className="space-y-4">
      {/* Best Times Section */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-[#0A66C2]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Meilleurs créneaux de publication</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {bestTimes.map((slot, i) => (
            <div key={i} className={`bg-[#18212F] border rounded-lg p-3 ${nextBest.day === slot.day && nextBest.time === slot.time ? "border-[#0A66C2]/30 ring-1 ring-[#0A66C2]/20" : "border-white/[0.04]"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-[#F0F4F8]">{slot.day}</span>
                <span className="text-[12px] font-mono text-[#00D4FF]">{slot.time}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#080C10] mb-2">
                <div className={`h-full rounded-full ${slot.score >= 90 ? "bg-[#00C48C]" : slot.score >= 80 ? "bg-[#0A66C2]" : slot.score >= 70 ? "bg-[#F4A100]" : "bg-[#7B8A9A]"}`}
                  style={{ width: `${slot.score}%` }} />
              </div>
              <p className="text-[10px] text-[#7B8A9A]">{slot.reason}</p>
              {nextBest.day === slot.day && nextBest.time === slot.time && (
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#00C48C] mt-1.5">⭐ Prochain meilleur moment</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled Posts Queue */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#F4A100]" />
            <h3 className="text-sm font-semibold text-[#F0F4F8]">Posts planifiés</h3>
            {scheduledPosts.length > 0 && <span className="text-[11px] text-[#7B8A9A]">{scheduledPosts.length}</span>}
          </div>
          <button onClick={fetchScheduled} disabled={loading}
            className="text-[11px] text-[#7B8A9A] hover:text-[#F0F4F8] transition-colors cursor-pointer flex items-center gap-1">
            <RotateCcw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />Actualiser
          </button>
        </div>

        {scheduledPosts.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-8 h-8 text-[#7B8A9A]/30 mx-auto mb-2" />
            <p className="text-[13px] text-[#7B8A9A]">Aucun post planifié</p>
            <p className="text-[11px] text-[#7B8A9A]/60 mt-1">Rédigez un post et activez le mode "Planifier"</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {scheduledPosts.map((post) => (
              <div key={post.id} className="bg-[#18212F] rounded-lg p-3">
                <p className="text-[13px] text-[#F0F4F8] line-clamp-2 mb-2">{post.text}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1 text-[11px] text-[#7B8A9A]">
                    <Clock className="w-3 h-3" />{new Date(post.scheduledAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${statusColors[post.status] || statusColors.scheduled}`}>
                    {statusLabels[post.status] || post.status}
                  </span>
                  {post.status === "scheduled" && (
                    <button onClick={() => handleCancel(post.id)} disabled={cancelling === post.id}
                      className="flex items-center gap-1 text-[11px] text-[#E5263A] hover:text-[#E5263A]/80 ml-auto cursor-pointer disabled:opacity-50">
                      {cancelling === post.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}Annuler
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== FEED TAB (UPGRADED) ========== */
interface FeedPost {
  id: string;
  text: string;
  author: string;
  authorRole: string;
  createdAt: string;
  likes: number;
  comments: number;
  visibility: string;
  liked?: boolean;
}

function FeedTab() {
  const { linkedInConnected, linkedInProfile } = useAppStore();
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // AI comment suggestions state per post
  const [aiCommentsMap, setAiCommentsMap] = useState<Record<string, LinkedInCommentSuggestion[]>>({});
  const [aiCommentsLoading, setAiCommentsLoading] = useState<Record<string, boolean>>({});
  const [aiCommentsError, setAiCommentsError] = useState<Record<string, string | null>>({});

  const fetchFeed = useCallback(async () => {
    if (!linkedInProfile?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/linkedin/feed?linkedinId=${linkedInProfile.id}`);
      const data = await res.json();
      if (data.posts) {
        setFeedPosts(data.posts.map((p: FeedPost) => ({ ...p, liked: false })));
        setSimulated(data.simulated || false);
      }
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, [linkedInProfile?.id]);

  useEffect(() => { if (linkedInConnected) fetchFeed(); }, [linkedInConnected, fetchFeed]);

  const handleLike = async (postId: string) => {
    setFeedPosts((prev) => prev.map((p) => p.id === postId ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p));
    try {
      await fetch("/api/linkedin/like", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postUrn: postId, linkedinId: linkedInProfile?.id }) });
    } catch {
      setFeedPosts((prev) => prev.map((p) => p.id === postId ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p));
    }
  };

  const handleComment = async (postId: string) => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/linkedin/comment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postUrn: postId, text: commentText, linkedinId: linkedInProfile?.id }) });
      setFeedPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: p.comments + 1 } : p));
      setCommentText("");
      setCommentingOn(null);
    } catch { /* */ } finally {
      setSubmitting(false);
    }
  };

  const handleGetAIComments = async (post: FeedPost) => {
    const postId = post.id;
    if (aiCommentsMap[postId]) { setAiCommentsMap((prev) => { const n = { ...prev }; delete n[postId]; return n; }); return; }
    setAiCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    setAiCommentsError((prev) => ({ ...prev, [postId]: null }));
    try {
      const suggestions = await generateCommentSuggestions(post.text, post.author, post.authorRole, 3);
      setAiCommentsMap((prev) => ({ ...prev, [postId]: suggestions }));
    } catch {
      setAiCommentsError((prev) => ({ ...prev, [postId]: "Impossible de générer des suggestions. Vérifiez votre clé API." }));
    } finally {
      setAiCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  if (!linkedInConnected) return <NotConnectedBanner />;

  if (loading) {
    return (
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-12 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#0A66C2] animate-spin mb-3" />
        <p className="text-[13px] text-[#7B8A9A]">Chargement du feed LinkedIn...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {simulated && (
        <div className="flex items-center gap-2 text-[12px] text-[#F4A100] bg-[#F4A100]/10 border border-[#F4A100]/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Mode aperçu — L&apos;API LinkedIn Feed nécessite un accès Marketing Developer Platform.</span>
        </div>
      )}

      {feedPosts.length === 0 ? (
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-12 text-center">
          <Eye className="w-8 h-8 text-[#7B8A9A]/30 mx-auto mb-2" />
          <p className="text-[13px] text-[#7B8A9A]">Aucun post dans le feed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedPosts.map((post) => (
            <div key={post.id} className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#0A66C2]/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-[#0A66C2]">{post.author?.split(" ").map((n) => n[0]).join("") || "?"}</span>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#F0F4F8]">{post.author}</p>
                  <p className="text-[11px] text-[#7B8A9A]">{post.authorRole} · {getTimeAgo(post.createdAt)}</p>
                </div>
              </div>
              <div className="text-[13px] text-[#F0F4F8] whitespace-pre-wrap leading-relaxed mb-4">{post.text}</div>
              <div className="flex items-center gap-4 text-[11px] text-[#7B8A9A] mb-3 pb-3 border-t border-white/[0.06]">
                <span>{post.likes} j&apos;aime</span>
                <span>{post.comments} commentaires</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer ${post.liked ? "text-[#0A66C2] bg-[#0A66C2]/10 border border-[#0A66C2]/20" : "text-[#7B8A9A] hover:text-[#F0F4F8] hover:bg-white/[0.04] border border-transparent"}`}>
                  <ThumbsUp className={`w-3.5 h-3.5 ${post.liked ? "fill-[#0A66C2]" : ""}`} />{post.liked ? "Liké" : "J'aime"}
                </button>
                <button onClick={() => setCommentingOn(commentingOn === post.id ? null : post.id)}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-[#7B8A9A] hover:text-[#F0F4F8] px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all cursor-pointer border border-transparent">
                  <MessageCircle className="w-3.5 h-3.5" />Commenter
                </button>
                <button onClick={() => handleGetAIComments(post)} disabled={aiCommentsLoading[post.id]}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-3 py-1.5 rounded-lg hover:bg-[#00D4FF]/15 transition-all cursor-pointer disabled:opacity-50">
                  {aiCommentsLoading[post.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiCommentsMap[post.id] ? "Masquer IA" : "Suggérer un commentaire IA"}
                </button>
              </div>

              {/* AI Comment Suggestions */}
              {aiCommentsMap[post.id] && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-[#00D4FF] uppercase tracking-wide">Suggestions IA</p>
                  {aiCommentsMap[post.id].map((sug) => (
                    <button key={sug.id} onClick={() => { setCommentText(sug.text); setCommentingOn(post.id); }}
                      className="w-full text-left bg-[#00D4FF]/5 border border-[#00D4FF]/10 rounded-lg px-3 py-2 text-[12px] text-[#F0F4F8] hover:bg-[#00D4FF]/10 transition-colors cursor-pointer">
                      <span className="text-[10px] font-medium text-[#00D4FF] mr-2">{sug.tone}</span>
                      {sug.text}
                    </button>
                  ))}
                </div>
              )}
              {aiCommentsError[post.id] && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#E5263A]">
                  <AlertCircle className="w-3 h-3" />{aiCommentsError[post.id]}
                </div>
              )}

              {/* Comment Input */}
              {commentingOn === post.id && (
                <div className="mt-3 flex gap-2">
                  <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment(post.id)}
                    placeholder="Écrire un commentaire..."
                    className="flex-1 bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#0A66C2]/30" />
                  <button onClick={() => handleComment(post.id)} disabled={!commentText.trim() || submitting}
                    className="flex items-center gap-1 text-[12px] font-medium text-white bg-[#0A66C2] hover:bg-[#004182] px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========== ENGAGER TAB ========== */
interface EngagementLog {
  id: string;
  type: "like" | "comment";
  postAuthor: string;
  postPreview: string;
  timestamp: string;
  keyword?: string;
}

function EngagerTab() {
  const { linkedInConnected, templates } = useAppStore();
  const [keywords, setKeywords] = useState<string[]>(["IA", "prospection B2B", "automation LinkedIn"]);
  const [newKeyword, setNewKeyword] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [autoEngage, setAutoEngage] = useState(false);
  const [engagementLogs, setEngagementLogs] = useState<EngagementLog[]>([]);
  const [matchingPosts, setMatchingPosts] = useState<FeedPost[]>([]);
  const [searching, setSearching] = useState(false);
  const [bulkLiking, setBulkLiking] = useState(false);

  const simulatedEngagementPosts: FeedPost[] = [
    { id: "eng-1", text: "L'IA générative transforme la façon dont les équipes B2B abordent la prospection. Qui a déjà testé des agents autonomes pour la génération de leads ?", author: "Marie Dupont", authorRole: "CEO @ AI Ventures", createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), likes: 45, comments: 8, visibility: "PUBLIC", liked: false },
    { id: "eng-2", text: "Notre équipe a doublé son taux de réponse en automatisant les séquences de prospection LinkedIn. Le secret : personnalisation IA + timing optimal. Thread 🧵", author: "Lucas Bernard", authorRole: "Head of Growth @ SaaSify", createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), likes: 89, comments: 15, visibility: "PUBLIC", liked: false },
    { id: "eng-3", text: "Le scoring ICP automatisé permet de passer de 200 à 50 leads qualifiés. Moins de volume, plus de qualité. C'est ça la vraie prospection B2B moderne.", author: "Julie Moreau", authorRole: "Directrice Commerciale @ GrowthCo", createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), likes: 67, comments: 11, visibility: "PUBLIC", liked: false },
    { id: "eng-4", text: "J'ai testé 5 outils d'automation LinkedIn ce mois-ci. Le meilleur ? Celui qui s'intègre à votre CRM et qui apprend de vos réponses.", author: "Antoine Petit", authorRole: "CMO @ DigitalFirst", createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(), likes: 134, comments: 22, visibility: "PUBLIC", liked: false },
  ];

  const searchPosts = () => { setSearching(true); setTimeout(() => { setMatchingPosts(simulatedEngagementPosts); setSearching(false); }, 1500); };

  const handleBulkLike = () => {
    setBulkLiking(true);
    const newLogs: EngagementLog[] = [];
    const updated = matchingPosts.map((p) => {
      if (!p.liked) newLogs.push({ id: `log-${Date.now()}-${p.id}`, type: "like", postAuthor: p.author, postPreview: p.text.slice(0, 50) + "...", timestamp: new Date().toISOString(), keyword: keywords.find((k) => p.text.toLowerCase().includes(k.toLowerCase())) });
      return { ...p, liked: true, likes: p.likes + 1 };
    });
    setMatchingPosts(updated);
    setEngagementLogs((prev) => [...newLogs, ...prev]);
    setBulkLiking(false);
  };

  const handleBulkComment = () => {
    const template = selectedTemplate || templates[0]?.content || "Très intéressant ! Comment appliquez-vous cela concrètement ?";
    const newLogs: EngagementLog[] = [];
    const updated = matchingPosts.map((p) => {
      if (!p.liked) newLogs.push({ id: `log-${Date.now()}-${p.id}`, type: "comment", postAuthor: p.author, postPreview: p.text.slice(0, 50) + "...", timestamp: new Date().toISOString(), keyword: keywords.find((k) => p.text.toLowerCase().includes(k.toLowerCase())) });
      return { ...p, comments: p.comments + 1 };
    });
    setMatchingPosts(updated);
    setEngagementLogs((prev) => [...newLogs, ...prev]);
  };

  const toggleAutoEngage = () => {
    if (!autoEngage) {
      setAutoEngage(true);
      const interval = setInterval(() => {
        setEngagementLogs((prev) => {
          if (prev.length > 50) { setAutoEngage(false); clearInterval(interval); return prev; }
          const rp = simulatedEngagementPosts[Math.floor(Math.random() * simulatedEngagementPosts.length)];
          const isLike = Math.random() > 0.4;
          return [{ id: `log-${Date.now()}`, type: isLike ? "like" : "comment", postAuthor: rp.author, postPreview: rp.text.slice(0, 50) + "...", timestamp: new Date().toISOString(), keyword: keywords.find((k) => rp.text.toLowerCase().includes(k.toLowerCase())) }, ...prev];
        });
      }, 2000);
    } else {
      setAutoEngage(false);
    }
  };

  if (!linkedInConnected) return <NotConnectedBanner />;

  return (
    <div className="space-y-4">
      {/* Keywords */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-[#0A66C2]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Mots-clés de veille</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {keywords.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0A66C2] bg-[#0A66C2]/10 border border-[#0A66C2]/20 px-2.5 py-1 rounded-full">
              {kw}
              <button onClick={() => setKeywords(keywords.filter((k) => k !== kw))} className="text-[#7B8A9A] hover:text-[#E5263A] transition-colors cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newKeyword.trim()) { setKeywords([...keywords, newKeyword.trim()]); setNewKeyword(""); } }}
            placeholder="Ajouter un mot-clé..." className="flex-1 bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#0A66C2]/30" />
          <button onClick={() => { if (newKeyword.trim()) { setKeywords([...keywords, newKeyword.trim()]); setNewKeyword(""); } }}
            className="flex items-center gap-1 text-[13px] font-medium text-[#0A66C2] bg-[#0A66C2]/10 border border-[#0A66C2]/20 px-3 py-2 rounded-lg hover:bg-[#0A66C2]/15 transition-colors cursor-pointer">Ajouter</button>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button onClick={searchPosts} disabled={searching}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#0A66C2] bg-[#0A66C2]/10 border border-[#0A66C2]/20 px-4 py-2 rounded-lg hover:bg-[#0A66C2]/15 transition-colors cursor-pointer">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}{searching ? "Recherche..." : "Rechercher des posts"}
          </button>
          {matchingPosts.length > 0 && (
            <>
              <button onClick={handleBulkLike} disabled={bulkLiking}
                className="flex items-center gap-1.5 text-[13px] font-medium text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20 px-4 py-2 rounded-lg hover:bg-[#00C48C]/15 transition-colors cursor-pointer">
                {bulkLiking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}Liker tout
              </button>
              <button onClick={handleBulkComment}
                className="flex items-center gap-1.5 text-[13px] font-medium text-[#F4A100] bg-[#F4A100]/10 border border-[#F4A100]/20 px-4 py-2 rounded-lg hover:bg-[#F4A100]/15 transition-colors cursor-pointer">
                <MessageCircle className="w-4 h-4" />Commenter tout
              </button>
            </>
          )}
          <button onClick={toggleAutoEngage}
            className={`flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer ml-auto ${autoEngage ? "text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20" : "text-white bg-[#0A66C2] hover:bg-[#004182]"}`}>
            {autoEngage ? <><Loader2 className="w-4 h-4 animate-spin" />Arrêter</> : <><Zap className="w-4 h-4" />Auto-engage</>}
          </button>
        </div>
        <div className="mb-4">
          <label className="text-[12px] font-medium text-[#7B8A9A] mb-1.5 block">Template de commentaire</label>
          <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full sm:w-auto bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] focus:outline-none focus:border-[#0A66C2]/30 cursor-pointer">
            <option value="">Commentaire personnalisé (défaut)</option>
            {templates.map((t) => (<option key={t.id} value={t.content}>{t.name}</option>))}
          </select>
        </div>
        {matchingPosts.length > 0 && (
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
            {matchingPosts.map((post) => (
              <div key={post.id} className="bg-[#18212F] rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#0A66C2]/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-semibold text-[#0A66C2]">{post.author?.split(" ").map((n) => n[0]).join("") || "?"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="text-[12px] font-semibold text-[#F0F4F8]">{post.author}</span><span className="text-[10px] text-[#7B8A9A]">{post.authorRole}</span></div>
                    <p className="text-[12px] text-[#7B8A9A] line-clamp-2 mt-1">{post.text}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-[#7B8A9A] flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {post.likes}</span>
                      <span className="text-[10px] text-[#7B8A9A] flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.comments}</span>
                      {post.liked && <span className="text-[10px] text-[#0A66C2] flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Liké</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-[#0A66C2]" /><h3 className="text-sm font-semibold text-[#F0F4F8]">Journal d&apos;engagement</h3>
            {engagementLogs.length > 0 && <span className="text-[11px] text-[#7B8A9A]">{engagementLogs.length} action{engagementLogs.length !== 1 ? "s" : ""}</span>}
          </div>
          {engagementLogs.length > 0 && <button onClick={() => setEngagementLogs([])} className="text-[11px] text-[#7B8A9A] hover:text-[#F0F4F8] transition-colors cursor-pointer">Effacer</button>}
        </div>
        {engagementLogs.length === 0 ? (
          <div className="text-center py-6"><Activity className="w-8 h-8 text-[#7B8A9A]/30 mx-auto mb-2" /><p className="text-[13px] text-[#7B8A9A]">Aucune activité d&apos;engagement</p></div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
            {engagementLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${log.type === "like" ? "bg-[#00C48C]" : "bg-[#F4A100]"}`} />
                <span className="font-mono text-[11px] text-[#7B8A9A] flex-shrink-0 mt-0.5">{new Date(log.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${log.type === "like" ? "text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20" : "text-[#F4A100] bg-[#F4A100]/10 border border-[#F4A100]/20"}`}>{log.type === "like" ? "LIKE" : "COMMENT"}</span>
                <span className="text-[12px] text-[#F0F4F8] flex-1 min-w-0">{log.postAuthor}</span>
                {log.keyword && <span className="text-[10px] text-[#0A66C2] bg-[#0A66C2]/10 px-1.5 py-0.5 rounded flex-shrink-0">{log.keyword}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== TENDANCES TAB (NEW) ========== */
function TendancesTab({ onUseTopic }: { onUseTopic: (topic: string) => void }) {
  const { linkedInConnected, scheduledPosts } = useAppStore();
  const [trends, setTrends] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = async () => {
    setLoading(true);
    setError(null);
    try {
      const topics = await generateTrendingTopics();
      setTrends(topics);
    } catch {
      setError("Impossible de récupérer les tendances. Vérifiez votre clé API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (linkedInConnected) fetchTrends(); }, [linkedInConnected]);

  const hotnessBadge = (hotness: string) => {
    if (hotness === "hot") return <span className="text-[10px] font-semibold text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20 px-1.5 py-0.5 rounded">🔥 Hot</span>;
    if (hotness === "warm") return <span className="text-[10px] font-semibold text-[#F4A100] bg-[#F4A100]/10 border border-[#F4A100]/20 px-1.5 py-0.5 rounded">📈 Warm</span>;
    return <span className="text-[10px] font-semibold text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-1.5 py-0.5 rounded">⬆️ Rising</span>;
  };

  // Calendar: current week Mon-Sun
  const getWeekDays = () => {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const days = [];
    const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday = d.toDateString() === now.toDateString();
      const hasScheduled = scheduledPosts.some((p) => new Date(p.scheduledAt).toDateString() === d.toDateString());
      days.push({ name: dayNames[i], date: d.getDate(), isToday, hasScheduled });
    }
    return days;
  };

  const weekDays = getWeekDays();
  const [bestTimes, setBestTimes] = useState<BestTimeSlot[]>([]);
  const bestTimeDays = new Set(bestTimes.filter((s) => s.score >= 80).map((s) => s.day));

  useEffect(() => {
    getBestPostingTimes().then(setBestTimes).catch(() => setBestTimes([]));
  }, []);

  if (!linkedInConnected) return <NotConnectedBanner />;

  return (
    <div className="space-y-4">
      {/* Trending Topics */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#00D4FF]" />
            <h3 className="text-sm font-semibold text-[#F0F4F8]">Sujets tendance</h3>
          </div>
          <button onClick={fetchTrends} disabled={loading}
            className="flex items-center gap-1.5 text-[12px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-3 py-1.5 rounded-lg hover:bg-[#00D4FF]/15 transition-colors cursor-pointer disabled:opacity-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Actualiser
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[12px] text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20 rounded-lg px-3 py-2 mb-3">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
          </div>
        )}

        {loading && trends.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-[#18212F] rounded-lg p-4 animate-pulse">
                <div className="h-3 bg-white/[0.06] rounded mb-2 w-1/2" />
                <div className="h-2 bg-white/[0.04] rounded mb-1.5 w-full" />
                <div className="h-2 bg-white/[0.04] rounded w-3/4" />
              </div>
            ))}
          </div>
        )}

        {trends.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {trends.map((trend, i) => (
              <div key={i} className="bg-[#18212F] border border-white/[0.04] rounded-lg p-4 hover:border-[#00D4FF]/20 transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-[13px] font-semibold text-[#F0F4F8] group-hover:text-[#00D4FF] transition-colors">{trend.topic}</h4>
                  {hotnessBadge(trend.热度)}
                </div>
                <p className="text-[12px] text-[#7B8A9A] mb-2">{trend.angle}</p>
                <p className="text-[11px] text-[#F0F4F8]/70 italic mb-3 line-clamp-2">&ldquo;{trend.suggestedHook}&rdquo;</p>
                <button onClick={() => onUseTopic(trend.topic)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-2.5 py-1 rounded-lg hover:bg-[#00D4FF]/15 transition-colors cursor-pointer">
                  <ArrowUpRight className="w-3 h-3" />Utiliser ce sujet
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content Calendar */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-[#0A66C2]" />
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Calendrier de contenu — Semaine en cours</h3>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d) => {
            const dayNameFr = { Lun: "Lundi", Mar: "Mardi", Mer: "Mercredi", Jeu: "Jeudi", Ven: "Vendredi", Sam: "Samedi", Dim: "Dimanche" }[d.name] || d.name;
            const isBestDay = bestTimeDays.has(dayNameFr);
            return (
              <div key={d.name} className={`rounded-lg p-2 text-center border ${d.isToday ? "bg-[#0A66C2]/10 border-[#0A66C2]/30" : "bg-[#18212F] border-white/[0.04]"}`}>
                <p className={`text-[10px] font-medium ${d.isToday ? "text-[#0A66C2]" : "text-[#7B8A9A]"}`}>{d.name}</p>
                <p className={`text-[16px] font-semibold mt-0.5 ${d.isToday ? "text-[#0A66C2]" : "text-[#F0F4F8]"}`}>{d.date}</p>
                <div className="mt-1.5 flex items-center justify-center gap-1 h-4">
                  {d.hasScheduled && <div className="w-2 h-2 rounded-full bg-[#F4A100]" title="Post planifié" />}
                  {isBestDay && <div className="w-2 h-2 rounded-full bg-[#0A66C2]" title="Meilleur créneau" />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-[#7B8A9A]">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#F4A100]" />Post planifié</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#0A66C2]" />Meilleur créneau</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full border border-[#0A66C2]" />Aujourd&apos;hui</span>
        </div>
      </div>
    </div>
  );
}

/* ========== EXPERT TAB (NEW) ========== */
function ExpertTab({ onUsePost }: { onUsePost: (postText: string) => void }) {
  const { linkedInConnected, linkedInPosts } = useAppStore();
  const [analysis, setAnalysis] = useState<PostAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [expertTopic, setExpertTopic] = useState("");
  const [expertSuggestions, setExpertSuggestions] = useState<LinkedInPostSuggestion[]>([]);
  const [expertLoading, setExpertLoading] = useState(false);
  const [expertError, setExpertError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await analyzeMyPosts(linkedInPosts);
      if (result) {
        setAnalysis(result);
      } else {
        setAnalysisError("Impossible d'analyser vos posts. Vérifiez votre clé API et réessayez.");
      }
    } catch {
      setAnalysisError("Impossible d'analyser vos posts. Vérifiez votre clé API.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateExpert = async () => {
    if (!analysis) return;
    setExpertLoading(true);
    setExpertError(null);
    try {
      const suggestions = await generateExpertPosts(analysis, expertTopic || undefined);
      setExpertSuggestions(suggestions);
    } catch {
      setExpertError("Impossible de générer des posts expert. Vérifiez votre clé API.");
    } finally {
      setExpertLoading(false);
    }
  };

  if (!linkedInConnected) return <NotConnectedBanner />;

  return (
    <div className="space-y-4">
      {/* Analyze Section */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-[#00D4FF]" />
            <h3 className="text-sm font-semibold text-[#F0F4F8]">Mode Expert Data</h3>
          </div>
          <button onClick={handleAnalyze} disabled={analyzing}
            className="flex items-center gap-1.5 text-[12px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-3 py-1.5 rounded-lg hover:bg-[#00D4FF]/15 transition-colors cursor-pointer disabled:opacity-50">
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            Analyser mes posts
          </button>
        </div>

        {linkedInPosts.length === 0 && (
          <div className="flex items-center gap-2 text-[12px] text-[#F4A100] bg-[#F4A100]/5 border border-[#F4A100]/10 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Aucun post publié — l&apos;analyse sera basée sur des recommandations génériques.</span>
          </div>
        )}

        {analysisError && (
          <div className="flex items-center gap-2 text-[12px] text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20 rounded-lg px-3 py-2 mb-3">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{analysisError}
          </div>
        )}

        {analyzing && (
          <div className="space-y-3">
            <div className="bg-[#18212F] rounded-lg p-4 animate-pulse">
              <div className="h-3 bg-white/[0.06] rounded mb-2 w-1/3" />
              <div className="h-2 bg-white/[0.04] rounded mb-1.5 w-full" />
              <div className="h-2 bg-white/[0.04] rounded mb-3 w-2/3" />
              <div className="flex gap-2">
                <div className="h-5 bg-white/[0.04] rounded w-20" />
                <div className="h-5 bg-white/[0.04] rounded w-20" />
                <div className="h-5 bg-white/[0.04] rounded w-20" />
              </div>
            </div>
          </div>
        )}

        {analysis && !analyzing && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Style Profile */}
            <div className="bg-[#18212F] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#00D4FF]" />
                <h4 className="text-[12px] font-semibold text-[#00D4FF]">Profil de style</h4>
              </div>
              <p className="text-[12px] text-[#F0F4F8] leading-relaxed">{analysis.styleProfile}</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Top Topics */}
              <div className="bg-[#18212F] rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3 h-3 text-[#00C48C]" />
                  <h4 className="text-[11px] font-semibold text-[#00C48C]">Sujets performants</h4>
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.topTopics.map((t, i) => (
                    <span key={i} className="text-[10px] font-medium text-[#00C48C] bg-[#00C48C]/10 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>

              {/* Top Formats */}
              <div className="bg-[#18212F] rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <BarChart3 className="w-3 h-3 text-[#0A66C2]" />
                  <h4 className="text-[11px] font-semibold text-[#0A66C2]">Formats performants</h4>
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.topFormats.map((f, i) => (
                    <span key={i} className="text-[10px] font-medium text-[#0A66C2] bg-[#0A66C2]/10 px-1.5 py-0.5 rounded">{f}</span>
                  ))}
                </div>
              </div>

              {/* Avg Engagement */}
              <div className="bg-[#18212F] rounded-lg p-3 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <Activity className="w-3 h-3 text-[#F4A100]" />
                  <h4 className="text-[11px] font-semibold text-[#F4A100]">Engagement moyen</h4>
                </div>
                <p className="text-[11px] text-[#F0F4F8]">{analysis.avgEngagement}</p>
              </div>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-[#18212F] rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="w-3.5 h-3.5 text-[#00C48C]" />
                  <h4 className="text-[11px] font-semibold text-[#00C48C]">Forces</h4>
                </div>
                <ul className="space-y-1">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-[11px] text-[#F0F4F8] flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-[#00C48C] flex-shrink-0 mt-0.5" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#18212F] rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#E5263A]" />
                  <h4 className="text-[11px] font-semibold text-[#E5263A]">Axes d&apos;amélioration</h4>
                </div>
                <ul className="space-y-1">
                  {analysis.weaknesses.map((w, i) => (
                    <li key={i} className="text-[11px] text-[#F0F4F8] flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 text-[#E5263A] flex-shrink-0 mt-0.5" />{w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-[#18212F] rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-[#F4A100]" />
                <h4 className="text-[11px] font-semibold text-[#F4A100]">Recommandations</h4>
              </div>
              <ul className="space-y-1">
                {analysis.recommendations.map((r, i) => (
                  <li key={i} className="text-[11px] text-[#F0F4F8] flex items-start gap-1.5">
                    <Star className="w-3 h-3 text-[#F4A100] flex-shrink-0 mt-0.5" />{r}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </div>

      {/* Expert Post Generation */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#00D4FF]" />
            <h3 className="text-sm font-semibold text-[#F0F4F8]">Génération Expert</h3>
          </div>
          <button onClick={handleGenerateExpert} disabled={!analysis || expertLoading}
            className="flex items-center gap-1.5 text-[12px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-3 py-1.5 rounded-lg hover:bg-[#00D4FF]/15 transition-colors cursor-pointer disabled:opacity-50">
            {expertLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            Générer en mode Expert
          </button>
        </div>

        {/* Topic Input */}
        <div className="mb-4">
          <label className="text-[11px] font-medium text-[#7B8A9A] mb-1.5 flex items-center gap-1.5">
            <Target className="w-3 h-3 text-[#F4A100]" />
            Sujet (optionnel)
          </label>
          <input
            type="text"
            value={expertTopic}
            onChange={(e) => setExpertTopic(e.target.value)}
            placeholder="Sujet ou titre (ex: Data Architecture B2B)"
            className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/30"
          />
        </div>

        {!analysis && (
          <div className="flex items-center gap-2 text-[12px] text-[#7B8A9A] bg-[#18212F] rounded-lg px-3 py-3">
            <Brain className="w-3.5 h-3.5 flex-shrink-0 text-[#7B8A9A]/50" />
            <span>Analysez d&apos;abord vos posts pour activer la génération expert.</span>
          </div>
        )}

        {expertError && (
          <div className="flex items-center gap-2 text-[12px] text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20 rounded-lg px-3 py-2 mb-3">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{expertError}
          </div>
        )}

        {expertLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-[#18212F] rounded-lg p-3 animate-pulse">
                <div className="h-3 bg-white/[0.06] rounded mb-2 w-3/4" />
                <div className="h-2 bg-white/[0.04] rounded mb-1.5 w-full" />
                <div className="h-2 bg-white/[0.04] rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {expertSuggestions.length > 0 && !expertLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {expertSuggestions.map((sug) => (
              <div key={sug.id} className="bg-[#18212F] border border-white/[0.04] rounded-lg p-3 group">
                <p className="text-[12px] text-[#F0F4F8] line-clamp-3 mb-2">{sug.hook}</p>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <span className="text-[10px] font-medium text-[#7B8A9A] bg-white/[0.06] px-1.5 py-0.5 rounded">{sug.topic}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sug.estimatedEngagement === "high" ? "text-[#00C48C] bg-[#00C48C]/10" : "text-[#F4A100] bg-[#F4A100]/10"}`}>
                    {sug.estimatedEngagement === "high" ? "🔥 Élevé" : "📊 Moyen"}
                  </span>
                  <span className="text-[10px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 px-1.5 py-0.5 rounded">{sug.format}</span>
                </div>
                <button onClick={() => onUsePost(sug.text)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-[#0A66C2] bg-[#0A66C2]/10 border border-[#0A66C2]/20 px-2.5 py-1 rounded-lg hover:bg-[#0A66C2]/15 transition-colors cursor-pointer w-full justify-center">
                  <ArrowUpRight className="w-3 h-3" />Utiliser
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== SHARED COMPONENTS ========== */

function NotConnectedBanner() {
  const { setCurrentView } = useAppStore();
  return (
    <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-12 text-center">
      <Linkedin className="w-12 h-12 text-[#7B8A9A]/30 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-[#F0F4F8] mb-2">LinkedIn non connecté</h3>
      <p className="text-[13px] text-[#7B8A9A] mb-4">Connectez votre compte LinkedIn pour accéder à cette fonctionnalité.</p>
      <button onClick={() => setCurrentView("linkedin")}
        className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0A66C2] bg-[#0A66C2]/10 border border-[#0A66C2]/20 px-4 py-2 rounded-lg hover:bg-[#0A66C2]/15 transition-colors cursor-pointer">
        <Link2 className="w-4 h-4" />Aller à Connexion
      </button>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2"><Icon className="w-4 h-4" style={{ color }} /></div>
      <div className="font-mono text-xl font-medium text-[#F0F4F8] tracking-[-0.5px]">{value}</div>
      <div className="text-xs text-[#7B8A9A] mt-1">{label}</div>
    </div>
  );
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between text-[13px] py-1">
      <span className="text-[#7B8A9A]">{label}</span>
      <span className={valueColor || "text-[#F0F4F8] font-mono text-[12px]"}>{value}</span>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `il y a ${minutes}min`;
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${days}j`;
}
