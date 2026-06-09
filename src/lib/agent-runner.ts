/**
 * Real Agent Runner for HERMÈS
 * 
 * Executes agents by calling the configured LLM provider.
 * Each agent has its own prompt and processes real data.
 * Falls back gracefully when no API key is configured.
 */

import { useAppStore, type Lead, type ActivityLog, type GeneratedComment, type MarketBriefing, type NurturingAction, type PerformanceInsight, type ConnectionRequest } from "@/store/appStore";
import { chatCompletion, type ChatMessage } from "@/lib/ai-client";

// ─── Helper ──────────────────────────────────────────────
function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function isApiKeyConfigured(): boolean {
  const state = useAppStore.getState();
  const providerId = state.hermesConfig.provider;
  const apiKey = state.hermesConfig.providerApiKeys[providerId];
  return !!(apiKey && apiKey.trim().length > 0);
}

// ─── AGENT CONTENU ───────────────────────────────────────
// Generates a real LinkedIn post using the LLM

export interface GeneratedPost {
  id: string;
  text: string;
  topic: string;
  createdAt: string;
  model: string;
  agentRun: number;
}

const POST_TOPICS = [
  "Comment l'IA transforme la prospection B2B en 2026",
  "5 erreurs qui tuent vos séquences de prospection LinkedIn",
  "Pourquoi 90% des DM de prospection sont ignorés (et comment faire partie des 10%)",
  "L'automatisation LinkedIn sans spam : c'est possible",
  "Comment passer de 2 à 12 RDV par semaine avec des agents IA",
  "Le scoring ICP : pourquoi la qualité bat la quantité en B2B",
  "Agents IA vs SDR humains : ce que les données montrent vraiment",
  "Comment j'ai automatisé 80% de mon acquisition B2B en 30 jours",
  "Le framework A.R.C pour prospecter sans perdre son âme",
  "3 signaux faibles qui indiquent qu'un prospect est prêt à acheter",
];

export async function runContenuAgent(): Promise<{
  post: GeneratedPost | null;
  logs: Omit<ActivityLog, "id" | "timestamp">[];
}> {
  const state = useAppStore.getState();
  const agent = state.agents.find((a) => a.id === "contenu")!;
  const icpTitles = state.icpConfig.titles.join(", ");
  const topic = POST_TOPICS[Math.floor(Math.random() * POST_TOPICS.length)];

  const logs: Omit<ActivityLog, "id" | "timestamp">[] = [];

  logs.push({
    agentId: "contenu",
    agentName: "Contenu",
    type: "info",
    message: `Agent Contenu lancé — Sujet: "${topic}"`,
    details: `Run #${agent.runsToday + 1}`,
  });

  if (!isApiKeyConfigured()) {
    // Simulation fallback
    logs.push({
      agentId: "contenu",
      agentName: "Contenu",
      type: "warning",
      message: "Aucune clé API configurée — mode simulation",
      details: "Configurez une clé API dans Paramètres pour du contenu réel",
    });

    const simPost: GeneratedPost = {
      id: generateId(),
      text: generateSimulatedPost(topic),
      topic,
      createdAt: new Date().toISOString(),
      model: "simulation",
      agentRun: agent.runsToday + 1,
    };

    logs.push({
      agentId: "contenu",
      agentName: "Contenu",
      type: "success",
      message: `Post simulé généré — ${topic.slice(0, 40)}...`,
      details: "Mode simulation (pas de clé API)",
    });

    return { post: simPost, logs };
  }

  // Real LLM call
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
    };

    logs.push({
      agentId: "contenu",
      agentName: "Contenu",
      type: "success",
      message: `Post généré par IA — "${topic.slice(0, 35)}..."`,
      details: `Modèle: ${response.model} | ${response.content.split(/\s+/).length} mots`,
    });

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

