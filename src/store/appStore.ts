import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AgentStatus = "active" | "paused" | "error" | "setup";

export type ViewType =
  | "dashboard"
  | "setup"
  | "agent-contenu"
  | "agent-qualif"
  | "agent-prospection"
  | "agent-engagement"
  | "agent-veille"
  | "agent-nurturing"
  | "agent-analyse"
  | "agent-reseau"
  | "icp"
  | "leads"
  | "templates"
  | "monitoring"
  | "settings"
  | "linkedin";

export interface Agent {
  id: string;
  name: string;
  num: string;
  status: AgentStatus;
  role: string;
  skillMd: string;
  heartbeatMd: string;
  lastRun: string | null;
  runsToday: number;
  nextRun: string | null;
}

export interface Lead {
  id: string;
  prenom: string;
  poste: string;
  entreprise: string;
  secteur: string;
  score: number;
  action: "liked" | "commented" | "viewed";
  postSujet: string;
  statut: "new" | "contacted" | "replied" | "booked" | "archived";
  dateCollected: string;
}

export interface ICPConfig {
  titles: string[];
  sectors: string[];
  companySizes: string[];
  minScore: number;
}

export interface HermesConfig {
  provider: string;       // e.g. "groq", "openrouter", "anthropic"
  model: string;         // e.g. "llama-3.3-70b-versatile"
  providerApiKeys: Record<string, string>;  // { groq: "gsk_...", openrouter: "sk-or-...", ... }
  channels: string[];
  security: {
    allowShell: boolean;
    allowBrowser: boolean;
    forbiddenCommands: string[];
  };
}

export interface MessageTemplate {
  id: string;
  name: string;
  timing: string;
  content: string;
  notes: string[];
}

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
  headline: string | null;
}

export interface LinkedInPost {
  id: string;
  text: string;
  createdAt: string;
  likes: number;
  comments: number;
  visibility: string;
}

export interface GeneratedPost {
  id: string;
  text: string;
  topic: string;
  createdAt: string;
  model: string;
  agentRun: number;
}

export interface GeneratedMessage {
  id: string;
  leadId: string;
  leadName: string;
  leadEntreprise: string;
  content: string;
  timing: string;
  createdAt: string;
  model: string;
}

export interface GeneratedComment {
  id: string;
  authorName: string;
  authorPoste: string;
  postExcerpt: string;
  comment: string;
  createdAt: string;
  model: string;
}

export interface MarketBriefing {
  id: string;
  title: string;
  summary: string;
  trends: string[];
  opportunities: string[];
  competitors: string[];
  createdAt: string;
  model: string;
}

export interface NurturingAction {
  id: string;
  leadId: string;
  leadName: string;
  leadEntreprise: string;
  type: "article" | "insight" | "ressource" | "check-in";
  content: string;
  createdAt: string;
  model: string;
}

export interface PerformanceInsight {
  id: string;
  category: "contenu" | "qualif" | "prospection" | "engagement" | "reseau";
  metric: string;
  value: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
  createdAt: string;
  model: string;
}

export interface ConnectionRequest {
  id: string;
  prospectName: string;
  prospectPoste: string;
  prospectEntreprise: string;
  note: string;
  status: "pending" | "sent" | "accepted" | "ignored";
  createdAt: string;
  model: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string; // ISO string
  agentId: string;
  agentName: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  details?: string;
}

interface AppState {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;

  agents: Agent[];
  updateAgent: (id: string, updates: Partial<Agent>) => void;

  leads: Lead[];
  addLead: (lead: Lead) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  removeLead: (id: string) => void;

  icpConfig: ICPConfig;
  updateICPConfig: (updates: Partial<ICPConfig>) => void;

  hermesConfig: HermesConfig;
  updateHermesConfig: (updates: Partial<HermesConfig>) => void;

  templates: MessageTemplate[];
  updateTemplate: (id: string, updates: Partial<MessageTemplate>) => void;

  metrics: {
    postsPublished: number;
    impressionsMoy: number;
    tauxEngagement: number;
    profilsCollectes: number;
    leadsQualifies: number;
    messagesEnvoyes: number;
    tauxReponse: number;
    rdvsGeneres: number;
  };

  activityLogs: ActivityLog[];
  addActivityLog: (log: Omit<ActivityLog, "id" | "timestamp">) => void;
  clearActivityLogs: () => void;

  isSimulating: boolean;
  setIsSimulating: (v: boolean) => void;
  simulationSpeed: number; // 1 = normal, 2 = fast, 4 = ultra
  setSimulationSpeed: (s: number) => void;
  updateMetrics: (updates: Partial<AppState["metrics"]>) => void;
  runAgentNow: (agentId: string) => void;

  // LinkedIn integration
  linkedInConnected: boolean;
  setLinkedInConnected: (v: boolean) => void;
  linkedInProfile: LinkedInProfile | null;
  setLinkedInProfile: (p: LinkedInProfile | null) => void;
  linkedInConfig: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  updateLinkedInConfig: (updates: Partial<AppState["linkedInConfig"]>) => void;
  linkedInPosts: LinkedInPost[];
  addLinkedInPost: (post: LinkedInPost) => void;

