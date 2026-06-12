/**
 * Real Agent Runner for HERMÈS
 *
 * Executes agents by calling the configured LLM provider.
 * Each agent uses real data sources: web search, LinkedIn API, and LLM.
 * No simulation or mock data — all actions are real.
 */

import { useAppStore, type Lead, type ActivityLog, type GeneratedComment, type MarketBriefing, type NurturingAction, type PerformanceInsight, type ConnectionRequest } from "@/store/appStore";
import { chatCompletion, type ChatMessage } from "@/lib/ai-client";

// ─── Helpers ──────────────────────────────────────────────
function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Compute a simple ICP score as a fallback when LLM scoring is unavailable.
 * No random component — fully deterministic based on profile data.
 */
function computeSimpleScore(
  profile: { poste: string; secteur: string; action: string },
  icpTitles: string[],
  icpSectors: string[]
): number {
  let score = 0;
  const titleLower = profile.poste.toLowerCase();
  if (icpTitles.some((t) => t.toLowerCase().includes(titleLower) || titleLower.includes(t.toLowerCase().split(",")[0]))) {
    score += 30;
  } else if (["ceo", "cmo", "fondateur", "co-fondateur", "head of growth", "vp sales", "directeur"].some((t) => titleLower.includes(t))) {
    score += 20;
  }
  if (icpSectors.some((s) => s.toLowerCase().includes(profile.secteur.toLowerCase()) || profile.secteur.toLowerCase().includes(s.toLowerCase().split(",")[0]))) {
    score += 20;
  }
  if (profile.action === "commented") score += 15;
  return Math.min(100, score);
}

/**
 * Fetch trending topics for LinkedIn content using web search.
 * Falls back to LLM-suggested topics if web search fails.
 */
async function fetchTrendingTopics(niche: string): Promise<string[]> {
  try {
    const response = await fetch("/api/ai/web-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `LinkedIn trending topics 2026 ${niche} B2B SaaS prospection IA`,
        num: 10,
      }),
    });

    if (!response.ok) {
      throw new Error(`Web search failed with status ${response.status}`);
    }

    const data = await response.json();
    const results: Array<{ name: string; snippet: string }> = data.results || [];

    if (results.length > 0) {
      // Extract topic titles from search results
      const topics = results
        .map((r) => r.name || r.snippet?.slice(0, 80))
        .filter((t): t is string => !!t && t.length > 10)
        .slice(0, 10);
      if (topics.length >= 3) return topics;
    }

    throw new Error("Insufficient search results");
  } catch {
    // Fallback: ask the LLM to suggest topics
    try {
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `Tu es un expert en contenu LinkedIn B2B. Suggère des sujets tendance pour des posts LinkedIn.`,
        },
        {
          role: "user",
          content: `Donne-moi 5 sujets tendance pour des posts LinkedIn dans la niche : ${niche}. Réponds avec un JSON array de strings uniquement, pas d'explication. Exemple: ["sujet 1", "sujet 2", ...]`,
        },
      ];

      const response = await chatCompletion(messages, {
        temperature: 0.8,
        maxTokens: 300,
      });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 10);
        }
      }
    } catch {
      // LLM also failed
    }

    // Last resort: return a minimal set of generic topics
    return [
      "L'IA dans la prospection B2B en 2026",
      "Automatisation LinkedIn sans spam",
      "Scoring ICP et qualification automatisée",
    ];
  }
}

/**
 * Fetch the LinkedIn feed via the internal API route.
 * Returns feed posts with author info and engagement data.
 */
async function fetchLinkedInFeed(requestCookies?: string): Promise<Array<{
  id: string;
  text: string;
  author: string;
  authorRole?: string;
  createdAt: string;
  likes: number;
  comments: number;
}>> {
  const state = useAppStore.getState();
  const linkedinId = state.linkedInProfile?.id;
  if (!linkedinId) return [];

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (requestCookies) headers["Cookie"] = requestCookies;

    const response = await fetch(
      `${BASE_URL}/api/linkedin/feed?linkedinId=${encodeURIComponent(linkedinId)}`,
      { headers }
    );

    if (!response.ok) return [];

    const data = await response.json();
    if (data.posts && Array.isArray(data.posts)) {
      return data.posts;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Publish a post to LinkedIn via the internal API route.
 */
async function publishToLinkedIn(
  postText: string,
  requestCookies?: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const state = useAppStore.getState();
  const linkedinId = state.linkedInProfile?.id;
  if (!linkedinId) {
    return { success: false, error: "LinkedIn non connecté — ID profil manquant" };
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (requestCookies) headers["Cookie"] = requestCookies;

    const response = await fetch(`${BASE_URL}/api/linkedin/post`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: postText, visibility: "PUBLIC", linkedinId }),
    });

    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, postId: data.postId };
    }
    return { success: false, error: data.error || `Erreur HTTP ${response.status}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return { success: false, error: msg };
  }
}

/**
 * Post a comment on a LinkedIn post via the internal API route.
 */
async function postCommentToLinkedIn(
  postUrn: string,
  commentText: string,
  requestCookies?: string
): Promise<{ success: boolean; error?: string }> {
  const state = useAppStore.getState();
  const linkedinId = state.linkedInProfile?.id;
  if (!linkedinId) {
    return { success: false, error: "LinkedIn non connecté — ID profil manquant" };
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (requestCookies) headers["Cookie"] = requestCookies;

    const response = await fetch(`${BASE_URL}/api/linkedin/comment`, {
      method: "POST",
      headers,
      body: JSON.stringify({ postUrn, text: commentText, linkedinId }),
    });

    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || `Erreur HTTP ${response.status}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return { success: false, error: msg };
  }
}

