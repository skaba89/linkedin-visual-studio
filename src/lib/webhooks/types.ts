// ─── Webhook Integration Types ──────────────────────────────────────

export type WebhookProvider = "slack" | "discord" | "zapier" | "make" | "custom";
export type WebhookEvent =
  | "agent.completed"
  | "agent.error"
  | "lead.qualified"
  | "lead.status_changed"
  | "deal.created"
  | "deal.stage_changed"
  | "deal.won"
  | "deal.lost"
  | "email.sent"
  | "email.opened"
  | "email.replied"
  | "email.bounced"
  | "linkedin.post_published"
  | "linkedin.comment_posted"
  | "linkedin.connection_accepted"
  | "linkedin.invitation_sent"
  | "workflow.started"
  | "workflow.completed"
  | "workflow.failed"
  | "compliance.violation"
  | "compliance.warning"
  | "notification.created";

export type WebhookStatus = "active" | "paused" | "error" | "disabled";

export interface WebhookConfig {
  id: string;
  name: string;
  provider: WebhookProvider;
  url: string;
  secret?: string;           // For signature verification
  events: WebhookEvent[];
  status: WebhookStatus;
  headers?: Record<string, string>;
  retryCount: number;        // Max retries (0-5)
  retryDelayMs: number;      // Delay between retries
  timeoutMs: number;         // Request timeout
  lastTriggeredAt: string | null;
  lastStatus: number | null; // HTTP status of last delivery
  errorCount: number;        // Consecutive errors
  totalDeliveries: number;
  successDeliveries: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  status: "pending" | "delivered" | "failed" | "retrying";
  attempts: number;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
  };
  response: {
    status: number | null;
    body: string | null;
  } | null;
  createdAt: string;
  deliveredAt: string | null;
  nextRetryAt: string | null;
  error: string | null;
}

// ─── Provider Labels & Defaults ─────────────────────────────────────

export const PROVIDER_LABELS: Record<WebhookProvider, string> = {
  slack: "Slack",
  discord: "Discord",
  zapier: "Zapier",
  make: "Make (Integromat)",
  custom: "Personnalisé",
};

export const PROVIDER_COLORS: Record<WebhookProvider, string> = {
  slack: "#4A154B",
  discord: "#5865F2",
  zapier: "#FF4A00",
  make: "#6D00CC",
  custom: "#6B7280",
};

export const PROVIDER_ICONS: Record<WebhookProvider, string> = {
  slack: "Hash",
  discord: "MessageCircle",
  zapier: "Zap",
  make: "Workflow",
  custom: "Globe",
};

export const EVENT_LABELS: Record<WebhookEvent, string> = {
  "agent.completed": "Agent terminé",
  "agent.error": "Agent en erreur",
  "lead.qualified": "Lead qualifié",
  "lead.status_changed": "Statut lead changé",
  "deal.created": "Deal créé",
  "deal.stage_changed": "Stage deal changé",
  "deal.won": "Deal gagné",
  "deal.lost": "Deal perdu",
  "email.sent": "Email envoyé",
  "email.opened": "Email ouvert",
  "email.replied": "Email répondu",
  "email.bounced": "Email rejeté",
  "linkedin.post_published": "Post LinkedIn publié",
  "linkedin.comment_posted": "Commentaire LinkedIn posté",
  "linkedin.connection_accepted": "Connexion LinkedIn acceptée",
  "linkedin.invitation_sent": "Invitation LinkedIn envoyée",
  "workflow.started": "Workflow démarré",
  "workflow.completed": "Workflow terminé",
  "workflow.failed": "Workflow échoué",
  "compliance.violation": "Violation compliance",
  "compliance.warning": "Alerte compliance",
  "notification.created": "Notification créée",
};

export const EVENT_CATEGORIES: Record<string, WebhookEvent[]> = {
  "Agents": ["agent.completed", "agent.error"],
  "Leads": ["lead.qualified", "lead.status_changed"],
  "Deals": ["deal.created", "deal.stage_changed", "deal.won", "deal.lost"],
  "Emails": ["email.sent", "email.opened", "email.replied", "email.bounced"],
  "LinkedIn": ["linkedin.post_published", "linkedin.comment_posted", "linkedin.connection_accepted", "linkedin.invitation_sent"],
  "Workflows": ["workflow.started", "workflow.completed", "workflow.failed"],
  "Compliance": ["compliance.violation", "compliance.warning"],
};

// ─── Slack Message Builder ─────────────────────────────────────────

export function buildSlackPayload(event: WebhookEvent, data: Record<string, unknown>): Record<string, unknown> {
  const emoji = event.startsWith("deal.won") ? "🎉" :
    event.startsWith("deal.lost") ? "😞" :
    event.startsWith("error") || event.startsWith("compliance.violation") ? "🚨" :
    event.startsWith("agent") ? "🤖" :
    event.startsWith("lead") ? "👤" :
    event.startsWith("email") ? "📧" :
    event.startsWith("linkedin") ? "💼" :
    event.startsWith("workflow") ? "⚡" : "🔔";

  return {
    text: `${emoji} *${EVENT_LABELS[event]}*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *${EVENT_LABELS[event]}*\n\`\`\`${JSON.stringify(data, null, 2).slice(0, 500)}\`\`\``,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `HERMÈS | ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };
}

// ─── Discord Message Builder ────────────────────────────────────────

export function buildDiscordPayload(event: WebhookEvent, data: Record<string, unknown>): Record<string, unknown> {
  const color = event.includes("error") || event.includes("violation") ? 0xE5263A :
    event.includes("won") ? 0x00C48C :
    event.includes("lost") ? 0xF4A100 :
    0x00D4FF;

  return {
    embeds: [
      {
        title: EVENT_LABELS[event],
        color,
        description: ` \`\`\`json\n${JSON.stringify(data, null, 2).slice(0, 400)}\n\`\`\` `,
        footer: {
          text: "HERMÈS Notification",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