  // AI-generated content
  generatedPosts: GeneratedPost[];
  addGeneratedPost: (post: GeneratedPost) => void;
  generatedMessages: GeneratedMessage[];
  addGeneratedMessage: (msg: GeneratedMessage) => void;
  addGeneratedMessages: (msgs: GeneratedMessage[]) => void;
  generatedComments: GeneratedComment[];
  addGeneratedComment: (c: GeneratedComment) => void;
  addGeneratedComments: (cs: GeneratedComment[]) => void;
  marketBriefings: MarketBriefing[];
  addMarketBriefing: (b: MarketBriefing) => void;
  nurturingActions: NurturingAction[];
  addNurturingAction: (a: NurturingAction) => void;
  addNurturingActions: (as: NurturingAction[]) => void;
  performanceInsights: PerformanceInsight[];
  addPerformanceInsight: (i: PerformanceInsight) => void;
  addPerformanceInsights: (is: PerformanceInsight[]) => void;
  connectionRequests: ConnectionRequest[];
  addConnectionRequest: (r: ConnectionRequest) => void;
  addConnectionRequests: (rs: ConnectionRequest[]) => void;
  executingAgent: string | null;
  setExecutingAgent: (agentId: string | null) => void;
}

const defaultSkillContenu = `---
name: generate_linkedin_post
description: Génère un post LinkedIn percutant à partir des tendances du jour.
version: 1.0
tools:
  - browser
  - shell
---

# Contexte
Tu es un expert en contenu LinkedIn spécialisé dans l'IA et l'acquisition B2B.
Ton audience cible : {{ICP : CEO, CMO, fondateurs de startups B2B}}
Ton positionnement : {{ex. Automatisation IA pour PME et consultants}}

# Instructions
1. Utilise l'outil \`browser\` pour scraper les 5 posts les plus
   engagés sur LinkedIn aujourd'hui dans ta niche.

2. Analyse : quels angles performent ? (chiffres, histoire,
   contre-intuition, liste, tutorial)

3. Rédige un post LinkedIn avec cette structure :
   - Hook (ligne 1 — doit forcer le "voir plus")
   - Corps (3 à 4 paragraphes courts, max 3 lignes chacun)
   - CTA (question ouverte ou instruction "commentez X")

4. Longueur : 150 à 220 mots. Ton : direct, factuel, sans jargon.

5. Écris les métriques du post dans data/posts_log.json`;

const defaultSkillQualif = `---
name: qualify_leads
description: Collecte les interactions LinkedIn et qualifie les prospects.
version: 1.0
tools:
  - browser
  - shell
---

## Étape 1 : collect_interactions
1. Lance le script Apify pour récupérer les likes et commentaires
   sur les posts des dernières 24h.
2. Pour chaque profil, extrait : prénom, poste, entreprise, secteur,
   taille de l'entreprise, pays, niveau de connexion.
3. Enrichit les profils via Clearbit (email ou domaine si disponible).
4. Écrit les données brutes dans data/network.json.

## Étape 2 : score_leads
1. Charge data/network.json.
2. Pour chaque profil, calcule un score ICP de 0 à 100 :
   - Titre correspond à ICP : +30 pts
   - Secteur correspond : +20 pts
   - Taille entreprise correspondante : +20 pts
   - A commenté (vs simplement liké) : +15 pts
   - Connexion de 1er degré : +15 pts
3. Filtre les profils avec score ≥ 60.
4. Trie par score décroissant.
5. Écrit le résultat dans data/qualified.json.
6. Envoie une notification Slack avec le nombre de leads qualifiés.`;

const defaultSkillProspection = `---
name: outbound_sequences
description: Envoie des messages personnalisés et gère les relances.
version: 1.0
tools:
  - browser
  - shell
---

## send_initial_message
1. Charge data/qualified.json.
2. Pour chaque prospect (score ≥ 60, statut "new") :
   a. Récupère : prénom, poste, entreprise, action sur le post.
   b. Demande au modèle IA de rédiger un message en 80 mots :
      - Référence à son action (a commenté / liké ton post sur X)
      - 1 phrase de valeur spécifique à son secteur/poste
      - 1 question ouverte liée à son activité
   c. Envoie le message via l'intégration LinkedIn/Slack.
   d. Met le statut du prospect à "contacted" dans qualified.json.

## handle_replies
1. Surveille les réponses via webhook LinkedIn inbox.
2. Classe chaque réponse : intéressé / pas maintenant / hors cible.
3. Intéressé → envoie lien Calendly + crée fiche CRM.
4. Pas maintenant → planifie relance J+7.
5. Hors cible → archive. Stop séquence.

## followup_schedule
J+3 : relance courte si pas de réponse au premier message.
J+7 : envoi d'une ressource gratuite pour relancer l'intérêt.
J+14 : dernier message, puis archivage automatique.`;

const defaultHeartbeatContenu = `publish_daily_post:
  schedule:  "0 8 * * 1-5"   # lundi–vendredi à 8h00
  task:      generate_linkedin_post
  channel:   "slack#linkedin-posts"
  notify:    true

trigger_qualification_after_post:
  trigger:   "on_post_published"
  task:      "hermes trigger qualif-bot collect_interactions"
  delay:     2h`;