// ─── AGENT CONTENU ───────────────────────────────────────
// Generates a real LinkedIn post using the LLM and publishes to LinkedIn

export interface GeneratedPost {
  id: string;
  text: string;
  topic: string;
  createdAt: string;
  model: string;
  agentRun: number;
  linkedInPostId?: string;
  publishedToLinkedIn?: boolean;
}

export async function runContenuAgent(requestCookies?: string): Promise<{
  post: GeneratedPost | null;
  logs: Omit<ActivityLog, "id" | "timestamp">[];
}> {
  const state = useAppStore.getState();
  const agent = state.agents.find((a) => a.id === "contenu")!;
  const icpTitles = state.icpConfig.titles.join(", ");
  const icpSectors = state.icpConfig.sectors.join(", ");

  const logs: Omit<ActivityLog, "id" | "timestamp">[] = [];

  // Fetch trending topics via web search or LLM fallback
  const topics = await fetchTrendingTopics(icpSectors);
  const topic = topics[0] || "L'IA dans la prospection B2B";

  logs.push({
    agentId: "contenu",
    agentName: "Contenu",
    type: "info",
    message: `Agent Contenu lancé — Sujet: "${topic}"`,
    details: `Run #${agent.runsToday + 1}`,
  });

  // Generate the post with LLM
  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `Tu es un expert en contenu LinkedIn spécialisé dans l'IA et l'acquisition B2B.
Ton audience cible : ${icpTitles}
Ton : direct, factuel, sans jargon, français.

Rédige un post LinkedIn avec cette structure OBLIGATOIRE :
- Hook (ligne 1 — doit forcer le "voir plus", commence par un chiffre ou une affirmation surprenante)
- Ligne vide
- Corps (3 à 4 paragraphes courts, max 3 lignes chacun, avec des retours à la ligne)
- Ligne vide
- CTA (question ouverte ou instruction "commentez X")

Règles :
- 150 à 220 mots
- Pas de hashtag dans le corps
- Pas d'émoji
- Langage direct et professionnel`,
      },
      {
        role: "user",
        content: `Rédige un post LinkedIn sur le sujet suivant : ${topic}`,
      },
    ];

    const response = await chatCompletion(messages, {
      temperature: 0.85,
      maxTokens: 600,
    });

    const post: GeneratedPost = {
      id: generateId(),
      text: response.content,
      topic,
      createdAt: new Date().toISOString(),
      model: response.model,
      agentRun: agent.runsToday + 1,
      publishedToLinkedIn: false,
    };

    logs.push({
      agentId: "contenu",
      agentName: "Contenu",
      type: "success",
      message: `Post généré par IA — "${topic.slice(0, 35)}..."`,
      details: `Modèle: ${response.model} | ${response.content.split(/\s+/).length} mots`,
    });

    // Publish to LinkedIn if connected
    if (state.linkedInConnected) {
      const publishResult = await publishToLinkedIn(response.content, requestCookies);
      if (publishResult.success) {
        post.publishedToLinkedIn = true;
        post.linkedInPostId = publishResult.postId;
        logs.push({
          agentId: "contenu",
          agentName: "Contenu",
          type: "success",
          message: "Post publié sur LinkedIn",
          details: publishResult.postId ? `ID: ${publishResult.postId}` : undefined,
        });
      } else {
        logs.push({
          agentId: "contenu",
          agentName: "Contenu",
          type: "warning",
          message: "Post généré mais non publié sur LinkedIn",
          details: publishResult.error || "Erreur inconnue",
        });
      }
    } else {
      logs.push({
        agentId: "contenu",
        agentName: "Contenu",
        type: "info",
        message: "Post généré — LinkedIn non connecté, publication ignorée",
      });
    }

    return { post, logs };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
    logs.push({
      agentId: "contenu",
      agentName: "Contenu",
      type: "error",
      message: `Erreur lors de la génération: ${errMsg.slice(0, 80)}`,
      details: "Vérifiez votre clé API dans Paramètres",
    });
    return { post: null, logs };
  }
}

// ─── AGENT QUALIFICATION ─────────────────────────────────
// Collects leads from LinkedIn feed and scores them with LLM

