/**
 * LinkedIn AI-powered content generation service for HERMÈS
 * 
 * Generates posts, comments, and content suggestions based on:
 * - Project context (HERMÈS, AI agents, B2B prospection)
 * - Current trends and news on LinkedIn
 * - ICP (Ideal Customer Profile) configuration
 * - Best posting times analysis
 * 
 * NOTE: No hardcoded fallback content. All data comes from AI or web search.
 * If AI/web search is unavailable, functions return empty arrays or null.
 */

import { chatCompletion, type ChatMessage } from "./ai-client";
import { useAppStore } from "@/store/appStore";

// ─── Types ──────────────────────────────────────────────────────

export interface LinkedInPostSuggestion {
  id: string;
  text: string;
  topic: string;
  hook: string;
  estimatedEngagement: "high" | "medium" | "low";
  bestTime: string;
  format: "story" | "list" | "contrarian" | "tutorial" | "data" | "question";
}

export interface LinkedInCommentSuggestion {
  id: string;
  text: string;
  postExcerpt: string;
  tone: "value-add" | "question" | "agreement" | "contrarian";
}

export interface TrendingTopic {
  topic: string;
  angle: string;
  热度: "hot" | "warm" | "rising";
  suggestedHook: string;
}

export interface PostAnalysis {
  styleProfile: string;
  topTopics: string[];
  topFormats: string[];
  avgEngagement: string;
  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface BestTimeSlot {
  day: string;
  time: string;
  score: number;
  reason: string;
}

// ─── Web Search Helper ──────────────────────────────────────────

/**
 * Calls the server-side web search API route (backed by z-ai-web-dev-sdk).
 * Must go through the API route because the SDK is backend-only.
 */
async function webSearch(query: string, num: number = 10): Promise<unknown[]> {
  try {
    const res = await fetch("/api/ai/web-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, num }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch (error) {
    console.error("Web search error:", error);
    return [];
  }
}

// ─── Context Builder ────────────────────────────────────────────

function getProjectContext(): string {
  const state = useAppStore.getState();
  const icpTitles = state.icpConfig.titles.join(", ");
  const icpSectors = state.icpConfig.sectors.join(", ");
  const recentPosts = state.generatedPosts.slice(0, 5).map(p => p.topic);
  
  return `Projet HERMÈS : Gateway d'agents IA pour l'acquisition B2B sur LinkedIn.
8 agents autonomes : Contenu, Qualification, Prospection, Engagement, Veille, Nurturing, Analyse, Réseau.
ICP cible : ${icpTitles} dans les secteurs ${icpSectors}.
Sujets récents abordés : ${recentPosts.length > 0 ? recentPosts.join(", ") : "IA, prospection B2B, automation LinkedIn, scoring ICP"}`;
}

// ─── Best Time Analysis ─────────────────────────────────────────

/**
 * Returns optimal posting times for LinkedIn B2B content.
 * Tries web search first, then LLM, then falls back to a simple default.
 */
export async function getBestPostingTimes(): Promise<BestTimeSlot[]> {
  // Strategy 1: Web search for current best posting times
  try {
    const results = await webSearch(
      `best times to post on LinkedIn B2B ${new Date().getFullYear()} engagement research`,
      5
    );

    if (results.length > 0) {
      // Extract useful info from search results and ask LLM to structure it
      const searchContext = JSON.stringify(results).slice(0, 3000);

      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `Tu es un analyste de données LinkedIn. À partir des résultats de recherche web ci-dessous, identifie les meilleurs créneaux de publication LinkedIn pour une audience B2B française/européenne.

Réponds en JSON strict (tableau) :
[
  { "day": "jour en français", "time": "HH:MM", "score": 0-100, "reason": "raison courte en français" }
]

Données de recherche web :
${searchContext}`,
        },
        {
          role: "user",
          content: "Quels sont les meilleurs créneaux de publication LinkedIn B2B d'après ces données ?",
        },
      ];

      const response = await chatCompletion(messages, {
        temperature: 0.4,
        maxTokens: 800,
      });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.sort((a: BestTimeSlot, b: BestTimeSlot) => b.score - a.score);
        }
      }
    }
  } catch (error) {
    console.error("Web search best times error:", error);
  }

  // Strategy 2: Ask LLM directly
  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `Tu es un expert en stratégie de contenu LinkedIn B2B pour une audience française/européenne.
Recommande les meilleurs créneaux de publication pour maximiser l'engagement B2B.

Réponds en JSON strict (tableau de 5-7 entrées) :
[
  { "day": "jour en français", "time": "HH:MM", "score": 0-100, "reason": "raison courte en français" }
]

Langue : français`,
      },
      {
        role: "user",
        content: "Quels sont les meilleurs créneaux de publication LinkedIn pour une audience B2B en 2025 ?",
      },
    ];

    const response = await chatCompletion(messages, {
      temperature: 0.4,
      maxTokens: 800,
    });

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a: BestTimeSlot, b: BestTimeSlot) => b.score - a.score);
      }
    }
  } catch (error) {
    console.error("LLM best times error:", error);
  }

  // Strategy 3: Simple default fallback
  console.warn("[HERMÈS] getBestPostingTimes: AI and web search unavailable, using simple default times");
  return [
    { day: "Lundi", time: "09:00", score: 80, reason: "Créneau matinal par défaut" },
    { day: "Mercredi", time: "12:00", score: 75, reason: "Pause déjeuner par défaut" },
    { day: "Jeudi", time: "18:00", score: 70, reason: "Créneau en soirée par défaut" },
  ];
}