const defaultHeartbeatQualif = `collect_every_4h:
  schedule:  "0 */4 * * *"   # toutes les 4 heures
  task:      qualify_leads
  notify:    true

on_post_trigger:
  trigger:   "hermes_event:contenu-bot:post_published"
  task:      qualify_leads
  delay:     2h`;

const defaultHeartbeatProspection = `check_new_leads:
  schedule:  "0 */2 * * *"   # toutes les 2 heures
  task:      send_initial_message
  notify:    true

process_replies:
  trigger:   "on_linkedin_reply"
  task:      handle_replies
  notify:    true

followup_j3:
  trigger:   "on_no_reply:3d"
  task:      send_followup_j3

followup_j7:
  trigger:   "on_no_reply:7d"
  task:      send_followup_j7`;

const defaultSkillEngagement = `---
name: engage_with_icp
description: Commente et like les posts des profils ICP pour créer de la visibilité.
version: 1.0
tools:
  - browser
  - shell
---

# Contexte
Tu es un expert en engagement LinkedIn. Ton objectif est de créer des interactions
authentiques avec les profils correspondant à l'ICP pour augmenter ta visibilité
et générer des opportunités de conversation.

# Instructions
1. Utilise l'outil \`browser\` pour scanner le feed LinkedIn.
2. Filtre les posts publiés par des profils correspondant à l'ICP :
   - Titres : {{ICP titles}}
   - Secteurs : {{ICP sectors}}
3. Pour chaque post pertinent :
   a. Like le post si le contenu est aligné avec ta thématique.
   b. Rédige un commentaire de 2-3 phrases :
      - Apporte un point de vue ou un complément d'info
      - Pas de flagrance promo, reste authentique
      - Termine par une question pour ouvrir la discussion
4. Limite à 8-12 commentaires par jour pour rester naturel.
5. Enregistre les interactions dans data/engagement_log.json`;

const defaultHeartbeatEngagement = `engage_daily:
  schedule:  "0 9,14 * * 1-5"   # lundi–vendredi à 9h et 14h
  task:      engage_with_icp
  notify:    true

scan_morning_feed:
  schedule:  "0 8 * * 1-5"
  task:      scan_feed_and_identify_targets`;

const defaultSkillVeille = `---
name: market_intelligence
description: Surveille le marché, la concurrence et les tendances pour alimentation stratégique.
version: 1.0
tools:
  - browser
  - shell
---

# Contexte
Tu es un analyste stratégique spécialisé dans l'IA et l'acquisition B2B.
Tu produis des briefings quotidiens pour orienter la stratégie de contenu
et de prospection.

# Instructions
1. Utilise l'outil \`browser\` pour scraper :
   - Les posts viraux LinkedIn dans la niche IA/B2B
   - Les actualités de la concurrence (nouvelles features, levées de fonds)
   - Les sujets tendance sur Product Hunt et Hacker News
   - Les discussions pertinentes dans les groupes LinkedIn

2. Analyse les données :
   - Quels sujets génèrent le plus d'engagement ?
   - Quels angles ne sont pas encore exploités ?
   - Quelles opportunités de différenciation ?

3. Produis un briefing structuré :
   - 3 tendances clés du jour
   - 2-3 opportunités de contenu à saisir
   - Mouvements concurrentiels à surveiller

4. Sauvegarde dans data/briefing_YYYY-MM-DD.json`;

const defaultHeartbeatVeille = `daily_briefing:
  schedule:  "0 7 * * 1-5"   # lundi–vendredi à 7h00
  task:      market_intelligence
  notify:    true

weekly_deep_dive:
  schedule:  "0 9 * * 1"     # lundi à 9h00
  task:      weekly_competitive_analysis`;

const defaultSkillNurturing = `---
name: lead_nurturing
description: Maintient le contact avec les leads pas encore prêts via du contenu valeur.
version: 1.0
tools:
  - browser
  - shell
---

# Contexte
Tu es un expert en nurturing B2B. 80% des leads qualifiés ne sont pas prêts
à acheter immédiatement. Ton rôle est de maintenir la relation jusqu'à ce
qu'ils le soient.

# Instructions
1. Charge data/qualified.json et filtre les leads avec statut "contacted"
   mais sans réponse positive depuis 7+ jours.

2. Pour chaque lead en nurturing :
   a. Analyse son secteur, poste et interactions passées
   b. Sélectionne le type de contenu le plus adapté :
      - article : partage d'un article pertinent pour son secteur
      - insight : observation ou data point lié à son métier
      - ressource : guide, template ou outil gratuit
      - check-in : message court de relance informelle
   c. Rédige un message personnalisé (max 100 mots)
   d. N'inclue jamais de lien Calendly ou proposition commerciale

3. Planning de nurturing :
   - J+7 après dernier contact : insight personnalisé
   - J+14 : partage d'article avec commentaire
   - J+21 : ressource gratuite
   - J+30 : check-in informel
   - J+60 : dernière tentative, puis archivage

4. Écris les actions dans data/nurturing_log.json`;