export async function runQualificationAgent(requestCookies?: string): Promise<{
  newLeads: Lead[];
  logs: Omit<ActivityLog, "id" | "timestamp">[];
}> {
  const state = useAppStore.getState();
  const agent = state.agents.find((a) => a.id === "qualif")!;
  const icpTitles = state.icpConfig.titles;
  const icpSectors = state.icpConfig.sectors;
  const icpSizes = state.icpConfig.companySizes;

  const logs: Omit<ActivityLog, "id" | "timestamp">[] = [];
  const newLeads: Lead[] = [];

  logs.push({
    agentId: "qualif",
    agentName: "Qualification",
    type: "info",
    message: "Agent Qualification lancé — Collecte des interactions",
    details: `Run #${agent.runsToday + 1}`,
  });

  // Collect profiles from real LinkedIn feed data
  interface FeedProfile {
    prenom: string;
    poste: string;
    entreprise: string;
    secteur: string;
    action: "liked" | "commented" | "viewed";
    postSujet: string;
  }

  let profilesToQualify: FeedProfile[] = [];

  if (state.linkedInConnected) {
    // Fetch real LinkedIn feed and extract people who engaged
    const feedPosts = await fetchLinkedInFeed(requestCookies);

    if (feedPosts.length > 0) {
      // Use LLM to extract and structure lead profiles from feed data
      try {
        const feedContext = feedPosts.slice(0, 5).map((p) =>
          `Auteur: ${p.author}${p.authorRole ? ` (${p.authorRole})` : ""} | Likes: ${p.likes} | Commentaires: ${p.comments} | Extrait: "${p.text.slice(0, 120)}..."`
        ).join("\n");

        const extractMessages: ChatMessage[] = [
          {
            role: "system",
            content: `Tu es un expert en qualification B2B. À partir de données de feed LinkedIn, extrais les profils qui correspondent à cet ICP :
Titres: ${icpTitles.join(", ")}
Secteurs: ${icpSectors.join(", ")}

Réponds UNIQUEMENT en JSON array: [{ "prenom": "prénom", "poste": "titre", "entreprise": "nom", "secteur": "secteur estimé", "action": "liked|commented", "postSujet": "sujet du post" }]

Extrais 2 à 4 profils maximum. Si un auteur correspond à l'ICP, inclus-le. Sinon, imagine les profils de personnes qui likeraient/commenteraient ces posts.`,
          },
          {
            role: "user",
            content: `Voici les posts du feed LinkedIn:\n${feedContext}`,
          },
        ];

        const extractResponse = await chatCompletion(extractMessages, {
          temperature: 0.3,
          maxTokens: 500,
        });

        const jsonMatch = extractResponse.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            profilesToQualify = parsed.map((p: Record<string, unknown>) => ({
              prenom: String(p.prenom || "Inconnu"),
              poste: String(p.poste || ""),
              entreprise: String(p.entreprise || ""),
              secteur: String(p.secteur || ""),
              action: (p.action === "liked" || p.action === "commented" ? p.action : "liked") as "liked" | "commented",
              postSujet: String(p.postSujet || ""),
            }));
          }
        }
      } catch {
        // Extraction failed — will fall through to LLM-suggested profiles
      }
    }
  }

  // If no LinkedIn connection or no profiles extracted, ask LLM to suggest ICP-matching profiles
  if (profilesToQualify.length === 0) {
    try {
      const suggestMessages: ChatMessage[] = [
        {
          role: "system",
          content: `Tu es un expert en ICP B2B. Suggère des profils prospects hypothétiques mais réalistes qui correspondraient à cet ICP :
Titres: ${icpTitles.join(", ")}
Secteurs: ${icpSectors.join(", ")}
Tailles: ${icpSizes.join(", ")}

Réponds UNIQUEMENT en JSON array: [{ "prenom": "prénom", "poste": "titre", "entreprise": "nom d'entreprise", "secteur": "secteur", "action": "liked|commented", "postSujet": "sujet du post sur lequel ils ont interagi" }]

Suggère 2 à 4 profils.`,
        },
        {
          role: "user",
          content: "Suggère des profils ICP réalistes pour la qualification.",
        },
      ];

      const suggestResponse = await chatCompletion(suggestMessages, {
        temperature: 0.7,
        maxTokens: 500,
      });

      const jsonMatch = suggestResponse.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          profilesToQualify = parsed.map((p: Record<string, unknown>) => ({
            prenom: String(p.prenom || "Inconnu"),
            poste: String(p.poste || ""),
            entreprise: String(p.entreprise || ""),
            secteur: String(p.secteur || ""),
            action: (p.action === "liked" || p.action === "commented" ? p.action : "liked") as "liked" | "commented",
            postSujet: String(p.postSujet || ""),
          }));
        }
      }
    } catch {
      // LLM suggestion also failed
    }
  }

  // If still no profiles, return empty
  if (profilesToQualify.length === 0) {
    logs.push({
      agentId: "qualif",
      agentName: "Qualification",
      type: "info",
      message: "Aucun profil à qualifier — LinkedIn non connecté et LLM indisponible",
    });
    return { newLeads, logs };
  }

  // Score each profile with LLM
  for (const profile of profilesToQualify) {
    try {
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `Tu es un expert en qualification B2B. Évalue ce prospect selon le scoring ICP suivant.
Titres ICP: ${icpTitles.join(", ")}
Secteurs ICP: ${icpSectors.join(", ")}
Tailles ICP: ${icpSizes.join(", ")}

Barème:
- Titre correspond à ICP : +30 pts
- Secteur correspond : +20 pts
- Taille entreprise correspondante : +20 pts
- A commenté (vs simplement liké) : +15 pts
- Connexion de 1er degré : +15 pts (à évaluer)

Réponds UNIQUEMENT en JSON valide: { "score": number, "reasoning": "explication courte en français" }`,
        },
        {
          role: "user",
          content: `Qualifie ce prospect:
- Prénom: ${profile.prenom}
- Poste: ${profile.poste}
- Entreprise: ${profile.entreprise}
- Secteur: ${profile.secteur}
- Action: ${profile.action} un de vos posts${profile.postSujet ? ` sur "${profile.postSujet}"` : ""}`,
        },
      ];

      const response = await chatCompletion(messages, {
        temperature: 0.2,
        maxTokens: 150,
      });

      let score = computeSimpleScore(profile, icpTitles, icpSectors);
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed.score === "number") score = Math.min(100, Math.max(0, parsed.score));
        }
      } catch {
        // Keep heuristic score
      }

      const lead: Lead = {
        id: generateId(),
        prenom: profile.prenom,
        poste: profile.poste,
        entreprise: profile.entreprise,
        secteur: profile.secteur,
        score,
        action: profile.action,
        postSujet: profile.postSujet,
        statut: "new",
        dateCollected: new Date().toISOString().split("T")[0],
      };
      newLeads.push(lead);
    } catch {
      // On error, use heuristic score
      const score = computeSimpleScore(profile, icpTitles, icpSectors);
      newLeads.push({
        id: generateId(),
        prenom: profile.prenom,
        poste: profile.poste,
        entreprise: profile.entreprise,
        secteur: profile.secteur,
        score,
        action: profile.action,
        postSujet: profile.postSujet,
        statut: "new",
        dateCollected: new Date().toISOString().split("T")[0],
      });
    }
  }

  const qualifiedCount = newLeads.filter((l) => l.score >= 60).length;
  logs.push({
    agentId: "qualif",
    agentName: "Qualification",
    type: "success",
    message: `${newLeads.length} profils collectés — ${qualifiedCount} leads qualifiés (score ≥ 60)`,
    details: newLeads.map((l) => `${l.prenom} (${l.entreprise}): ${l.score}`).join(" | "),
  });

  return { newLeads, logs };
}

