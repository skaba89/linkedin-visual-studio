/**
 * LinkedIn AI-powered content generation service for HERMÈS
 * 
 * Generates posts, comments, and content suggestions based on:
 * - Project context (HERMÈS, AI agents, B2B prospection)
 * - Current trends and news on LinkedIn
 * - ICP (Ideal Customer Profile) configuration
 * - Best posting times analysis
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

export interface LinkedInPostFromTopic {
  id: string;
  text: string;
  topic: string;
  hook: string;
  score: number;
  scoreBreakdown: {
    hook: number;
    structure: number;
    cta: number;
    readability: number;
    engagement: number;
  };
  bestTime: string;
  format: string;
  tips: string[];
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

export interface BestTimeSlot {
  day: string;
  time: string;
  score: number;
  reason: string;
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
 * Based on LinkedIn engagement research for French/European B2B audiences.
 */
export function getBestPostingTimes(): BestTimeSlot[] {
  return [
    { day: "Lundi", time: "08:00", score: 92, reason: "Début de semaine, haute attention professionnelle" },
    { day: "Mardi", time: "07:45", score: 95, reason: "Meilleur jour B2B, audience proactive" },
    { day: "Mercredi", time: "08:15", score: 88, reason: "Mi-semaine, bonne rétention" },
    { day: "Mercredi", time: "12:00", score: 82, reason: "Pause déjeuner, scroll LinkedIn" },
    { day: "Jeudi", time: "08:00", score: 85, reason: "Toujours bon pour le contenu pro" },
    { day: "Vendredi", time: "09:00", score: 70, reason: "Attention en baisse, bon pour le contenu léger" },
    { day: "Dimanche", time: "18:00", score: 65, reason: "Préparation de la semaine, audience ciblée" },
  ].sort((a, b) => b.score - a.score);
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
  format?: LinkedInPostSuggestion["format"]
): Promise<LinkedInPostSuggestion[]> {
  const context = getProjectContext();
  const formats = format ? [format] : ["story", "list", "contrarian", "tutorial", "data", "question"];
  const nextBest = getNextBestTime();
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Tu es un expert en contenu LinkedIn B2B spécialisé IA et acquisition.
${context}

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
- Langue : français`,
    },
    {
      role: "user",
      content: `Génère ${count} suggestions de posts LinkedIn pour cette semaine. Varie les angles et les formats. Le meilleur créneau cette semaine est ${nextBest.day} à ${nextBest.time}.`,
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

  // Fallback suggestions
  return generateFallbackSuggestions(count);
}

function generateFallbackSuggestions(count: number): LinkedInPostSuggestion[] {
  const nextBest = getNextBestTime();
  const templates = [
    {
      text: `Le saviez-vous ? 78% des décideurs B2B préfèrent être contactés par un pair plutôt que par un commercial.

C'est exactement pourquoi les agents IA changent la donne en matière de prospection :

→ Ils identifient les signaux d'achat en temps réel
→ Ils personnalisent chaque premier message à partir du contexte
→ Ils maintiennent le suivi sans que vous n'ayez à y penser

Le résultat ? Un taux de réponse 3x supérieur aux séquences traditionnelles.

Qui utilise déjà l'IA dans sa prospection ? 👇`,
      topic: "IA & prospection B2B",
      hook: "Le saviez-vous ? 78% des décideurs B2B préfèrent être contactés par un pair",
      estimatedEngagement: "high" as const,
      format: "data" as const,
    },
    {
      text: `J'ai automatisé 100% de ma prospection LinkedIn en 30 jours.

Voici ce qui a changé :

📊 156 profils qualifiés / semaine (vs 12 avant)
📧 28 messages personnalisés / jour (vs 5)
🎯 8 RDV générés / semaine (vs 2)

Le secret ? 3 agents IA qui travaillent 24/7 :
1️⃣ Agent Contenu → publie chaque matin
2️⃣ Agent Qualification → collecte et score les leads
3️⃣ Agent Prospection → envoie les messages et gère les relances

Le tout sans un seul cold call.

Détail du setup en commentaire 👇`,
      topic: "Automation prospection",
      hook: "J'ai automatisé 100% de ma prospection LinkedIn en 30 jours.",
      estimatedEngagement: "high" as const,
      format: "story" as const,
    },
    {
      text: `5 erreurs qui tuent vos messages de prospection LinkedIn :

1️⃣ Commencer par "Bonjour, je me permets de vous contacter car..."
2️⃣ Envoyer un lien Calendly dans le 1er message
3️⃣ Copier-coller le même message à 50 personnes
4️⃣ Parler de vous au lieu de parler du prospect
5️⃣ Oublier de faire un suivi après J+3

La bonne approche ?
✅ Référencez une action précise du prospect
✅ Ajoutez UNE valeur spécifique à son secteur
✅ Posez UNE question ouverte

80 mots max. Pas de pitch. Pas de lien.

Le but du 1er message ? Obtenir une réponse. Pas un RDV.

Quelle erreur avez-vous déjà faite ? 🤝`,
      topic: "Erreurs prospection",
      hook: "5 erreurs qui tuent vos messages de prospection LinkedIn :",
      estimatedEngagement: "high" as const,
      format: "list" as const,
    },
  ];

  return templates.slice(0, count).map((t, i) => ({
    id: `sug-fallback-${Date.now()}-${i}`,
    ...t,
    bestTime: `${nextBest.day} ${nextBest.time}`,
  }));
}