const defaultHeartbeatNurturing = `nurture_leads:
  schedule:  "0 10 * * 1-5"   # lundi–vendredi à 10h00
  task:      lead_nurturing
  notify:    true

review_nurturing_pipeline:
  schedule:  "0 16 * * 5"     # vendredi à 16h00
  task:      archive_cold_leads`;

const defaultSkillAnalyse = `---
name: performance_optimizer
description: Analyse les métriques et propose des optimisations pour chaque agent.
version: 1.0
tools:
  - browser
  - shell
---

# Contexte
Tu es un analyste de performance IA. Tu analyses les résultats de chaque
agent HERMÈS et proposes des améliorations concrètes basées sur les données.

# Instructions
1. Collecte les métriques de la semaine :
   - Posts publiés, impressions, taux d'engagement (Agent Contenu)
   - Profils collectés, leads qualifiés, taux de qualification (Agent Qualification)
   - Messages envoyés, taux de réponse, RDV générés (Agent Prospection)
   - Commentaires postés, réponses reçues (Agent Engagement)
   - Invitations envoyées, taux d'acceptation (Agent Réseau)

2. Compare avec les benchmarks de la semaine précédente.

3. Pour chaque agent, identifie :
   - Le point fort à capitaliser
   - Le point faible à améliorer
   - Une recommandation prioritaire (max 1 par agent)

4. Priorise les recommandations :
   - HIGH : impact direct sur les RDV
   - MEDIUM : amélioration progressive
   - LOW : optimisation secondaire

5. Produis un rapport dans data/performance_report.json`;

const defaultHeartbeatAnalyse = `weekly_analysis:
  schedule:  "0 17 * * 5"     # vendredi à 17h00
  task:      performance_optimizer
  notify:    true

mid_week_check:
  schedule:  "0 12 * * 3"     # mercredi à midi
  task:      quick_performance_check`;

const defaultSkillReseau = `---
name: network_growth
description: Envoie des invitations stratégiques pour développer le réseau ICP.
version: 1.0
tools:
  - browser
  - shell
---

# Contexte
Tu es un expert en croissance de réseau LinkedIn. Ton objectif est d'augmenter
stratégiquement le nombre de connexions de 1er degré avec des profils ICP.

# Instructions
1. Charge la liste des profils ICP depuis data/network.json
   et data/qualified.json.

2. Filtre les profils qui ne sont PAS encore connexions de 1er degré.

3. Pour chaque candidat (max 15/jour) :
   a. Vérifie le profil : photo, headline, activité récente
   b. Rédige une note de connexion personnalisée (max 300 caractères) :
      - Référence à un point commun (groupe, événement, contact)
      - Ou référence à un de ses posts/commentaires
      - Jamais de proposition commerciale dans la note
   c. Envoie l'invitation

4. Surveille les acceptations :
   - Accepté → ajout au fichier qualified.json (connexion 1er degré)
   - Ignoré après 30 jours → retirer de la liste d'attente

5. Limite : 15 invitations/jour, 50/semaine pour rester naturel.

6. Écris dans data/invitations_log.json`;

const defaultHeartbeatReseau = `send_invitations:
  schedule:  "0 9 * * 1-5"   # lundi–vendredi à 9h00
  task:      network_growth
  notify:    true

check_acceptances:
  schedule:  "0 11 * * 1-5"  # lundi–vendredi à 11h00
  task:      check_invitation_status
  notify:    true`;

const defaultTemplates: MessageTemplate[] = [
  {
    id: "initial",
    name: "Message initial — Référence au post",
    timing: "J+0 · Premier contact",
    content: `Bonjour [prénom],

J'ai vu que vous aviez [commenté / aimé] mon post sur [sujet du post]. Je m'intéresse beaucoup aux sujets d'[angle spécifique à leur secteur] chez les [type d'entreprise cible].

Une question rapide : quel est votre principal défi en ce moment sur [thème lié à votre offre] ?`,
    notes: [
      "Garder sous 80 mots. Plus long = moins de réponses.",
      "Ne pas mentionner votre offre dans ce premier message. L'objectif est uniquement d'ouvrir la conversation.",
    ],
  },
  {
    id: "j3",
    name: "Relance J+3 — Rappel court",
    timing: "J+3 · Si pas de réponse",
    content: `Bonjour [prénom], je voulais m'assurer que mon message ne s'était pas perdu.

Est-ce que [thème de votre question initiale] est toujours une priorité pour vous en ce moment ?`,
    notes: [
      "Reformulez la question du premier message, ne la répétez pas à l'identique.",
    ],
  },
  {
    id: "j7",
    name: "Relance J+7 — Ressource gratuite",
    timing: "J+7 · Valeur + CTA",
    content: `Bonjour [prénom],

Je partage cette semaine un guide sur [sujet de la ressource]. Je pense que ça peut vous intéresser vu votre focus sur [enjeu spécifique à leur poste].

Si vous voulez, je peux aussi vous montrer comment on l'applique concrètement chez des [profils similaires au leur]. 20 minutes suffisent — [lien Calendly].`,
    notes: [
      'Remplacez [lien Calendly] par votre lien Calendly dans la config.',
      "L'agent classe automatiquement les réponses 'oui' et crée la fiche CRM.",
    ],
  },
  {
    id: "qualified",
    name: "Message de qualification — Réponse reçue",
    timing: "Quand le prospect répond",
    content: `Super, merci pour votre retour [prénom].

Pour mieux comprendre votre situation : est-ce que vous gérez [aspect clé de votre offre] en interne ou vous cherchez à externaliser / automatiser cette partie ?

Si vous avez 20 min cette semaine, je serais ravi de vous montrer comment on l'a mis en place pour [profil similaire / résultat concret] — [lien Calendly].`,
    notes: [
      "Ce message est déclenché uniquement si l'agent a classé la réponse comme 'intéressé'.",
      "Personnalisez [profil similaire] avec un vrai exemple de client ou résultat documenté.",
    ],
  },
];