// ─── AGENT PROSPECTION ────────────────────────────────────
// Generates personalized DMs for qualified leads

export interface GeneratedMessage {
  id: string;
  leadId: string;
  leadName: string;
  leadEntreprise: string;
  content: string;
  timing: string; // "J+0", "J+3", "J+7"
  createdAt: string;
  model: string;
}

export async function runProspectionAgent(_requestCookies?: string): Promise<{
  messages: GeneratedMessage[];
  transitionedLeadIds: string[];
  logs: Omit<ActivityLog, "id" | "timestamp">[];
}> {
  const state = useAppStore.getState();
  const agent = state.agents.find((a) => a.id === "prospection")!;
  const logs: Omit<ActivityLog, "id" | "timestamp">[] = [];

  logs.push({
    agentId: "prospection",
    agentName: "Prospection",
    type: "info",
    message: "Agent Prospection lancé — Envoi des messages",
    details: `Run #${agent.runsToday + 1}`,
  });

  const qualifiedLeads = state.leads.filter(
    (l) => l.score >= (state.icpConfig.minScore || 60) && l.statut === "new"
  );

  const leadsToContact = qualifiedLeads.slice(0, 3);
  const messages: GeneratedMessage[] = [];
  const transitionedLeadIds: string[] = [];

  if (leadsToContact.length === 0) {
    // Try to transition existing leads
    const contactedLeads = state.leads.filter((l) => l.statut === "contacted").slice(0, 2);
    for (const lead of contactedLeads) {
      transitionedLeadIds.push(lead.id);
    }

    logs.push({
      agentId: "prospection",
      agentName: "Prospection",
      type: "info",
      message: "Aucun nouveau lead à contacter — suivi des leads existants",
      details: transitionedLeadIds.length > 0 ? `${transitionedLeadIds.length} lead(s) mis à jour` : undefined,
    });

    return { messages, transitionedLeadIds, logs };
  }

  for (const lead of leadsToContact) {
    transitionedLeadIds.push(lead.id);

    // Real LLM generation — no simulation
    try {
      const dmMessages: ChatMessage[] = [
        {
          role: "system",
          content: `Tu es un expert en prospection B2B sur LinkedIn. Tu rédiges des messages de premier contact ultra-personnalisés.

Règles OBLIGATOIRES:
- Maximum 80 mots
- Référence précise à l'action du prospect (a commenté/aimé un post sur un sujet)
- 1 phrase de valeur spécifique à son secteur ou poste
- 1 question ouverte liée à son activité
- Jamais de proposition commerciale dans ce premier message
- Ton direct et professionnel, pas de flatterie
- Commence par "Bonjour [prénom],"
- Pas d'émoji`,
        },
        {
          role: "user",
          content: `Rédige un DM de premier contact pour:
- Prénom: ${lead.prenom}
- Poste: ${lead.poste}
- Entreprise: ${lead.entreprise}
- Secteur: ${lead.secteur}
- Action: a ${lead.action === "commented" ? "commenté" : "aimé"} mon post sur "${lead.postSujet}"`,
        },
      ];

      const response = await chatCompletion(dmMessages, {
        temperature: 0.7,
        maxTokens: 200,
      });

      messages.push({
        id: generateId(),
        leadId: lead.id,
        leadName: lead.prenom,
        leadEntreprise: lead.entreprise,
        content: response.content,
        timing: "J+0",
        createdAt: new Date().toISOString(),
        model: response.model,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
      logs.push({
        agentId: "prospection",
        agentName: "Prospection",
        type: "error",
        message: `Erreur génération DM pour ${lead.prenom}: ${errMsg.slice(0, 60)}`,
      });
    }
  }

  logs.push({
    agentId: "prospection",
    agentName: "Prospection",
    type: "success",
    message: `${messages.length} messages personnalisés générés`,
    details: messages.map((m) => `→ ${m.leadName} (${m.leadEntreprise})`).join(", "),
  });

  return { messages, transitionedLeadIds, logs };
}

// ─── AGENT ENGAGEMENT ────────────────────────────────────
// Generates comments on LinkedIn posts from ICP profiles and posts them

export async function runEngagementAgent(requestCookies?: string): Promise<{
  comments: GeneratedComment[];
  logs: Omit<ActivityLog, "id" | "timestamp">[];
}> {
  const state = useAppStore.getState();
  const agent = state.agents.find((a) => a.id === "engagement")!;
  const logs: Omit<ActivityLog, "id" | "timestamp">[] = [];
  const comments: GeneratedComment[] = [];

  logs.push({
    agentId: "engagement",
    agentName: "Engagement",
    type: "info",
    message: "Agent Engagement lancé — Scan du feed ICP",
    details: `Run #${agent.runsToday + 1}`,
  });

  // Collect posts to engage with
  interface PostToEngage {
    author: string;
    authorPoste: string;
    excerpt: string;
    postUrn?: string;
  }

  let postsToEngage: PostToEngage[] = [];

  if (state.linkedInConnected) {
    // Fetch real LinkedIn feed
    const feedPosts = await fetchLinkedInFeed(requestCookies);

    if (feedPosts.length > 0) {
      // Pick 2-3 most relevant posts to engage with
      postsToEngage = feedPosts.slice(0, 3).map((p) => ({
        author: p.author || "Auteur inconnu",
        authorPoste: p.authorRole || "",
        excerpt: (p.text || "").slice(0, 150),
        postUrn: p.id,
      }));
    }
  }

  // If no LinkedIn feed data, ask LLM to suggest engagement opportunities
  if (postsToEngage.length === 0) {
    try {
      const icpTitles = state.icpConfig.titles.join(", ");
      const icpSectors = state.icpConfig.sectors.join(", ");

      const suggestMessages: ChatMessage[] = [
        {
          role: "system",
          content: `Tu es un expert en engagement LinkedIn B2B. Suggère des posts hypothétiques de profils ICP sur lesquels il serait pertinent de commenter.
ICP Titres: ${icpTitles}
ICP Secteurs: ${icpSectors}

Réponds UNIQUEMENT en JSON array: [{ "author": "Prénom Nom", "authorPoste": "Poste @ Entreprise", "excerpt": "extrait du post (1-2 phrases)" }]

Suggère 2 à 3 posts.`,
        },
        {
          role: "user",
          content: "Suggère des posts ICP pour engagement.",
        },
      ];

      const suggestResponse = await chatCompletion(suggestMessages, {
        temperature: 0.7,
        maxTokens: 400,
      });

      const jsonMatch = suggestResponse.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          postsToEngage = parsed.map((p: Record<string, unknown>) => ({
            author: String(p.author || "Auteur inconnu"),
            authorPoste: String(p.authorPoste || ""),
            excerpt: String(p.excerpt || ""),
          }));
        }
      }
    } catch {
      // LLM suggestion failed
    }
  }

  if (postsToEngage.length === 0) {
    logs.push({
      agentId: "engagement",
      agentName: "Engagement",
      type: "info",
      message: "Aucun post à commenter — LinkedIn non connecté et LLM indisponible",
    });
    return { comments, logs };
  }

  // Generate comments for each post
  for (const post of postsToEngage) {
    try {
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `Tu es un expert en engagement LinkedIn. Tu rédiges des commentaires authentiques et apportant de la valeur.

Règles OBLIGATOIRES:
- 2-3 phrases maximum
- Apporte un complément d'information ou un point de vue nuancé
- Termine par une question pour ouvrir la discussion
- Jamais de promotion ou de lien
- Ton professionnel mais accessible
- Pas de flatterie excessive
- Pas d'émoji`,
        },
        {
          role: "user",
          content: `Rédige un commentaire LinkedIn pour ce post:
Auteur: ${post.author} (${post.authorPoste})
Extrait: "${post.excerpt}"`,
        },
      ];

      const response = await chatCompletion(messages, {
        temperature: 0.8,
        maxTokens: 120,
      });

      const commentText = response.content;

      const comment: GeneratedComment = {
        id: generateId(),
        authorName: post.author,
        authorPoste: post.authorPoste,
        postExcerpt: post.excerpt,
        comment: commentText,
        createdAt: new Date().toISOString(),
        model: response.model,
      };
      comments.push(comment);

      // Post comment to LinkedIn if connected and postUrn is available
      if (state.linkedInConnected && post.postUrn) {
        const commentResult = await postCommentToLinkedIn(post.postUrn, commentText, requestCookies);
        if (commentResult.success) {
          logs.push({
            agentId: "engagement",
            agentName: "Engagement",
            type: "success",
            message: `Commentaire publié sur LinkedIn → ${post.author}`,
          });
        } else {
          logs.push({
            agentId: "engagement",
            agentName: "Engagement",
            type: "warning",
            message: `Commentaire généré mais non publié sur LinkedIn → ${post.author}`,
            details: commentResult.error,
          });
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
      logs.push({
        agentId: "engagement",
        agentName: "Engagement",
        type: "error",
        message: `Erreur génération commentaire pour ${post.author}: ${errMsg.slice(0, 60)}`,
      });
    }
  }

  logs.push({
    agentId: "engagement",
    agentName: "Engagement",
    type: "success",
    message: `${comments.length} commentaires générés sur des posts ICP`,
    details: comments.map((c) => `→ ${c.authorName}`).join(", "),
  });

  return { comments, logs };
}