/**
 * Returns the single best next posting time from now.
 */
export function getNextBestTime(): { day: string; time: string; reason: string } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const hour = now.getHours();
  
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const today = dayNames[dayOfWeek];
  
  // If it's a weekday morning before 8:30, post now
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour < 9) {
    return { day: today, time: "08:00", reason: "Créneau matinal optimal — publiez maintenant !" };
  }
  
  // If it's a weekday lunch
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 11 && hour <= 13) {
    return { day: today, time: "12:00", reason: "Pause déjeuner — bon créneau de visibilité" };
  }
  
  // Weekday afternoon — suggest tomorrow morning
  if (dayOfWeek >= 1 && dayOfWeek <= 4 && hour >= 14) {
    return { day: dayNames[dayOfWeek + 1], time: "07:45", reason: "Prochain créneau optimal : demain matin" };
  }
  
  // Friday afternoon — suggest Monday
  if (dayOfWeek === 5 && hour >= 14) {
    return { day: "Lundi", time: "08:00", reason: "Vendredi PM = faible engagement. Attendez lundi matin" };
  }
  
  // Weekend — suggest Tuesday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { day: "Lundi", time: "08:00", reason: "Weekend = faible audience B2B. Attendez lundi" };
  }
  
  return { day: "Demain", time: "08:00", reason: "Créneau matinal recommandé" };
}

// ─── AI Post Generation ─────────────────────────────────────────

/**
 * Generate AI-powered LinkedIn post suggestions based on project context and trends.
 */
export async function generatePostSuggestions(
  count: number = 3,
  format?: LinkedInPostSuggestion["format"],
  topic?: string
): Promise<LinkedInPostSuggestion[]> {
  const context = getProjectContext();
  const formats = format ? [format] : ["story", "list", "contrarian", "tutorial", "data", "question"];
  const nextBest = getNextBestTime();
  
  const topicInstruction = topic
    ? `\nSUJET IMPOSÉ : "${topic}". Tu dois générer des posts spécifiquement sur ce sujet avec un angle d'expert data. Le sujet doit être développé en profondeur avec des données, des insights et une perspective d'expert.\n`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Tu es un expert en contenu LinkedIn B2B spécialisé IA et acquisition.
${context}
${topicInstruction}
Génère ${count} suggestions de posts LinkedIn. Pour chaque suggestion, réponds en JSON strict :
[
  {
    "text": "texte complet du post (150-220 mots, avec hook percutant, corps court, CTA)",
    "topic": "sujet en 3-5 mots",
    "hook": "la première ligne seule",
    "estimatedEngagement": "high|medium|low",
    "format": "${formats.join("|")}"
  }
]

Règles :
- Hook qui force le "voir plus" (chiffre, question, contre-intuition)
- Paragraphes de 2-3 lignes max
- CTA : question ouverte ou "commentez X"
- Varie les formats : ${formats.join(", ")}
- Adapte au contexte HERMÈS et à l'actualité IA/B2B
${topic ? `- Le sujet demandé doit être au cœur de chaque suggestion avec un angle expert data` : ""}
- Langue : français`,
    },
    {
      role: "user",
      content: topic
        ? `Génère ${count} suggestions de posts LinkedIn sur le sujet : "${topic}". Adopte un angle d'expert data. Le meilleur créneau cette semaine est ${nextBest.day} à ${nextBest.time}.`
        : `Génère ${count} suggestions de posts LinkedIn pour cette semaine. Varie les angles et les formats. Le meilleur créneau cette semaine est ${nextBest.day} à ${nextBest.time}.`,
    },
  ];

  try {
    const response = await chatCompletion(messages, {
      temperature: 0.85,
      maxTokens: 2000,
    });

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((p: Record<string, string>, i: number) => ({
        id: `sug-${Date.now()}-${i}`,
        text: p.text || "",
        topic: p.topic || "",
        hook: p.hook || "",
        estimatedEngagement: p.estimatedEngagement || "medium",
        bestTime: `${nextBest.day} ${nextBest.time}`,
        format: p.format || formats[i % formats.length],
      }));
    }
  } catch (error) {
    console.error("AI post suggestion error:", error);
  }

  // Fallback: try a simpler AI prompt before giving up
  return generateFallbackSuggestions(count, formats, nextBest);
}

