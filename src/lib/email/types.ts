// ============================================================
// Email Types & Constants — Phase 3: Multi-canal
// ============================================================

export interface EmailSequenceData {
  id: string;
  userId: string;
  name: string;
  description: string;
  triggerEvent: EmailTriggerEvent;
  status: EmailSequenceStatus;
  steps: EmailSequenceStep[];
  createdAt: string;
  updatedAt: string;
}

export type EmailTriggerEvent =
  | "manual"
  | "lead_qualified"
  | "lead_contacted"
  | "lead_replied"
  | "deal_stage_change"
  | "nurturing_trigger"
  | "website_visit";

export type EmailSequenceStatus = "draft" | "active" | "paused" | "completed";

export interface EmailSequenceStep {
  id: string;
  order: number;
  subject: string;
  body: string;
  delayDays: number; // delay after previous step
  trackOpens: boolean;
  trackClicks: boolean;
}

export interface EmailMessageData {
  id: string;
  userId: string;
  contactId: string;
  sequenceId?: string | null;
  subject: string;
  body: string;
  status: EmailMessageStatus;
  sentAt?: string | null;
  openedAt?: string | null;
  clickedAt?: string | null;
  repliedAt?: string | null;
  createdAt: string;
}

export type EmailMessageStatus =
  | "draft"
  | "queued"
  | "sent"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "failed";

export interface EmailStats {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalBounced: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

export interface SequenceEnrollment {
  contactId: string;
  sequenceId: string;
  currentStep: number;
  enrolledAt: string;
  nextStepAt: string;
  status: "active" | "completed" | "opted_out";
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: "initial" | "followup" | "nurturing" | "qualification" | "proposal";
}

// Default email templates
export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "initial-outreach",
    name: "Premier contact email",
    subject: "Question rapide - {{entreprise}}",
    body: `Bonjour {{prenom}},

J'ai remarque votre travail chez {{entreprise}} dans le secteur {{secteur}}. Je me specialise dans l'automatisation de la prospection B2B et j'aimerais echanger avec vous sur vos enjeux actuels.

Est-ce que ce sujet est d'actualite pour vous en ce moment ?

Cordialement`,
    category: "initial",
  },
  {
    id: "followup-j3",
    name: "Relance J+3",
    subject: "Re: Question rapide - {{entreprise}}",
    body: `Bonjour {{prenom}},

Je voulais m'assurer que mon message ne s'etait pas perdu. Est-ce que l'automatisation de votre prospection est toujours une priorite ?

Cordialement`,
    category: "followup",
  },
  {
    id: "followup-j7",
    name: "Relance J+7 - Ressource",
    subject: "Ressource pour {{entreprise}}",
    body: `Bonjour {{prenom}},

Je partage cette semaine un guide sur l'automatisation de la prospection B2B. Je pense que cela peut vous interesser vu votre position chez {{entreprise}}.

Si vous voulez, je peux vous montrer comment on l'applique concretement - 20 minutes suffisent.

Cordialement`,
    category: "followup",
  },
  {
    id: "nurturing-insight",
    name: "Nurturing - Insight secteur",
    subject: "Tendance {{secteur}} - votre avis ?",
    body: `Bonjour {{prenom}},

J'ai recemment publie une analyse sur les tendances du secteur {{secteur}} et j'aimerais avoir votre perspective en tant que {{poste}}.

Voici le lien vers l'article : [lien]

N'hesitez pas a me faire part de vos reflections.

Cordialement`,
    category: "nurturing",
  },
  {
    id: "qualification-deep",
    name: "Qualification approfondie",
    subject: "Approfondissement - {{entreprise}}",
    body: `Bonjour {{prenom}},

Merci pour votre retour. Pour mieux comprendre votre situation : est-ce que vous gerez la prospection en interne ou vous cherchez a externaliser / automatiser cette partie ?

Si vous avez 20 min cette semaine, je serais ravi de vous montrer comment on l'a mis en place pour des profils similaires au votre.

Cordialement`,
    category: "qualification",
  },
  {
    id: "proposal-meeting",
    name: "Proposition de meeting",
    subject: "Demonstration - Automatisation prospection",
    body: `Bonjour {{prenom}},

Suite a nos echanges, je vous propose une demonstration personnalisee de notre solution d'automatisation.

Pendant 30 minutes, je vous montrerai :
- Comment generer des leads qualifies automatiquement
- Les sequences de prospection multi-canal
- Les resultats obtenus par des entreprises similaires

Quel creneau vous conviendrait cette semaine ?

Cordialement`,
    category: "proposal",
  },
];

// Helper: render template with contact data
export function renderEmailTemplate(
  template: EmailTemplate | EmailSequenceStep,
  data: {
    prenom?: string;
    nom?: string;
    entreprise?: string;
    poste?: string;
    secteur?: string;
  }
): { subject: string; body: string } {
  const replaceVars = (text: string) =>
    text
      .replace(/\{\{prenom\}\}/g, data.prenom ?? "")
      .replace(/\{\{nom\}\}/g, data.nom ?? "")
      .replace(/\{\{entreprise\}\}/g, data.entreprise ?? "")
      .replace(/\{\{poste\}\}/g, data.poste ?? "")
      .replace(/\{\{secteur\}\}/g, data.secteur ?? "");

  return {
    subject: replaceVars(template.subject),
    body: replaceVars(template.body),
  };
}

// Status color mapping
export const EMAIL_STATUS_COLORS: Record<EmailMessageStatus, string> = {
  draft: "#7B8A9A",
  queued: "#60A5FA",
  sent: "#00D4FF",
  opened: "#A78BFA",
  clicked: "#F4A100",
  replied: "#00C48C",
  bounced: "#E5263A",
  failed: "#E5263A",
};

export const EMAIL_STATUS_LABELS: Record<EmailMessageStatus, string> = {
  draft: "Brouillon",
  queued: "En attente",
  sent: "Envoye",
  opened: "Ouvert",
  clicked: "Clique",
  replied: "Repondu",
  bounced: "Rebond",
  failed: "Echoue",
};

export const SEQUENCE_STATUS_LABELS: Record<EmailSequenceStatus, string> = {
  draft: "Brouillon",
  active: "Active",
  paused: "En pause",
  completed: "Terminee",
};

export const TRIGGER_EVENT_LABELS: Record<EmailTriggerEvent, string> = {
  manual: "Manuel",
  lead_qualified: "Lead qualifie",
  lead_contacted: "Lead contacte",
  lead_replied: "Reponse lead",
  deal_stage_change: "Changement stage deal",
  nurturing_trigger: "Declencheur nurturing",
  website_visit: "Visite site web",
};