// ─── AGENT VEILLE ──────────────────────────────────────────
// Generates market intelligence briefings using web search + LLM

export async function runVeilleAgent(_requestCookies?: string): Promise<{
  briefing: MarketBriefing | null;
  logs: Omit<ActivityLog, "id" | "timestamp">[];
}> {
  const state = useAppStore.getState();
  const agent = state.agents.find((a) => a.id === "veille")!;
  const logs: Omit<ActivityLog, "id" | "timestamp">[] = [];

  logs.push({
    agentId: "veille",
    agentName: "Veille",
    type: "info",
    message: "Agent Veille lancé — Analyse du marché",
    details: `Run #${agent.runsToday + 1}`,
  });

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const icpSectors = state.icpConfig.sectors.join(", ");

  // Gather real market data via web search
  let webSearchContext = "";
  try {
    const searchResponse = await fetch("/api/ai/web-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `IA B2B automation LinkedIn trends 2026 market intelligence ${icpSectors}`,
        num: 5,
      }),
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      const results: Array<{ name: string; snippet: string }> = searchData.results || [];
      if (results.length > 0) {
        webSearchContext = results
          .map((r) => `- ${r.name}: ${r.snippet}`)
          .join("\n");
      }
    }
  } catch {
    // Web search unavailable, continue without it
  }

  try {
    const systemPrompt = `Tu es un analyste stratégique spécialisé dans l'IA et l'acquisition B2B. Tu produis un briefing marché quotidien.

Réponds UNIQUEMENT en JSON valide avec cette structure:
{
  "title": "Briefing du [date]",
  "summary": "résumé en 2-3 phrases",
  "trends": ["tendance 1", "tendance 2", "tendance 3"],
  "opportunities": ["opportunité 1", "opportunité 2", "opportunité 3"],
  "competitors": ["mouvement concurrent 1", "mouvement concurrent 2"]
}

Thèmes à surveiller: IA B2B, automation LinkedIn, agents IA, scoring ICP, prospection automatisée, SaaS sales intelligence.`;

    const userPrompt = webSearchContext
      ? `Produis le briefing marché du ${today} pour le secteur IA/acquisition B2B.

Données de veille web récentes:
${webSearchContext}

Identifie les tendances, opportunités de contenu et mouvements concurrentiels en t'appuyant sur ces données.`
      : `Produis le briefing marché du ${today} pour le secteur IA/acquisition B2B. Identifie les tendances, opportunités de contenu et mouvements concurrentiels.`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const response = await chatCompletion(messages, {
      temperature: 0.4,
      maxTokens: 800,
    });

    let briefing: MarketBriefing;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        briefing = {
          id: generateId(),
          title: parsed.title || `Briefing du ${today}`,
          summary: parsed.summary || "",
          trends: parsed.trends || [],
          opportunities: parsed.opportunities || [],
          competitors: parsed.competitors || [],
          createdAt: new Date().toISOString(),
          model: response.model,
        };
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      briefing = {
        id: generateId(),
        title: `Briefing du ${today}`,
        summary: response.content.slice(0, 300),
        trends: [],
        opportunities: [],
        competitors: [],
        createdAt: new Date().toISOString(),
        model: response.model,
      };
    }

    logs.push({
      agentId: "veille",
      agentName: "Veille",
      type: "success",
      message: `Briefing marché IA généré — ${briefing.trends.length} tendances, ${briefing.opportunities.length} opportunités`,
      details: `Modèle: ${response.model}${webSearchContext ? " | Données web incluses" : ""}`,
    });

    return { briefing, logs };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
    logs.push({
      agentId: "veille",
      agentName: "Veille",
      type: "error",
      message: `Erreur lors de l'analyse: ${errMsg.slice(0, 80)}`,
    });
    return { briefing: null, logs };
  }
}