// ─── AI Post Generation from Topic ──────────────────────────────

/**
 * Generate an optimized LinkedIn post from a given topic/title.
 * Returns the post text plus a LinkedIn score with breakdown and tips.
 */
export async function generatePostFromTopic(
  topicTitle: string,
  format?: LinkedInPostSuggestion["format"]
): Promise<LinkedInPostFromTopic> {
  const context = getProjectContext();
  const nextBest = getNextBestTime();
  const chosenFormat = format || "story";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Tu es un expert en contenu LinkedIn B2B spécialisé IA et acquisition de données.
${context}

Génère UN post LinkedIn optimisé pour un score maximal basé sur le sujet fourni.

Réponds en JSON strict :
{
  "text": "texte complet du post (150-220 mots, avec hook percutant, corps court, CTA)",
  "hook": "la première ligne seule",
  "format": "${chosenFormat}",
  "score": 85,
  "scoreBreakdown": {
    "hook": 18,
    "structure": 17,
    "cta": 16,
    "readability": 17,
    "engagement": 17
  },
  "tips": [" conseil 1", "conseil 2", "conseil 3"]
}

Score breakdown (chaque critère sur 20, total sur 100) :
- hook : le hook force-t-il le "voir plus" ? (chiffre, question, contre-intuition)
- structure : hook → corps → CTA bien défini ? Paragraphes courts ?
- cta : appelle-t-il à l'action clairement ? (question ouverte, "commentez X")
- readability : phrases courtes, émojis parcimonieux, blancs entre paragraphes ?
- engagement : le post suscite-t-il débat, partage ou commentaire ?

Règles de rédaction :
- Hook qui force le "voir plus" (chiffre, question, contre-intuition)
- Paragraphes de 2-3 lignes max, avec des blancs entre chaque
- CTA : question ouverte ou "commentez X"
- Ton direct, factuel, sans jargon
- 150 à 220 mots
- Langue : français
- Adapte le contenu au sujet fourni de manière experte`,
    },
    {
      role: "user",
      content: `Rédige un post LinkedIn optimisé sur le sujet suivant : "${topicTitle}"

Format souhaité : ${chosenFormat}
Meilleur créneau de publication : ${nextBest.day} à ${nextBest.time}

Donne-moi le post avec le meilleur score possible.`,
    },
  ];

  try {
    const response = await chatCompletion(messages, {
      temperature: 0.8,
      maxTokens: 1500,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        id: `topic-${Date.now()}`,
        text: parsed.text || "",
        topic: topicTitle,
        hook: parsed.hook || "",
        score: parsed.score || 75,
        scoreBreakdown: parsed.scoreBreakdown || {
          hook: 15, structure: 15, cta: 15, readability: 15, engagement: 15,
        },
        bestTime: `${nextBest.day} ${nextBest.time}`,
        format: parsed.format || chosenFormat,
        tips: parsed.tips || [],
      };
    }
  } catch (error) {
    console.error("AI post from topic error:", error);
  }

  // Fallback: generate a basic post from topic
  return generateFallbackPostFromTopic(topicTitle);
}

function generateFallbackPostFromTopic(topicTitle: string): LinkedInPostFromTopic {
  const nextBest = getNextBestTime();
  const fallbackText = `${topicTitle} — voici ce que la plupart des professionnels ignorent.

Après avoir analysé des dizaines de cas, un pattern clair se dégage :
→ Les entreprises qui automatisent leur approche B2B génèrent 3x plus d'opportunités.
→ Celles qui personalisent chaque interaction ont un taux de réponse 2.5x supérieur.
→ Le combo des deux ? Inarrêtable.

La clé n'est pas de choisir entre automatisation et personnalisation.
C'est de faire travailler l'IA sur la répétitif, pour que vous vous concentriez sur l'humain.

Qu'en pensez-vous ? Comment abordez-vous ce sujet dans votre quotidien ?`;

  return {
    id: `topic-fallback-${Date.now()}`,
    text: fallbackText,
    topic: topicTitle,
    hook: `${topicTitle} — voici ce que la plupart des professionnels ignorent.`,
    score: 72,
    scoreBreakdown: {
      hook: 14, structure: 15, cta: 14, readability: 15, engagement: 14,
    },
    bestTime: `${nextBest.day} ${nextBest.time}`,
    format: "story",
    tips: [
      "Ajoutez un chiffre ou une statistique concrète dans le hook",
      "Structurez en 3 points clés avec des flèches",
      "Terminez par une question ouverte liée au sujet",
    ],
  };
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

  // Fallback comments
  return [
    { id: `comment-fb-${Date.now()}-1`, text: "Très pertinent ! L'approche que vous décrivez rejoint ce qu'on observe chez nos clients : la personnalisation IA fait la différence. Quel outil utilisez-vous pour automatiser ?", postExcerpt: postText.slice(0, 80) + "...", tone: "value-add" as const },
    { id: `comment-fb-${Date.now()}-2`, text: "Je suis 100% d'accord. La clé c'est le bon dosage entre automatisation et personnalisation. Vous avez testé des séquences multi-canal ?", postExcerpt: postText.slice(0, 80) + "...", tone: "question" as const },
    { id: `comment-fb-${Date.now()}-3`, text: "Intéressant ! J'ajouterai que le timing du premier message est tout aussi crucial que son contenu. Un post comme celui-ci mériterait un thread 👏", postExcerpt: postText.slice(0, 80) + "...", tone: "agreement" as const },
  ].slice(0, count);
}

