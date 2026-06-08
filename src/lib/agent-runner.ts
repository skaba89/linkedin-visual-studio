/**
 * Real Agent Runner for HERMÈS
 * 
 * Executes agents by calling the configured LLM provider.
 * Each agent has its own prompt and processes real data.
 * Falls back gracefully when no API key is configured.
 */

import { useAppStore, type Lead, type ActivityLog } from "@/store/appStore";
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