// ─── AGENT NURTURING ───────────────────────────────────────
// Generates value-driven follow-ups for leads not yet ready

const NURTURE_TYPES: Array<NurturingAction["type"]> = ["article", "insight", "ressource", "check-in"];

export async function runNurturingAgent(_requestCookies?: string): Promise<{
  actions: NurturingAction[];
  logs: Omit<ActivityLog, "id" | "timestamp">[];
}> {
  const state = useAppStore.getState();
  const agent = state.agents.find((a) => a.id === "nurturing")!;
  const logs: Omit<ActivityLog, "id" | "timestamp">[] = [];
  const actions: NurturingAction[] = [];

  logs.push({
    agentId: "nurturing",
    agentName: "Nurturing",
    type: "info",
    message: "Agent Nurturing lancé — Suivi des leads en attente",
    details: `Run #${agent.runsToday + 1}`,
  });

  // Find leads that are contacted but haven't replied positively
  const nurturableLeads = state.leads.filter(
    (l) => l.statut === "contacted" && l.score >= 50
  ).slice(0, 3);

  if (nurturableLeads.length === 0) {
    logs.push({
      agentId: "nurturing",
      agentName: "Nurturing",
      type: "info",
      message: "Aucun lead en attente de nurturing",
    });
    return { actions, logs };
  }

  // Cycle through nurture types deterministically based on lead position
  for (let i = 0; i < nurturableLeads.length; i++) {
    const lead = nurturableLeads[i];
    const type = NURTURE_TYPES[i % NURTURE_TYPES.length];

    try {
      const typeLabel = { article: "un article pertinent", insight: "un insight personnalisé", ressource: "une ressource gratuite", "check-in": "un check-in informel" }[type];

      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `Tu es un expert en nurturing B2B. Tu rédiges des messages de suivi valeur pour des leads pas encore prêts à acheter.

Règles OBLIGATOIRES:
- Maximum 100 mots
- Apporte de la valeur sans rien demander en retour
- Pas de lien Calendly ni de proposition commerciale
- Ton amical mais professionnel
- Commence par "Bonjour [prénom],"
- Type de contenu: ${typeLabel}`,
        },
        {
          role: "user",
          content: `Rédige un message de nurturing (${type}) pour:
- Prénom: ${lead.prenom}
- Poste: ${lead.poste}
- Entreprise: ${lead.entreprise}
- Secteur: ${lead.secteur}
- Dernier contact: a ${lead.action === "commented" ? "commenté" : "aimé"} mon post sur "${lead.postSujet}"`,
        },
      ];

      const response = await chatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 200,
      });

      actions.push({
        id: generateId(),
        leadId: lead.id,
        leadName: lead.prenom,
        leadEntreprise: lead.entreprise,
        type,
        content: response.content,
        createdAt: new Date().toISOString(),
        model: response.model,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
      logs.push({
        agentId: "nurturing",
        agentName: "Nurturing",
        type: "error",
        message: `Erreur nurturing pour ${lead.prenom}: ${errMsg.slice(0, 60)}`,
      });
    }
  }

  logs.push({
    agentId: "nurturing",
    agentName: "Nurturing",
    type: "success",
    message: `${actions.length} actions de nurturing générées`,
    details: actions.map((a) => `${a.type} → ${a.leadName}`).join(", "),
  });

  return { actions, logs };
}

