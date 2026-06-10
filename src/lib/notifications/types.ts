// ─── Notification Center Types ──────────────────────────────────────

export type NotificationCategory =
  | "agent"
  | "lead"
  | "deal"
  | "email"
  | "linkedin"
  | "compliance"
  | "workflow"
  | "system";

export type NotificationPriority = "low" | "medium" | "high" | "critical";

export type NotificationChannel = "in_app" | "email" | "slack" | "discord" | "webhook";

export interface Notification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  read: boolean;
  dismissed: boolean;
  actionUrl?: string;         // Navigate to a view on click
  actionLabel?: string;       // Label for the action button
  sourceAgent?: string;       // Agent that triggered this
  sourceWorkflow?: string;    // Workflow that triggered this
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string;
  expiresAt?: string;         // Auto-dismiss after this date
}

export interface NotificationPreference {
  category: NotificationCategory;
  channels: NotificationChannel[];
  minPriority: NotificationPriority;  // Only notify if >= this priority
  enabled: boolean;
  quietHoursStart?: string;   // "22:00"
  quietHoursEnd?: string;     // "08:00"
  quietHoursEnabled: boolean;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
  todayCount: number;
}

// ─── Default Notification Preferences ───────────────────────────────

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreference[] = [
  { category: "agent", channels: ["in_app"], minPriority: "medium", enabled: true, quietHoursEnabled: false },
  { category: "lead", channels: ["in_app", "email"], minPriority: "medium", enabled: true, quietHoursEnabled: true, quietHoursStart: "22:00", quietHoursEnd: "08:00" },
  { category: "deal", channels: ["in_app", "email", "slack"], minPriority: "high", enabled: true, quietHoursEnabled: true, quietHoursStart: "22:00", quietHoursEnd: "08:00" },
  { category: "email", channels: ["in_app"], minPriority: "medium", enabled: true, quietHoursEnabled: false },
  { category: "linkedin", channels: ["in_app"], minPriority: "low", enabled: true, quietHoursEnabled: false },
  { category: "compliance", channels: ["in_app", "email", "slack"], minPriority: "high", enabled: true, quietHoursEnabled: false },
  { category: "workflow", channels: ["in_app"], minPriority: "medium", enabled: true, quietHoursEnabled: false },
  { category: "system", channels: ["in_app"], minPriority: "medium", enabled: true, quietHoursEnabled: false },
];

// ─── Category Labels ────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  agent: "Agents",
  lead: "Leads",
  deal: "Deals",
  email: "Emails",
  linkedin: "LinkedIn",
  compliance: "Compliance",
  workflow: "Workflows",
  system: "Système",
};

export const CATEGORY_COLORS: Record<NotificationCategory, string> = {
  agent: "#00D4FF",
  lead: "#00C48C",
  deal: "#F4A100",
  email: "#8B5CF6",
  linkedin: "#0A66C2",
  compliance: "#E5263A",
  workflow: "#EC4899",
  system: "#6B7280",
};

export const CATEGORY_ICONS: Record<NotificationCategory, string> = {
  agent: "Bot",
  lead: "Users",
  deal: "Building2",
  email: "Mail",
  linkedin: "Linkedin",
  compliance: "Shield",
  workflow: "GitBranch",
  system: "Settings",
};

export const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
  critical: "Critique",
};

export const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  low: "#6B7280",
  medium: "#00D4FF",
  high: "#F4A100",
  critical: "#E5263A",
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: "Application",
  email: "Email",
  slack: "Slack",
  discord: "Discord",
  webhook: "Webhook",
};