// ─── Trending Topics Detection ──────────────────────────────────

/**
 * Generate trending topic suggestions for LinkedIn content based on current context.
 */
export async function generateTrendingTopics(): Promise<TrendingTopic[]> {
  const context = getProjectContext();
  
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

  try {
    const response = await chatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 1000,
    });

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("AI trending topics error:", error);
  }

  // Fallback trends
  return [
    { topic: "Agents IA autonomes", angle: "Comment les agents IA remplacent les workflows manuels en prospection B2B", 热度: "hot", suggestedHook: "En 2026, 60% des équipes B2B utilisent des agents IA autonomes. Pas des chatbots. Des AGENTS." },
    { topic: "Scoring ICP temps réel", angle: "L'ICP dynamique qui s'adapte aux signaux d'achat en temps réel", 热度: "hot", suggestedHook: "Votre ICP est statique ? C'est comme naviguer sans GPS en 2026." },
    { topic: "Prospection sans cold call", angle: "Les alternatives au cold call qui génèrent plus de RDV", 热度: "warm", suggestedHook: "Dernier cold call que j'ai passé : mars 2024. Depuis ? 3x plus de RDV." },
    { topic: "OpenAI vs open-source", angle: "Pourquoi les modèles open-source gagnent en B2B", 热度: "rising", suggestedHook: "GPT-4o ou Llama 3 ? Le vrai choix n'est pas celui que vous croyez." },
    { topic: "Nurturing automatisé", angle: "Comment automatiser le nurturing sans perdre l'humain", 热度: "warm", suggestedHook: "80% de vos leads qualifiés ne sont pas prêts à acheter. Qu'est-ce que vous en faites ?" },
  ];
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

  return { improved: draftText, suggestions: ["L'IA n'a pas pu améliorer le post. Veuillez réessayer."] };
}