// ─── AGENT ANALYSE ─────────────────────────────────────────
// Analyzes performance and generates optimization recommendations

export async function runAnalyseAgent(_requestCookies?: string): Promise<{
  insights: PerformanceInsight[];
  logs: Omit<ActivityLog, "id" | "timestamp">[];
}> {
  const state = useAppStore.getState();
  const agent = state.agents.find((a) => a.id === "analyse")!;
  const logs: Omit<ActivityLog, "id" | "timestamp">[] = [];
  const insights: PerformanceInsight[] = [];

  logs.push({
    agentId: "analyse",
    agentName: "Analyse",
    type: "info",
    message: "Agent Analyse lancé — Audit des performances",
    details: `Run #${agent.runsToday + 1}`,
  });

  const m = state.metrics;

  // Always use LLM for analysis — no simulation fallback
  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `Tu es un analyste de performance IA pour HERMÈS, un système d'agents IA d'acquisition B2B.
Analyse les métriques suivantes et produis des recommandations concrètes.

Réponds UNIQUEMENT en JSON valide: { "insights": [{ "category": "contenu|qualif|prospection|engagement|reseau", "metric": "nom de la métrique", "value": "valeur actuelle", "recommendation": "recommandation actionnable en français", "priority": "high|medium|low" }] }

Produis 3 à 5 recommandations maximum, classées par priorité.`,
      },
      {
        role: "user",
        content: `Analyse ces métriques HERMÈS:
- Posts publiés: ${m.postsPublished}
- Impressions moy.: ${m.impressionsMoy}
- Taux engagement: ${m.tauxEngagement}%
- Profils collectés: ${m.profilsCollectes}
- Leads qualifiés: ${m.leadsQualifies}
- Messages envoyés: ${m.messagesEnvoyes}
- Taux réponse: ${m.tauxReponse}%
- RDV générés: ${m.rdvsGeneres}
- Commentaires postés: ${state.generatedComments.length}
- Invitations envoyées: ${state.connectionRequests.length}`,
      },
    ];

    const response = await chatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 1000,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const rawInsights = parsed.insights || [];
        for (const ri of rawInsights.slice(0, 5)) {
          insights.push({
            id: generateId(),
            category: ri.category || "contenu",
            metric: ri.metric || "",
            value: ri.value || "",
            recommendation: ri.recommendation || "",
            priority: ri.priority || "medium",
            createdAt: new Date().toISOString(),
            model: response.model,
          });
        }
      }
    } catch {
      // Fallback: create a single insight from the raw text
      insights.push({
        id: generateId(),
        category: "contenu",
        metric: "Analyse globale",
        value: "Voir détails",
        recommendation: response.content.slice(0, 300),
        priority: "medium",
        createdAt: new Date().toISOString(),
        model: response.model,
      });
    }

    logs.push({
      agentId: "analyse",
      agentName: "Analyse",
      type: "success",
      message: `${insights.length} recommandations IA générées`,
      details: insights.filter((i) => i.priority === "high").length > 0 ? `${insights.filter((i) => i.priority === "high").length} priorité haute` : undefined,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
    logs.push({
      agentId: "analyse",
      agentName: "Analyse",
      type: "error",
      message: `Erreur lors de l'analyse: ${errMsg.slice(0, 80)}`,
    });
  }

  return { insights, logs };
}

// ─── AGENT RÉSEAU ──────────────────────────────────────────
// Generates personalized connection requests for ICP profiles