/**
 * Fallback for post generation: tries AI with a simpler prompt.
 * Returns empty array if AI is also unavailable.
 */
async function generateFallbackSuggestions(
  count: number,
  formats: string[],
  nextBest: { day: string; time: string }
): Promise<LinkedInPostSuggestion[]> {
  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `Génère ${count} posts LinkedIn B2B en français. Réponds en JSON :
[
  { "text": "post complet", "topic": "sujet", "hook": "première ligne", "estimatedEngagement": "high|medium|low", "format": "${formats.join("|")}" }
]`,
      },
      {
        role: "user",
        content: `Génère ${count} posts LinkedIn sur l'IA et la prospection B2B.`,
      },
    ];

    const response = await chatCompletion(messages, {
      temperature: 0.9,
      maxTokens: 1500,
    });

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p: Record<string, string>, i: number) => ({
          id: `sug-fallback-${Date.now()}-${i}`,
          text: p.text || "",
          topic: p.topic || "",
          hook: p.hook || "",
          estimatedEngagement: p.estimatedEngagement || "medium",
          bestTime: `${nextBest.day} ${nextBest.time}`,
          format: p.format || formats[i % formats.length],
        }));
      }
    }
  } catch (error) {
    console.error("Fallback AI post suggestion error:", error);
  }

  console.warn("[HERMÈS] generateFallbackSuggestions: AI unavailable, returning empty array");
  return [];
}

// ─── AI Comment Generation ──────────────────────────────────────

/**
 * Generate AI-powered comment suggestions for a LinkedIn post.
 */