// ─── Image Prompt Generation ─────────────────────────────────────

/**
 * Generate an image prompt optimized for LinkedIn post illustrations.
 * Takes the post topic/content and returns a detailed prompt for image generation.
 */
export async function generateImagePrompt(
  topicOrText: string
): Promise<string> {
  const context = getProjectContext();

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Tu es un expert en design visuel pour les réseaux sociaux B2B, spécialisé dans la création d'images LinkedIn percutantes.
${context}

Génère UN prompt détaillé pour la création d'une image d'illustration LinkedIn à partir du sujet fourni.

Règles pour le prompt d'image :
- L'image doit être professionnelle et moderne, adaptée au B2B
- Style : minimaliste, épuré, avec des couleurs cohérentes (bleu, blanc, gris, ou accents de couleur)
- Éviter le texte dans l'image (sauf titres très courts)
- Privilégier : abstractions géométriques, data visualisation stylisée, métaphores visuelles du sujet
- Format adapté pour LinkedIn (format paysage ou carré)
- Pas de personnes réalistes, préférer les illustrations flat design ou 3D isométrique

Réponds UNIQUEMENT par le prompt en anglais (pour une meilleure qualité de génération), sans guillemets ni explication. Maximum 200 mots.`,
    },
    {
      role: "user",
      content: `Génère un prompt d'image pour illustrer un post LinkedIn sur le sujet : "${topicOrText}"`,
    },
  ];

  try {
    const response = await chatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 300,
    });

    return response.content.trim().replace(/^["']|["']$/g, "");
  } catch (error) {
    console.error("Image prompt generation error:", error);
    // Fallback prompt
    return `Professional LinkedIn B2B illustration: modern minimalist design representing ${topicOrText.slice(0, 80)}, clean geometric shapes, blue and white color palette, data visualization elements, flat design style, corporate social media post image`;
  }
}

// ─── Data Expert Analysis ─────────────────────────────────────────

export interface DataExpertAnalysis {
  patterns: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  suggestedTopics: Array<{
    topic: string;
    angle: string;
    reason: string;
  }>;
  overallScore: number;
}

/**
 * Analyze all existing LinkedIn posts in "Data Expert" mode.
 * Detects patterns, strengths, weaknesses and proposes new topics.
 */