const defaultLeads: Lead[] = [
  { id: "1", prenom: "Marie", poste: "CMO", entreprise: "Startup SaaS B2B", secteur: "SaaS B2B", score: 82, action: "commented", postSujet: "automation LinkedIn", statut: "new", dateCollected: "2026-06-08" },
  { id: "2", prenom: "Thomas", poste: "CEO", entreprise: "Conseil & Co", secteur: "Conseil", score: 75, action: "liked", postSujet: "IA pour PME", statut: "contacted", dateCollected: "2026-06-07" },
  { id: "3", prenom: "Sophie", poste: "Directrice Marketing", entreprise: "Agence Digitale Plus", secteur: "Agences digitales", score: 71, action: "commented", postSujet: "prospection automatisée", statut: "replied", dateCollected: "2026-06-07" },
  { id: "4", prenom: "Lucas", poste: "Fondateur", entreprise: "GrowthLab", secteur: "SaaS B2B", score: 68, action: "liked", postSujet: "automation LinkedIn", statut: "new", dateCollected: "2026-06-06" },
  { id: "5", prenom: "Camille", poste: "VP Sales", entreprise: "ScaleUp CRM", secteur: "SaaS B2B", score: 91, action: "commented", postSujet: "séquences prospection", statut: "booked", dateCollected: "2026-06-06" },
  { id: "6", prenom: "Antoine", poste: "Head of Growth", entreprise: "DataViz", secteur: "SaaS B2B", score: 63, action: "liked", postSujet: "IA pour PME", statut: "new", dateCollected: "2026-06-05" },
  { id: "7", prenom: "Julie", poste: "Directrice Commerciale", entreprise: "Formation Pro", secteur: "Formation professionnelle", score: 77, action: "commented", postSujet: "scoring ICP", statut: "contacted", dateCollected: "2026-06-05" },
  { id: "8", prenom: "Pierre", poste: "Co-fondateur", entreprise: "Automate.io", secteur: "SaaS B2B", score: 88, action: "commented", postSujet: "agents IA", statut: "replied", dateCollected: "2026-06-04" },
];