export async function generateCommentSuggestions(
  postText: string,
  postAuthor: string,
  authorRole: string,
  count: number = 3
): Promise<LinkedInCommentSuggestion[]> {
  const context = getProjectContext();
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Tu es un expert en engagement LinkedIn B2B. Tu rédiges des commentaires authentiques et value-adding.
${context}

Règles pour les commentaires :
- 2-3 phrases max
- Apporte un point de vue ou un complément d'info
- Pas de flagrance promo
- Termine par une question pour ouvrir la discussion
- Ton direct mais bienveillant
- Langue : français

Génère ${count} variantes de commentaires en JSON strict :
[
  {
    "text": "commentaire complet",
    "tone": "value-add|question|agreement|contrarian"
  }
]`,
    },
    {
      role: "user",
      content: `Génère ${count} commentaires pour ce post LinkedIn :

Auteur : ${postAuthor} (${authorRole})
Post : "${postText.slice(0, 500)}"`,
    },
  ];

  try {
    const response = await chatCompletion(messages, {
      temperature: 0.75,
      maxTokens: 800,
    });

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((c: Record<string, string>, i: number) => ({
        id: `comment-${Date.now()}-${i}`,
        text: c.text || "",
        postExcerpt: postText.slice(0, 80) + "...",
        tone: c.tone || "value-add",
      }));
    }
  } catch (error) {
    console.error("AI comment suggestion error:", error);
  }

  // No hardcoded fallback — return empty array if AI fails
  console.warn("[HERMÈS] generateCommentSuggestions: AI unavailable, returning empty array");
  return [];
}

// ─── Trending Topics Detection ──────────────────────────────────

/**
 * Generate trending topic suggestions for LinkedIn content based on current context.
 * Uses web search first, then LLM, then returns empty array.
 */
export async function generateTrendingTopics(): Promise<TrendingTopic[]> {
  const context = getProjectContext();
  const state = useAppStore.getState();
  const sectors = state.icpConfig.sectors.join(", ");

  // Strategy 1: Web search for current trending topics
  try {
    const results = await webSearch(
      `LinkedIn trending topics ${sectors} ${new Date().getFullYear()}`,
      10
    );

    if (results.length > 0) {
      // Extract and deduplicate topics from search results, then ask LLM to structure them
      const searchContext = JSON.stringify(results).slice(0, 4000);

      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `Tu es un analyste de tendances LinkedIn B2B spécialisé IA et acquisition.
${context}

À partir des résultats de recherche web ci-dessous, identifie 5 sujets tendance pour du contenu LinkedIn B2B dans la niche IA/prospection.
Pour chaque sujet, propose un angle et un hook.

Réponds en JSON strict :
[
  {
    "topic": "sujet en 3-5 mots",
    "angle": "angle spécifique à aborder",
    "热度": "hot|warm|rising",
    "suggestedHook": "première ligne du post"
  }
]

Données de recherche web :
${searchContext}

Langue : français`,
        },
        {
          role: "user",
          content: "Quels sujets sont tendance cette semaine pour du contenu LinkedIn B2B dans l'IA et la prospection, d'après ces données de recherche ?",
        },
      ];

      const response = await chatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 1000,
      });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Deduplicate by topic
          const seen = new Set<string>();
          return parsed.filter((t: TrendingTopic) => {
            const key = t.topic?.toLowerCase().trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
      }
    }
  } catch (error) {
    console.error("Web search trending topics error:", error);
  }

  // Strategy 2: Ask LLM directly (without web search context)
  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `Tu es un analyste de tendances LinkedIn B2B spécialisé IA et acquisition.
${context}

Identifie 5 sujets tendance cette semaine pour du contenu LinkedIn B2B dans la niche IA/prospection.
Pour chaque sujet, propose un angle et un hook.

Réponds en JSON strict :
[
  {
    "topic": "sujet en 3-5 mots",
    "angle": "angle spécifique à aborder",
    "热度": "hot|warm|rising",
    "suggestedHook": "première ligne du post"
  }
]

Langue : français`,
      },
      {
        role: "user",
        content: "Quels sujets sont tendance cette semaine pour du contenu LinkedIn B2B dans l'IA et la prospection ?",
      },
    ];

    const response = await chatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 1000,
    });

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("LLM trending topics error:", error);
  }

  // No hardcoded fallback — return empty array if both web search and LLM fail
  console.warn("[HERMÈS] generateTrendingTopics: AI and web search unavailable, returning empty array");
  return [];
}

// ─── Post Improvement ───────────────────────────────────────────

/**
 * Analyze and improve an existing post draft.
 */
export async function improvePost(
  draftText: string
): Promise<{ improved: string; suggestions: string[] }> {
  const context = getProjectContext();
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Tu es un expert en copywriting LinkedIn B2B. ${context}

Améliore ce brouillon de post LinkedIn. Réponds en JSON strict :
{
  "improved": "texte amélioré complet",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

Règles d'amélioration :
- Renforcer le hook si nécessaire
- Raccourcir les phrases trop longues
- Ajouter des émojis pertinents (avec parcimonie)
- Améliorer le CTA
- Vérifier la structure hook-corps-CTA
- Garder 150-220 mots`,
    },
    {
      role: "user",
      content: `Améliore ce brouillon :\n\n${draftText}`,
    },
  ];

  try {
    const response = await chatCompletion(messages, {
      temperature: 0.6,
      maxTokens: 1000,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("AI improve post error:", error);
  }

  return { improved: draftText, suggestions: ["Configurez une clé API pour activer l'amélioration IA"] };
}

// ─── Expert Data Mode ──────────────────────────────────────────

/**
 * Analyze the user's existing LinkedIn posts to identify patterns,
 * top-performing content, and writing style.
 * Returns null if AI is unavailable.
 */
export async function analyzeMyPosts(
  posts: { text: string; likes: number; comments: number; createdAt: string }[]
): Promise<PostAnalysis | null> {
  if (posts.length === 0) {
    return {
      styleProfile: "Aucun post à analyser. Publiez du contenu pour obtenir une analyse.",
      topTopics: [],
      topFormats: [],
      avgEngagement: "Aucune donnée",
      recommendations: ["Publiez régulièrement pour accumuler des données d'analyse", "Variez les formats (story, list, data, question)", "Utilisez des hooks percutants avec des chiffres"],
      strengths: [],
      weaknesses: ["Pas assez de données pour identifier des faiblesses"],
    };
  }

  const postsSummary = posts.slice(0, 20).map((p, i) => {
    const date = new Date(p.createdAt).toLocaleDateString("fr-FR");
    return `Post ${i + 1} (${date}) — ${p.likes} likes, ${p.comments} commentaires :\n"${p.text.slice(0, 300)}"`;
  }).join("\n\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Tu es un analyste expert en contenu LinkedIn B2B, spécialisé dans l'analyse de performances et l'optimisation de stratégie de contenu.
Tu analyses les posts d'un utilisateur pour identifier ses forces, faiblesses, et opportunités d'amélioration.
Tu as une expertise approfondie en data, analytics et stratégie de contenu LinkedIn.

Réponds en JSON strict :
{
  "styleProfile": "description du style d'écriture en 2-3 phrases",
  "topTopics": ["sujet 1", "sujet 2", "sujet 3"],
  "topFormats": ["format qui performe le mieux", "format 2"],
  "avgEngagement": "description de l'engagement moyen",
  "recommendations": ["recommandation actionnable 1", "recommandation 2", "recommandation 3", "recommandation 4", "recommandation 5"],
  "strengths": ["force 1", "force 2", "force 3"],
  "weaknesses": ["faiblesse 1", "faiblesse 2", "faiblesse 3"]
}

Langue : français`,
    },
    {
      role: "user",
      content: `Analyse mes ${posts.length} posts LinkedIn et identifie mes patterns de contenu, mon style, et mes opportunités d'amélioration :

${postsSummary}`,
    },
  ];

  try {
    const response = await chatCompletion(messages, {
      temperature: 0.5,
      maxTokens: 1500,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("AI post analysis error:", error);
  }

  // No hardcoded fallback — return null if AI fails
  console.warn("[HERMÈS] analyzeMyPosts: AI unavailable, returning null");
  return null;
}

/**
 * Generate new post suggestions based on post analysis, acting as a "data expert" persona.
 * Posts are optimized based on what performed well historically.
 * Returns empty array if AI fails.
 */
export async function generateExpertPosts(
  analysis: PostAnalysis,
  topic?: string
): Promise<LinkedInPostSuggestion[]> {
  const context = getProjectContext();
  const nextBest = getNextBestTime();
  const count = 3;

  const topicInstruction = topic
    ? `\nSUJET IMPOSÉ : "${topic}". Tu dois générer des posts spécifiquement sur ce sujet avec un angle d'expert data.`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Tu es un expert data et stratège de contenu LinkedIn B2B. Tu génères des posts optimisés basés sur l'analyse des performances passées de l'utilisateur.
${context}

Profil de l'utilisateur :
- Style : ${analysis.styleProfile}
- Sujets qui performent : ${analysis.topTopics.join(", ")}
- Formats qui performent : ${analysis.topFormats.join(", ")}
- Engagement moyen : ${analysis.avgEngagement}
- Forces : ${analysis.strengths.join(", ")}
- Faiblesses à corriger : ${analysis.weaknesses.join(", ")}
- Recommandations : ${analysis.recommendations.join("; ")}
${topicInstruction}

Génère ${count} suggestions de posts LinkedIn optimisés. Pour chaque suggestion, réponds en JSON strict :
[
  {
    "text": "texte complet du post (150-220 mots, avec hook percutant, corps court, CTA)",
    "topic": "sujet en 3-5 mots",
    "hook": "la première ligne seule",
    "estimatedEngagement": "high|medium|low",
    "format": "story|list|contrarian|tutorial|data|question"
  }
]

Règles :
- Maximise l'engagement en exploitant les forces identifiées
- Corrige les faiblesses dans les suggestions
- Utilise les formats et sujets qui performent le mieux
- Hook qui force le "voir plus" (chiffre, question, contre-intuition)
- Paragraphes de 2-3 lignes max
- CTA : question ouverte ou "commentez X"
- Angle expert data avec des insights chiffrés
- Langue : français`,
    },
    {
      role: "user",
      content: topic
        ? `Génère ${count} posts optimisés sur le sujet : "${topic}". Exploite mon profil et mes forces. Le meilleur créneau est ${nextBest.day} à ${nextBest.time}.`
        : `Génère ${count} posts optimisés basés sur mon profil. Exploite mes forces et corrige mes faiblesses. Le meilleur créneau est ${nextBest.day} à ${nextBest.time}.`,
    },
  ];

  try {
    const response = await chatCompletion(messages, {
      temperature: 0.85,
      maxTokens: 2000,
    });

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((p: Record<string, string>, i: number) => ({
        id: `expert-${Date.now()}-${i}`,
        text: p.text || "",
        topic: p.topic || "",
        hook: p.hook || "",
        estimatedEngagement: p.estimatedEngagement || "high",
        bestTime: `${nextBest.day} ${nextBest.time}`,
        format: p.format || "data",
      }));
    }
  } catch (error) {
    console.error("AI expert posts error:", error);
  }

  // No hardcoded fallback — return empty array if AI fails
  console.warn("[HERMÈS] generateExpertPosts: AI unavailable, returning empty array");
  return [];
}