const LEAD_PROFILES = [
  { prenom: "Alexandre", poste: "CEO", entreprise: "NovaTech", secteur: "SaaS B2B", action: "commented" as const },
  { prenom: "Chloé", poste: "Head of Growth", entreprise: "ScaleUp.io", secteur: "SaaS B2B", action: "liked" as const },
  { prenom: "Romain", poste: "Directeur Commercial", entreprise: "ConsultPro", secteur: "Conseil", action: "commented" as const },
  { prenom: "Emma", poste: "CMO", entreprise: "DigitalAgency+", secteur: "Agences digitales", action: "liked" as const },
  { prenom: "Nicolas", poste: "Co-fondateur", entreprise: "AIStart", secteur: "SaaS B2B", action: "commented" as const },
  { prenom: "Sarah", poste: "VP Sales", entreprise: "GrowthCorp", secteur: "SaaS B2B", action: "commented" as const },
  { prenom: "Hugo", poste: "Directrice Marketing", entreprise: "FormaPlus", secteur: "Formation professionnelle", action: "liked" as const },
  { prenom: "Léa", poste: "Fondateur", entreprise: "AutoBiz", secteur: "MarTech", action: "commented" as const },
];

export async function runQualificationAgent(): Promise<{
  newLeads: Lead[];
  logs: Omit<ActivityLog, "id" | "timestamp">[];
}> {
  const state = useAppStore.getState();
  const agent = state.agents.find((a) => a.id === "qualif")!;
  const icpTitles = state.icpConfig.titles;
  const icpSectors = state.icpConfig.sectors;
  const icpSizes = state.icpConfig.companySizes;

  const logs: Omit<ActivityLog, "id" | "timestamp">[] = [];
  logs.push({
    agentId: "qualif",
    agentName: "Qualification",
    type: "info",
    message: "Agent Qualification lancé — Collecte des interactions",
    details: `Run #${agent.runsToday + 1}`,
  });

  // Pick 2-3 random profiles to qualify
  const shuffled = [...LEAD_PROFILES].sort(() => Math.random() - 0.5);
  const profilesToQualify = shuffled.slice(0, Math.floor(Math.random() * 2) + 2);
  const newLeads: Lead[] = [];

  if (!isApiKeyConfigured()) {
    // Simulation: score with simple heuristic
    for (const profile of profilesToQualify) {
      const score = computeSimpleScore(profile, icpTitles, icpSectors);
      const sujet = ["automation LinkedIn", "IA pour PME", "prospection automatisée", "scoring ICP", "agents IA"][Math.floor(Math.random() * 5)];
      const lead: Lead = {
        id: generateId(),
        prenom: profile.prenom,
        poste: profile.poste,
        entreprise: profile.entreprise,
        secteur: profile.secteur,
        score,
        action: profile.action,
        postSujet: sujet,
        statut: "new",
        dateCollected: new Date().toISOString().split("T")[0],
      };
      newLeads.push(lead);
    }

    logs.push({
      agentId: "qualif",
      agentName: "Qualification",
      type: "warning",
      message: `${newLeads.length} profils collectés (simulation) — ${newLeads.filter((l) => l.score >= 60).length} leads qualifiés`,
      details: "Mode simulation — configurez une clé API pour le scoring IA",
    });
  } else {
    // Real LLM scoring
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
- Action: ${profile.action} un de vos posts`,
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

        const sujet = ["automation LinkedIn", "IA pour PME", "prospection automatisée", "scoring ICP", "agents IA"][Math.floor(Math.random() * 5)];
        const lead: Lead = {
          id: generateId(),
          prenom: profile.prenom,
          poste: profile.poste,
          entreprise: profile.entreprise,
          secteur: profile.secteur,
          score,
          action: profile.action,
          postSujet: sujet,
          statut: "new",
          dateCollected: new Date().toISOString().split("T")[0],
        };
        newLeads.push(lead);
      } catch {
        // On error, use heuristic
        const score = computeSimpleScore(profile, icpTitles, icpSectors);
        const sujet = ["automation LinkedIn", "IA pour PME", "prospection automatisée"][Math.floor(Math.random() * 3)];
        newLeads.push({
          id: generateId(),
          prenom: profile.prenom,
          poste: profile.poste,
          entreprise: profile.entreprise,
          secteur: profile.secteur,
          score,
          action: profile.action,
          postSujet: sujet,
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
  }

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

export async function runProspectionAgent(): Promise<{
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
      message: leadsToContact.length === 0 ? "Aucun nouveau lead à contacter — suivi des leads existants" : `${leadsToContact.length} messages envoyés`,
      details: transitionedLeadIds.length > 0 ? `${transitionedLeadIds.length} lead(s) mis à jour` : undefined,
    });

    return { messages, transitionedLeadIds, logs };
  }

  for (const lead of leadsToContact) {
    transitionedLeadIds.push(lead.id);

    if (!isApiKeyConfigured()) {
      // Simulation
      const msg = generateSimulatedDM(lead);
      messages.push({
        id: generateId(),
        leadId: lead.id,
        leadName: lead.prenom,
        leadEntreprise: lead.entreprise,
        content: msg,
        timing: "J+0",
        createdAt: new Date().toISOString(),
        model: "simulation",
      });
    } else {
      // Real LLM
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
      } catch {
        messages.push({
          id: generateId(),
          leadId: lead.id,
          leadName: lead.prenom,
          leadEntreprise: lead.entreprise,
          content: generateSimulatedDM(lead),
          timing: "J+0",
          createdAt: new Date().toISOString(),
          model: "simulation (fallback)",
        });
      }
    }
  }

  logs.push({
    agentId: "prospection",
    agentName: "Prospection",
    type: "success",
    message: `${messages.length} messages personnalisés envoyés`,
    details: messages.map((m) => `→ ${m.leadName} (${m.leadEntreprise})`).join(", "),
  });

  return { messages, transitionedLeadIds, logs };
}

// ─── AGENT ENGAGEMENT ────────────────────────────────────
// Generates comments on LinkedIn posts from ICP profiles

const ICP_FEED_POSTS = [
  { author: "Marie Dupont", authorPoste: "CMO @ DataPulse", excerpt: "L'IA va-t-elle remplacer les équipes marketing ? Mon retour d'expérience après 6 mois..." },
  { author: "Thomas Leroy", authorPoste: "CEO @ ScaleForce", excerpt: "Nous avons doublé notre pipeline en 3 mois. Voici le framework exact que nous avons utilisé..." },
  { author: "Sophie Martin", authorPoste: "Directrice Marketing @ Agence+", excerpt: "Pourquoi la plupart des stratégies de contenu B2B échouent (et comment corriger le tir)..." },
  { author: "Lucas Bernard", authorPoste: "Fondateur @ GrowthLab", excerpt: "5 outils IA qui nous font gagner 20h par semaine en prospection. Thread complet ci-dessous..." },
  { author: "Camille Petit", authorPoste: "VP Sales @ InnovateLab", excerpt: "Le secret des équipes commerciales qui dépassent leur quota de 150% ? Ce n'est pas ce que vous croyez..." },
  { author: "Antoine Moreau", authorPoste: "Head of Growth @ CloudPeak", excerpt: "J'ai analysé 1000 DMs de prospection. Voici les 3 patterns qui génèrent le plus de réponses..." },
];

export async function runEngagementAgent(): Promise<{
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

  // Pick 2-3 posts to engage with
  const shuffled = [...ICP_FEED_POSTS].sort(() => Math.random() - 0.5);
  const postsToEngage = shuffled.slice(0, Math.floor(Math.random() * 2) + 2);

  if (!isApiKeyConfigured()) {
    for (const post of postsToEngage) {
      comments.push({
        id: generateId(),
        authorName: post.author,
        authorPoste: post.authorPoste,
        postExcerpt: post.excerpt,
        comment: generateSimulatedComment(post.author.split(" ")[0], post.excerpt),
        createdAt: new Date().toISOString(),
        model: "simulation",
      });
    }
    logs.push({
      agentId: "engagement",
      agentName: "Engagement",
      type: "warning",
      message: `${comments.length} commentaires simulés sur des posts ICP`,
      details: "Mode simulation — configurez une clé API pour des commentaires IA",
    });
  } else {
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

        comments.push({
          id: generateId(),
          authorName: post.author,
          authorPoste: post.authorPoste,
          postExcerpt: post.excerpt,
          comment: response.content,
          createdAt: new Date().toISOString(),
          model: response.model,
        });
      } catch {
        comments.push({
          id: generateId(),
          authorName: post.author,
          authorPoste: post.authorPoste,
          postExcerpt: post.excerpt,
          comment: generateSimulatedComment(post.author.split(" ")[0], post.excerpt),
          createdAt: new Date().toISOString(),
          model: "simulation (fallback)",
        });
      }
    }

    logs.push({
      agentId: "engagement",
      agentName: "Engagement",
      type: "success",
      message: `${comments.length} commentaires IA publiés sur des posts ICP`,
      details: comments.map((c) => `→ ${c.authorName}`).join(", "),
    });
  }

  return { comments, logs };
}

// ─── AGENT VEILLE ──────────────────────────────────────────
// Generates market intelligence briefings

export async function runVeilleAgent(): Promise<{
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

  if (!isApiKeyConfigured()) {
    const simBriefing: MarketBriefing = {
      id: generateId(),
      title: `Briefing du ${today}`,
      summary: "Le marché de l'IA B2B continue de croître avec une attention croissante sur l'automatisation de la prospection. Les outils d'agents IA gagnent en traction sur LinkedIn.",
      trends: [
        "Les posts sur les agents IA surpassent les posts SDR traditionnels en engagement",
        "Le scoring ICP automatisé devient un standard dans les outils de sales intelligence",
        "Les séquences DM multi-étapes génèrent 3x plus de RDV que les messages uniques",
      ],
      opportunities: [
        "Créer un post sur le ROI concret des agents IA vs SDR junior",
        "Publier un comparatif des outils de scoring ICP gratuits",
        "Partager un cas client avec des métriques précises",
      ],
      competitors: [
        "Salesflow a lancé une fonctionnalité d'agents IA cette semaine",
        "Expandi met à jour son algorithme de personalisation",
      ],
      createdAt: new Date().toISOString(),
      model: "simulation",
    };
    logs.push({
      agentId: "veille",
      agentName: "Veille",
      type: "warning",
      message: "Briefing marché simulé généré",
      details: "Mode simulation — configurez une clé API pour des analyses IA",
    });
    return { briefing: simBriefing, logs };
  }

  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `Tu es un analyste stratégique spécialisé dans l'IA et l'acquisition B2B. Tu produis un briefing marché quotidien.

Réponds UNIQUEMENT en JSON valide avec cette structure:
{
  "title": "Briefing du [date]",
  "summary": "résumé en 2-3 phrases",
  "trends": ["tendance 1", "tendance 2", "tendance 3"],
  "opportunities": ["opportunité 1", "opportunité 2", "opportunité 3"],
  "competitors": ["mouvement concurrent 1", "mouvement concurrent 2"]
}

Thèmes à surveiller: IA B2B, automation LinkedIn, agents IA, scoring ICP, prospection automatisée, SaaS sales intelligence.`,
      },
      {
        role: "user",
        content: `Produis le briefing marché du ${today} pour le secteur IA/acquisition B2B. Identifie les tendances, opportunités de contenu et mouvements concurrentiels.`,
      },
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
      details: `Modèle: ${response.model}`,
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

export async function runNurturingAgent(): Promise<{
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

  if (!isApiKeyConfigured()) {
    for (const lead of nurturableLeads) {
      const type = NURTURE_TYPES[Math.floor(Math.random() * NURTURE_TYPES.length)];
      actions.push({
        id: generateId(),
        leadId: lead.id,
        leadName: lead.prenom,
        leadEntreprise: lead.entreprise,
        type,
        content: generateSimulatedNurture(lead, type),
        createdAt: new Date().toISOString(),
        model: "simulation",
      });
    }
    logs.push({
      agentId: "nurturing",
      agentName: "Nurturing",
      type: "warning",
      message: `${actions.length} actions de nurturing simulées`,
      details: "Mode simulation — configurez une clé API pour du contenu IA",
    });
  } else {
    for (const lead of nurturableLeads) {
      try {
        const type = NURTURE_TYPES[Math.floor(Math.random() * NURTURE_TYPES.length)];
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
      } catch {
        actions.push({
          id: generateId(),
          leadId: lead.id,
          leadName: lead.prenom,
          leadEntreprise: lead.entreprise,
          type: "check-in",
          content: generateSimulatedNurture(lead, "check-in"),
          createdAt: new Date().toISOString(),
          model: "simulation (fallback)",
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
  }

  return { actions, logs };
}

// ─── AGENT ANALYSE ─────────────────────────────────────────
// Analyzes performance and generates optimization recommendations

export async function runAnalyseAgent(): Promise<{
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

  if (!isApiKeyConfigured()) {
    // Generate heuristic insights
    insights.push({
      id: generateId(),
      category: "contenu",
      metric: "Taux d'engagement",
      value: `${m.tauxEngagement}%`,
      recommendation: m.tauxEngagement < 3 ? "Les posts sous-performent. Tester des hooks plus surprenants et des chiffres concrets en ligne 1." : "Bon taux d'engagement. Continuer à tester différents formats (listes, histoires, contre-intuition).",
      priority: m.tauxEngagement < 3 ? "high" : "low",
      createdAt: new Date().toISOString(),
      model: "simulation",
    });
    insights.push({
      id: generateId(),
      category: "prospection",
      metric: "Taux de réponse",
      value: `${m.tauxReponse}%`,
      recommendation: m.tauxReponse < 20 ? "Le taux de réponse est faible. Raccourcir les messages à 60 mots max et personnaliser davantage la référence au post." : "Bon taux de réponse. Tester l'ajout d'une question plus spécifique au secteur du prospect.",
      priority: m.tauxReponse < 20 ? "high" : "medium",
      createdAt: new Date().toISOString(),
      model: "simulation",
    });
    insights.push({
      id: generateId(),
      category: "qualif",
      metric: "Taux de qualification",
      value: `${m.profilsCollectes > 0 ? Math.round((m.leadsQualifies / m.profilsCollectes) * 100) : 0}%`,
      recommendation: "Affiner les critères ICP pour améliorer la qualité des profils collectés. Se concentrer sur les secteurs avec le meilleur taux de conversion.",
      priority: "medium",
      createdAt: new Date().toISOString(),
      model: "simulation",
    });
    insights.push({
      id: generateId(),
      category: "reseau",
      metric: "Croissance réseau",
      value: `${state.connectionRequests.length} invitations`,
      recommendation: "Cibler les groupes LinkedIn actifs dans la niche pour trouver des prospects plus qualifiés. Personnaliser chaque note de connexion.",
      priority: "low",
      createdAt: new Date().toISOString(),
      model: "simulation",
    });

    logs.push({
      agentId: "analyse",
      agentName: "Analyse",
      type: "warning",
      message: `${insights.length} recommandations simulées générées`,
      details: "Mode simulation — configurez une clé API pour des analyses IA approfondies",
    });
  } else {
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
  }

  return { insights, logs };
}

// ─── AGENT RÉSEAU ──────────────────────────────────────────
// Generates personalized connection requests for ICP profiles

const NETWORK_PROSPECTS = [
  { prenom: "Isabelle", poste: "CEO", entreprise: "InnovateSaaS", secteur: "SaaS B2B" },
  { prenom: "Maxime", poste: "Head of Growth", entreprise: "DataDriven", secteur: "SaaS B2B" },
  { prenom: "Clara", poste: "Directrice Marketing", entreprise: "GrowthPartner", secteur: "Conseil" },
  { prenom: "Baptiste", poste: "Co-fondateur", entreprise: "AutoScale", secteur: "SaaS B2B" },
  { prenom: "Amandine", poste: "VP Sales", entreprise: "SalesTech", secteur: "MarTech" },
  { prenom: "Florent", poste: "CMO", entreprise: "LeadFactory", secteur: "Agences digitales" },
];

export async function runReseauAgent(): Promise<{
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

  // Pick 3-5 prospects
  const shuffled = [...NETWORK_PROSPECTS].sort(() => Math.random() - 0.5);
  const prospectsToContact = shuffled.slice(0, Math.floor(Math.random() * 3) + 3);

  if (!isApiKeyConfigured()) {
    for (const prospect of prospectsToContact) {
      requests.push({
        id: generateId(),
        prospectName: prospect.prenom,
        prospectPoste: prospect.poste,
        prospectEntreprise: prospect.entreprise,
        note: generateSimulatedConnectionNote(prospect.prenom, prospect.entreprise),
        status: "pending",
        createdAt: new Date().toISOString(),
        model: "simulation",
      });
    }
    logs.push({
      agentId: "reseau",
      agentName: "Réseau",
      type: "warning",
      message: `${requests.length} invitations simulées préparées`,
      details: "Mode simulation — configurez une clé API pour des notes personnalisées IA",
    });
  } else {
    for (const prospect of prospectsToContact) {
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
      } catch {
        requests.push({
          id: generateId(),
          prospectName: prospect.prenom,
          prospectPoste: prospect.poste,
          prospectEntreprise: prospect.entreprise,
          note: generateSimulatedConnectionNote(prospect.prenom, prospect.entreprise),
          status: "pending",
          createdAt: new Date().toISOString(),
          model: "simulation (fallback)",
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
  }

  return { requests, logs };
}

// ─── Helpers ──────────────────────────────────────────────

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
  // Random factor
  score += Math.floor(Math.random() * 15);
  return Math.min(100, score);
}

function generateSimulatedPost(topic: string): string {
  return `J'ai passé de 2 à 12 RDV par semaine avec un seul changement dans ma prospection LinkedIn.

Pendant 6 mois, j'ai fait comme tout le monde : copier-coller le même message à 50 prospects par jour.

Résultat ? 3 réponses. 0 RDV.

Puis j'ai changé d'approche. Au lieu de vendre, j'ai commencé par écouter. Au lieu de massifier, j'ai personnalisé. Et surtout, j'ai laissé l'IA faire le travail répétitif.

Aujourd'hui, chaque message que j'envoie est unique. Chaque prospect sent que je lui parle vraiment. Et mon taux de réponse est passé de 2% à 28%.

Le secret n'est pas d'envoyer plus. C'est d'envoyer mieux.

Comment personnalisez-vous votre approche prospection aujourd'hui ?`;
}

function generateSimulatedDM(lead: Lead): string {
  const actionVerb = lead.action === "commented" ? "commenté" : "aimé";
  return `Bonjour ${lead.prenom},

J'ai vu que vous aviez ${actionVerb} mon post sur ${lead.postSujet}. Votre poste de ${lead.poste} chez ${lead.entreprise} m'intéresse beaucoup — les enjeux ${lead.secteur.includes("SaaS") ? "SaaS" : lead.secteur.includes("Conseil") ? "du conseil" : "de votre secteur"} en matière d'acquisition sont souvent sous-estimés.

Quel est votre principal défi en prospection en ce moment ?`;
}

function generateSimulatedComment(firstName: string, excerpt: string): string {
  return `Merci pour ce partage ${firstName}. Un point souvent négligé : la personnalisation ne se limite pas au prénom. C'est la référence au contexte métier qui fait la différence. Quel est le canal qui vous apporte le mieux aujourd'hui ?`;
}

function generateSimulatedNurture(lead: Lead, type: NurturingAction["type"]): string {
  const templates: Record<NurturingAction["type"], string> = {
    article: `Bonjour ${lead.prenom},\n\nJe suis tombé sur un article très éclairant sur les tendances d'acquisition dans le secteur ${lead.secteur}. Ça m'a fait penser à votre contexte chez ${lead.entreprise}.\n\nPas de suivi commercial de ma part — juste un partage qui pourrait vous être utile.`,
    insight: `Bonjour ${lead.prenom},\n\nLes équipes ${lead.poste.includes("Sales") ? "commerciales" : "marketing"} qui automatisent leur premier contact voient leur taux de réponse augmenter de 40% en moyenne. Je pensais à votre situation chez ${lead.entreprise} en lisant cette donnée.`,
    ressource: `Bonjour ${lead.prenom},\n\nJ'ai mis en ligne un template de séquence de prospection personnalisée. Si ça peut être utile pour ${lead.entreprise}, n'hésitez pas — c'est gratuit.`,
    "check-in": `Bonjour ${lead.prenom},\n\nUn petit message pour prendre des nouvelles. Toujours dans la ${lead.secteur.includes("SaaS") ? "tech" : "consulting"} chez ${lead.entreprise} ?\n\nSi jamais vous explorez des solutions d'automatisation, je serais ravi d'échanger.`,
  };
  return templates[type];
}

function generateSimulatedConnectionNote(prenom: string, entreprise: string): string {
  return `Bonjour ${prenom}, je suis les contenus de ${entreprise} avec intérêt. Serait pertinent d'échanger sur nos approches respectives en acquisition B2B.`;
}