// Helper for simulation
const sampleNames = ["Léa", "Hugo", "Chloé", "Maxime", "Emma", "Alexandre", "Sarah", "Romain", "Camille", "Nicolas"];
const sampleCompanies = ["TechFlow", "DataPulse", "ScaleForce", "InnovateLab", "CloudPeak", "GrowthStudio", "NexaConsulting", "SmartBiz", "AgileCRM", "Vertuo"];
const samplePostes = ["CEO", "CMO", "Head of Growth", "Directrice Marketing", "VP Sales", "Co-fondateur", "Directeur Commercial", "Fondateur", "CTO", "Business Developer"];
const sampleSecteurs = ["SaaS B2B", "Conseil", "Agences digitales", "Formation professionnelle", "MarTech"];
const sampleActions: ("liked" | "commented" | "viewed")[] = ["liked", "commented", "viewed"];
const sampleSujets = ["automation LinkedIn", "IA pour PME", "prospection automatisée", "scoring ICP", "agents IA", "séquences prospection"];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentView: "dashboard",
      setCurrentView: (view) => set({ currentView: view }),

      agents: [
        {
          id: "contenu",
          name: "Contenu",
          num: "AGENT 01",
          status: "setup",
          role: "Génération & publication éditoriale",
          skillMd: defaultSkillContenu,
          heartbeatMd: defaultHeartbeatContenu,
          lastRun: null,
          runsToday: 0,
          nextRun: "08:00 Lun",
        },
        {
          id: "qualif",
          name: "Qualification",
          num: "AGENT 02",
          status: "setup",
          role: "Analyse & segmentation du réseau",
          skillMd: defaultSkillQualif,
          heartbeatMd: defaultHeartbeatQualif,
          lastRun: null,
          runsToday: 0,
          nextRun: "12:00",
        },
        {
          id: "prospection",
          name: "Prospection",
          num: "AGENT 03",
          status: "setup",
          role: "Séquences & gestion des réponses",
          skillMd: defaultSkillProspection,
          heartbeatMd: defaultHeartbeatProspection,
          lastRun: null,
          runsToday: 0,
          nextRun: "14:00",
        },
        {
          id: "engagement",
          name: "Engagement",
          num: "AGENT 04",
          status: "setup",
          role: "Commentaires & visibilité sur les posts ICP",
          skillMd: defaultSkillEngagement,
          heartbeatMd: defaultHeartbeatEngagement,
          lastRun: null,
          runsToday: 0,
          nextRun: "09:00",
        },
        {
          id: "veille",
          name: "Veille",
          num: "AGENT 05",
          status: "setup",
          role: "Intelligence marché & surveillance concurrentielle",
          skillMd: defaultSkillVeille,
          heartbeatMd: defaultHeartbeatVeille,
          lastRun: null,
          runsToday: 0,
          nextRun: "07:00",
        },
        {
          id: "nurturing",
          name: "Nurturing",
          num: "AGENT 06",
          status: "setup",
          role: "Suivi long terme des leads pas encore prêts",
          skillMd: defaultSkillNurturing,
          heartbeatMd: defaultHeartbeatNurturing,
          lastRun: null,
          runsToday: 0,
          nextRun: "10:00",
        },
        {
          id: "analyse",
          name: "Analyse",
          num: "AGENT 07",
          status: "setup",
          role: "Optimisation des performances & A/B testing",
          skillMd: defaultSkillAnalyse,
          heartbeatMd: defaultHeartbeatAnalyse,
          lastRun: null,
          runsToday: 0,
          nextRun: "Ven 17:00",
        },
        {
          id: "reseau",
          name: "Réseau",
          num: "AGENT 08",
          status: "setup",
          role: "Croissance stratégique du réseau LinkedIn",
          skillMd: defaultSkillReseau,
          heartbeatMd: defaultHeartbeatReseau,
          lastRun: null,
          runsToday: 0,
          nextRun: "09:00",
        },
      ],
      updateAgent: (id, updates) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      leads: defaultLeads,
      addLead: (lead) => set((state) => ({ leads: [...state.leads, lead] })),
      updateLead: (id, updates) =>
        set((state) => ({
          leads: state.leads.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        })),
      removeLead: (id) =>
        set((state) => ({ leads: state.leads.filter((l) => l.id !== id) })),

      icpConfig: {
        titles: ["CEO, Co-fondateur, Fondateur", "CMO, Directeur Marketing, Head of Growth", "Directeur Commercial, VP Sales"],
        sectors: ["SaaS B2B, logiciels d'entreprise", "Conseil, coaching, formation professionnelle", "Agences digitales et marketing"],
        companySizes: ["1 à 50 salariés (PME et scale-ups)"],
        minScore: 60,
      },
      updateICPConfig: (updates) =>
        set((state) => ({ icpConfig: { ...state.icpConfig, ...updates } })),

      hermesConfig: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        providerApiKeys: {
          groq: "",
          google: "",
          cerebras: "",
          sambanova: "",
          openrouter: "",
          together: "",
          deepseek: "",
          mistral: "",
          anthropic: "",
          openai: "",
        },
        channels: ["slack", "discord", "telegram"],
        security: {
          allowShell: true,
          allowBrowser: true,
          forbiddenCommands: ["rm -rf", "drop table"],
        },
      },
      updateHermesConfig: (updates) =>
        set((state) => ({
          hermesConfig: { ...state.hermesConfig, ...updates },
        })),

      templates: defaultTemplates,
      updateTemplate: (id, updates) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      metrics: {
        postsPublished: 12,
        impressionsMoy: 2340,
        tauxEngagement: 3.8,
        profilsCollectes: 156,
        leadsQualifies: 34,
        messagesEnvoyes: 28,
        tauxReponse: 28.5,
        rdvsGeneres: 8,
      },

      activityLogs: [],
      addActivityLog: (log) =>
        set((state) => ({
          activityLogs: [
            {
              ...log,
              id: generateId(),
              timestamp: new Date().toISOString(),
            },
            ...state.activityLogs,
          ],
        })),
      clearActivityLogs: () => set({ activityLogs: [] }),

      isSimulating: false,
      setIsSimulating: (v) => set({ isSimulating: v }),
      simulationSpeed: 1,
      setSimulationSpeed: (s) => set({ simulationSpeed: s }),

      updateMetrics: (updates) =>
        set((state) => ({
          metrics: { ...state.metrics, ...updates },
        })),

      // LinkedIn integration
      linkedInConnected: false,
      setLinkedInConnected: (v) => set({ linkedInConnected: v }),
      linkedInProfile: null,
      setLinkedInProfile: (p) => set({ linkedInProfile: p }),
      linkedInConfig: {
        clientId: "",
        clientSecret: "",
        redirectUri: "",
      },
      updateLinkedInConfig: (updates) =>
        set((state) => ({
          linkedInConfig: { ...state.linkedInConfig, ...updates },
        })),
      linkedInPosts: [],
      addLinkedInPost: (post) =>
        set((state) => ({
          linkedInPosts: [post, ...state.linkedInPosts],
        })),

      // AI-generated content
      generatedPosts: [],
      addGeneratedPost: (post) =>
        set((state) => ({
          generatedPosts: [post, ...state.generatedPosts],
        })),
      generatedMessages: [],
      addGeneratedMessage: (msg) =>
        set((state) => ({
          generatedMessages: [msg, ...state.generatedMessages],
        })),
      addGeneratedMessages: (msgs) =>
        set((state) => ({
          generatedMessages: [...msgs, ...state.generatedMessages],
        })),
      generatedComments: [],
      addGeneratedComment: (c) =>
        set((state) => ({
          generatedComments: [c, ...state.generatedComments],
        })),
      addGeneratedComments: (cs) =>
        set((state) => ({
          generatedComments: [...cs, ...state.generatedComments],
        })),
      marketBriefings: [],
      addMarketBriefing: (b) =>
        set((state) => ({
          marketBriefings: [b, ...state.marketBriefings],
        })),
      nurturingActions: [],
      addNurturingAction: (a) =>
        set((state) => ({
          nurturingActions: [a, ...state.nurturingActions],
        })),
      addNurturingActions: (as) =>
        set((state) => ({
          nurturingActions: [...as, ...state.nurturingActions],
        })),
      performanceInsights: [],
      addPerformanceInsight: (i) =>
        set((state) => ({
          performanceInsights: [i, ...state.performanceInsights],
        })),
      addPerformanceInsights: (is) =>
        set((state) => ({
          performanceInsights: [...is, ...state.performanceInsights],
        })),
      connectionRequests: [],
      addConnectionRequest: (r) =>
        set((state) => ({
          connectionRequests: [r, ...state.connectionRequests],
        })),
      addConnectionRequests: (rs) =>
        set((state) => ({
          connectionRequests: [...rs, ...state.connectionRequests],
        })),
      executingAgent: null,
      setExecutingAgent: (agentId) => set({ executingAgent: agentId }),

      runAgentNow: (agentId) => {
        const state = get();
        const agent = state.agents.find((a) => a.id === agentId);
        if (!agent) return;

        const now = getCurrentTimeHHMM();

        // Update agent: lastRun, runsToday, set to active temporarily
        set((s) => ({
          agents: s.agents.map((a) =>
            a.id === agentId
              ? { ...a, lastRun: now, runsToday: a.runsToday + 1, status: "active" as AgentStatus }
              : a
          ),
        }));

        // Add activity log for the run start
        const newLog: Omit<ActivityLog, "id" | "timestamp"> = {
          agentId: agent.id,
          agentName: agent.name,
          type: "info",
          message: `Agent ${agent.name} exécuté`,
          details: `Run #${(agent.runsToday + 1)} aujourd'hui`,
        };

        set((s) => ({
          activityLogs: [
            { ...newLog, id: generateId(), timestamp: new Date().toISOString() },
            ...s.activityLogs,
          ],
        }));

        // Agent-specific logic
        if (agentId === "contenu") {
          const bumpImpressions = randInt(100, 400);
          const engagementDelta = (Math.random() * 0.6 - 0.2);
          const newImpressions = state.metrics.impressionsMoy + bumpImpressions;
          const newEngagement = Math.round((state.metrics.tauxEngagement + engagementDelta) * 10) / 10;

          set((s) => ({
            metrics: {
              ...s.metrics,
              postsPublished: s.metrics.postsPublished + 1,
              impressionsMoy: newImpressions,
              tauxEngagement: Math.max(0.5, newEngagement),
            },
            activityLogs: [
              {
                id: generateId(),
                timestamp: new Date().toISOString(),
                agentId: "contenu",
                agentName: "Contenu",
                type: "success",
                message: `Post publié — +${bumpImpressions} impressions`,
                details: `Taux engagement: ${Math.max(0.5, newEngagement).toFixed(1)}%`,
              },
              ...s.activityLogs,
            ],
          }));
        } else if (agentId === "qualif") {
          const profilsBump = randInt(5, 15);
          const leadsBump = randInt(2, 5);
          const newLead: Lead = {
            id: generateId(),
            prenom: pickRandom(sampleNames),
            poste: pickRandom(samplePostes),
            entreprise: pickRandom(sampleCompanies),
            secteur: pickRandom(sampleSecteurs),
            score: randInt(55, 95),
            action: pickRandom(sampleActions),
            postSujet: pickRandom(sampleSujets),
            statut: "new",
            dateCollected: new Date().toISOString().split("T")[0],
          };

          set((s) => ({
            metrics: {
              ...s.metrics,
              profilsCollectes: s.metrics.profilsCollectes + profilsBump,
              leadsQualifies: s.metrics.leadsQualifies + leadsBump,
            },
            leads: [...s.leads, newLead],
            activityLogs: [
              {
                id: generateId(),
                timestamp: new Date().toISOString(),
                agentId: "qualif",
                agentName: "Qualification",
                type: "success",
                message: `${profilsBump} profils collectés, ${leadsBump} leads qualifiés`,
                details: `Nouveau lead: ${newLead.prenom} (${newLead.entreprise}, score ${newLead.score})`,
              },
              ...s.activityLogs,
            ],
          }));
        } else if (agentId === "prospection") {
          const messagesBump = randInt(3, 8);
          const rdvsBump = randInt(0, 2);
          const reponseDelta = Math.random() * 2 - 0.5;
          const newTauxReponse = Math.round((state.metrics.tauxReponse + reponseDelta) * 10) / 10;

          // Update lead statuses
          const statusTransitions: Array<{ from: Lead["statut"]; to: Lead["statut"] }> = [
            { from: "new", to: "contacted" },
            { from: "contacted", to: "replied" },
            { from: "replied", to: "booked" },
          ];

          const transitionedLeads: string[] = [];

          set((s) => {
            const updatedLeads = [...s.leads];
            // Try to transition up to 2 leads
            for (const transition of statusTransitions) {
              const idx = updatedLeads.findIndex(
                (l) => l.statut === transition.from && !transitionedLeads.includes(l.id)
              );
              if (idx !== -1) {
                updatedLeads[idx] = { ...updatedLeads[idx], statut: transition.to };
                transitionedLeads.push(updatedLeads[idx].id);
                if (transitionedLeads.length >= 2) break;
              }
            }

            const transitionDetails = transitionedLeads.length > 0
              ? `${transitionedLeads.length} lead(s) mis à jour`
              : undefined;

            return {
              leads: updatedLeads,
              metrics: {
                ...s.metrics,
                messagesEnvoyes: s.metrics.messagesEnvoyes + messagesBump,
                tauxReponse: Math.max(5, Math.min(60, newTauxReponse)),
                rdvsGeneres: s.metrics.rdvsGeneres + rdvsBump,
              },
              activityLogs: [
                {
                  id: generateId(),
                  timestamp: new Date().toISOString(),
                  agentId: "prospection",
                  agentName: "Prospection",
                  type: rdvsBump > 0 ? "success" : "info",
                  message: `${messagesBump} messages envoyés, ${rdvsBump} RDV générés`,
                  details: transitionDetails,
                },
                ...s.activityLogs,
              ],
            };
          });
        }
      },
    }),
    {
      name: "hermes-app-store",
      version: 3,
      migrate: (persistedState: Record<string, unknown>, version: number) => {
        // Migrate v1 → v2: apiKeys → providerApiKeys
        if (version < 2) {
          const old = persistedState as Record<string, unknown>;
          const oldHermes = old.hermesConfig as Record<string, unknown> | undefined;
          const oldApiKeys = oldHermes?.apiKeys as Record<string, string> | undefined;

          const newApiKeys: Record<string, string> = {
            groq: "",
            google: "",
            cerebras: "",
            sambanova: "",
            openrouter: "",
            together: "",
            deepseek: "",
            mistral: "",
            anthropic: oldApiKeys?.anthropic || "",
            openai: oldApiKeys?.openai || "",
          };

          let provider = "groq";
          let model = "llama-3.3-70b-versatile";
          const oldModel = oldHermes?.model as string | undefined;
          if (oldModel) {
            if (oldModel.startsWith("claude")) {
              provider = "anthropic";
              model = oldModel;
            } else if (oldModel.startsWith("gpt")) {
              provider = "openai";
              model = oldModel;
            }
          }

          return {
            ...persistedState,
            hermesConfig: {
              ...(oldHermes || {}),
              provider,
              model,
              providerApiKeys: newApiKeys,
            },
          };
        }
        // Migrate v2 → v3: add 5 new agents + new data arrays
        if (version < 3) {
          const old = persistedState as Record<string, unknown>;
          const oldAgents = (old.agents as Array<Record<string, unknown>>) || [];
          // Only add new agents if they don't already exist
          const existingIds = new Set(oldAgents.map((a) => a.id as string));
          const newAgents = [...oldAgents];
          if (!existingIds.has("engagement")) {
            newAgents.push({ id: "engagement", name: "Engagement", num: "AGENT 04", status: "setup", role: "Commentaires & visibilité sur les posts ICP", lastRun: null, runsToday: 0, nextRun: "09:00" });
          }
          if (!existingIds.has("veille")) {
            newAgents.push({ id: "veille", name: "Veille", num: "AGENT 05", status: "setup", role: "Intelligence marché & surveillance concurrentielle", lastRun: null, runsToday: 0, nextRun: "07:00" });
          }
          if (!existingIds.has("nurturing")) {
            newAgents.push({ id: "nurturing", name: "Nurturing", num: "AGENT 06", status: "setup", role: "Suivi long terme des leads pas encore prêts", lastRun: null, runsToday: 0, nextRun: "10:00" });
          }
          if (!existingIds.has("analyse")) {
            newAgents.push({ id: "analyse", name: "Analyse", num: "AGENT 07", status: "setup", role: "Optimisation des performances & A/B testing", lastRun: null, runsToday: 0, nextRun: "Ven 17:00" });
          }
          if (!existingIds.has("reseau")) {
            newAgents.push({ id: "reseau", name: "Réseau", num: "AGENT 08", status: "setup", role: "Croissance stratégique du réseau LinkedIn", lastRun: null, runsToday: 0, nextRun: "09:00" });
          }
          return {
            ...persistedState,
            agents: newAgents,
            generatedComments: [],
            marketBriefings: [],
            nurturingActions: [],
            performanceInsights: [],
            connectionRequests: [],
          };
        }
        return persistedState;
      },
    }
  )
);