export async function analyzePostsAsDataExpert(
  posts: Array<{ text: string; topic?: string; createdAt?: string; likes?: number; comments?: number }>
): Promise<DataExpertAnalysis> {
  const context = getProjectContext();

  // Build a summary of existing posts for the AI
  const postsSummary = posts.length > 0
    ? posts.map((p, i) => {
        const metrics: string[] = [];
        if (p.likes !== undefined) metrics.push(`${p.likes} likes`);
        if (p.comments !== undefined) metrics.push(`${p.comments} comments`);
        const metricStr = metrics.length > 0 ? ` [${metrics.join(", ")}]` : "";
        const topicStr = p.topic ? ` (Sujet: ${p.topic})` : "";
        return `Post ${i + 1}${topicStr}${metricStr} : "${p.text.slice(0, 200)}${p.text.length > 200 ? "..." : ""}"`;
      }).join("\n\n")
    : "Aucun post existant pour le moment.";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Tu es un expert en analyse de données LinkedIn B2B, spécialisé dans l'audit de stratégie de contenu.
${context}

Analyse les posts LinkedIn existants de cet utilisateur en mode "Data Expert". Tu dois :
1. Identifier les patterns récurrents (thèmes, formats, tons, structures)
2. Repérer les forces (ce qui fonctionne bien)
3. Repérer les faiblesses (ce qui manque ou pourrait être amélioré)
4. Proposer des recommandations concrètes et actionnables
5. Suggérer 5 nouveaux sujets basés sur l'analyse, avec un angle unique et la raison
6. Donner un score global de stratégie de contenu sur 100

Réponds en JSON strict :
{
  "patterns": ["pattern 1", "pattern 2", "pattern 3"],
  "strengths": ["force 1", "force 2"],
  "weaknesses": ["faiblesse 1", "faiblesse 2"],
  "recommendations": ["recommandation 1", "recommandation 2", "recommandation 3"],
  "suggestedTopics": [
    { "topic": "sujet en 3-5 mots", "angle": "angle spécifique", "reason": "pourquoi ce sujet" }
  ],
  "overallScore": 75
}

Règles :
- Sois factuel et data-driven dans ton analyse
- Les recommandations doivent être spécifiques et actionnables (pas de conseils vagues)
- Les sujets proposés doivent être originaux et différenciants par rapport aux posts existants
- Le score doit refléter la qualité réelle de la stratégie (pas de complaisance)
- Langue : français`,
    },
    {
      role: "user",
      content: `Voici mes ${posts.length} posts LinkedIn existants. Analyse-les en mode Data Expert :

${postsSummary}

Donne-moi une analyse complète avec des recommandations concrètes et de nouveaux sujets proposés.`,
    },
  ];

  try {
    const response = await chatCompletion(messages, {
      temperature: 0.5,
      maxTokens: 2500,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        patterns: parsed.patterns || [],
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        recommendations: parsed.recommendations || [],
        suggestedTopics: parsed.suggestedTopics || [],
        overallScore: parsed.overallScore || 50,
      };
    }
  } catch (error) {
    console.error("Data Expert analysis error:", error);
  }

  // Fallback analysis
  return {
    patterns: posts.length > 0
      ? ["Contenu orienté IA et B2B", "Ton direct et factuel", "Structure hook-corps-CTA"]
      : ["Aucun post publié pour le moment"],
    strengths: posts.length > 0
      ? ["Régularité dans la publication", "Expertise technique visible"]
      : ["Aucun post à analyser — c'est le moment de commencer !"],
    weaknesses: posts.length > 0
      ? ["Manque de diversité dans les formats", "CTA pourrait être plus engageant"]
      : ["Pas encore de contenu publié", "Aucune donnée d'engagement disponible"],
    recommendations: posts.length > 0
      ? ["Varier les formats (list, story, data, contrarian)", "Ajouter plus de données chiffrées", "Renforcer les CTA avec des questions ouvertes"]
      : ["Publiez votre premier post pour commencer à collecter des données", "Utilisez la génération IA pour créer votre premier contenu", "Visez 3 posts par semaine pour maximiser la visibilité"],
    suggestedTopics: [
      { topic: "IA et qualité des données B2B", angle: "Pourquoi la qualité des données est le vrai enjeu de l'IA en B2B", reason: "Sujet peu traité mais fondamental pour votre audience" },
      { topic: "ROI de l'automatisation LinkedIn", angle: "Calcul concret du ROI d'un agent IA de prospection", reason: "Angle data-driven qui résonne avec les décideurs" },
      { topic: "Data mesh pour PME", angle: "Comment les PME peuvent adopter le data mesh sans DSI", reason: "Niche technique différenciante" },
      { topic: "Éthique de l'IA en prospection", angle: "Les limites éthiques de l'automatisation B2B", reason: "Sujet engageant qui suscite le débat" },
      { topic: "De data lake à data product", angle: "Pourquoi traiter vos données comme des produits change tout", reason: "Tendance montante dans la data gouvernance" },
    ],
    overallScore: posts.length > 0 ? 55 : 0,
  };
}