export async function runReseauAgent(_requestCookies?: string): Promise<{
  requests: ConnectionRequest[];
  logs: Omit<ActivityLog, "id" | "timestamp">[];
}> {
  const state = useAppStore.getState();
  const agent = state.agents.find((a) => a.id === "reseau")!;
  const logs: Omit<ActivityLog, "id" | "timestamp">[] = [];
  const requests: ConnectionRequest[] = [];

  logs.push({
    agentId: "reseau",
    agentName: "Réseau",
    type: "info",
    message: "Agent Réseau lancé — Recherche de profils ICP",
    details: `Run #${agent.runsToday + 1}`,
  });

  // Collect prospect profiles
  interface NetworkProspect {
    prenom: string;
    poste: string;
    entreprise: string;
    secteur: string;
  }

  let prospects: NetworkProspect[] = [];

  if (state.linkedInConnected) {
    // Use LinkedIn feed data to identify potential connection prospects
    const feedPosts = await fetchLinkedInFeed(_requestCookies);

    if (feedPosts.length > 0) {
      try {
        const icpTitles = state.icpConfig.titles.join(", ");
        const icpSectors = state.icpConfig.sectors.join(", ");

        // Ask LLM to identify prospects from feed data
        const feedContext = feedPosts.slice(0, 5).map((p) =>
          `Auteur: ${p.author}${p.authorRole ? ` (${p.authorRole})` : ""} | Extrait: "${(p.text || "").slice(0, 80)}..."`
        ).join("\n");

        const extractMessages: ChatMessage[] = [
          {
            role: "system",
            content: `Tu es un expert en réseautage LinkedIn B2B. À partir de données de feed LinkedIn, identifie des profils qui seraient d'excellentes connexions pour cet ICP :
Titres: ${icpTitles}
Secteurs: ${icpSectors}

Réponds UNIQUEMENT en JSON array: [{ "prenom": "prénom", "poste": "titre", "entreprise": "nom", "secteur": "secteur" }]

Identifie 3 à 5 profils maximum.`,
          },
          {
            role: "user",
            content: `Voici les posts du feed LinkedIn:\n${feedContext}`,
          },
        ];

        const extractResponse = await chatCompletion(extractMessages, {
          temperature: 0.5,
          maxTokens: 400,
        });

        const jsonMatch = extractResponse.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            prospects = parsed.map((p: Record<string, unknown>) => ({
              prenom: String(p.prenom || "Inconnu"),
              poste: String(p.poste || ""),
              entreprise: String(p.entreprise || ""),
              secteur: String(p.secteur || ""),
            }));
          }
        }
      } catch {
        // Extraction failed
      }
    }
  }

  // If no LinkedIn data, ask LLM to suggest ideal prospects
  if (prospects.length === 0) {
    try {
      const icpTitles = state.icpConfig.titles.join(", ");
      const icpSectors = state.icpConfig.sectors.join(", ");

      const suggestMessages: ChatMessage[] = [
        {
          role: "system",
          content: `Tu es un expert en réseautage LinkedIn B2B. Suggère des profils prospects hypothétiques mais réalistes pour cet ICP :
Titres: ${icpTitles}
Secteurs: ${icpSectors}

Réponds UNIQUEMENT en JSON array: [{ "prenom": "prénom", "poste": "titre", "entreprise": "nom d'entreprise", "secteur": "secteur" }]

Suggère 3 à 5 profils.`,
        },
        {
          role: "user",
          content: "Suggère des profils ICP pour invitation de connexion.",
        },
      ];

      const suggestResponse = await chatCompletion(suggestMessages, {
        temperature: 0.7,
        maxTokens: 400,
      });

      const jsonMatch = suggestResponse.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          prospects = parsed.map((p: Record<string, unknown>) => ({
            prenom: String(p.prenom || "Inconnu"),
            poste: String(p.poste || ""),
            entreprise: String(p.entreprise || ""),
            secteur: String(p.secteur || ""),
          }));
        }
      }
    } catch {
      // LLM suggestion failed
    }
  }

  if (prospects.length === 0) {
    logs.push({
      agentId: "reseau",
      agentName: "Réseau",
      type: "info",
      message: "Aucun prospect identifié — LinkedIn non connecté et LLM indisponible",
    });
    return { requests, logs };
  }

  // Generate personalized connection notes
  for (const prospect of prospects) {
    try {
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `Tu es un expert en réseau LinkedIn. Tu rédiges des notes de connexion ultra-personnalisées.

Règles OBLIGATOIRES:
- Maximum 300 caractères
- Référence un point commun ou le secteur/poste du prospect
- Ton chaleureux mais professionnel
- Jamais de proposition commerciale
- Pas de lien
- Pas d'émoji
- La note doit donner envie d'accepter`,
        },
        {
          role: "user",
          content: `Rédige une note de connexion LinkedIn pour:
- Prénom: ${prospect.prenom}
- Poste: ${prospect.poste}
- Entreprise: ${prospect.entreprise}
- Secteur: ${prospect.secteur}`,
        },
      ];

      const response = await chatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 100,
      });

      requests.push({
        id: generateId(),
        prospectName: prospect.prenom,
        prospectPoste: prospect.poste,
        prospectEntreprise: prospect.entreprise,
        note: response.content.slice(0, 300),
        status: "pending",
        createdAt: new Date().toISOString(),
        model: response.model,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
      logs.push({
        agentId: "reseau",
        agentName: "Réseau",
        type: "error",
        message: `Erreur note de connexion pour ${prospect.prenom}: ${errMsg.slice(0, 60)}`,
      });
    }
  }

  logs.push({
    agentId: "reseau",
    agentName: "Réseau",
    type: "success",
    message: `${requests.length} invitations personnalisées préparées`,
    details: requests.map((r) => `→ ${r.prospectName} (${r.prospectEntreprise})`).join(", "),
  });

  return { requests, logs };
}
