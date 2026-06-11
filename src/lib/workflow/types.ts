// ─── Workflow Engine Types ───────────────────────────────────────────

export type WorkflowNodeType =
  | "trigger"
  | "condition"
  | "action"
  | "delay"
  | "loop"
  | "webhook"
  | "transform";

export type TriggerType =
  | "agent_completed"
  | "lead_qualified"
  | "lead_status_changed"
  | "deal_stage_changed"
  | "email_opened"
  | "email_replied"
  | "post_published"
  | "comment_received"
  | "connection_accepted"
  | "schedule"
  | "webhook_received"
  | "compliance_violation"
  | "manual";

export type ActionType =
  | "send_email"
  | "send_linkedin_message"
  | "create_lead"
  | "update_lead_status"
  | "create_deal"
  | "update_deal_stage"
  | "create_contact"
  | "send_webhook"
  | "run_agent"
  | "add_tag"
  | "add_note"
  | "notify_slack"
  | "notify_discord"
  | "log_activity"
  | "wait"
  | "branch";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "in"
  | "not_in"
  | "exists"
  | "not_exists";

export type WorkflowStatus = "draft" | "active" | "paused" | "error" | "archived";

export interface WorkflowCondition {
  field: string;          // e.g. "lead.score", "deal.value", "agent.id"
  operator: ConditionOperator;
  value: string | number | string[];
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  // Type-specific config
  triggerType?: TriggerType;
  actionType?: ActionType;
  conditions?: WorkflowCondition[];
  delayMs?: number;       // for delay nodes
  loopCount?: number;     // for loop nodes
  webhookUrl?: string;    // for webhook nodes
  transformExpr?: string; // for transform nodes (simple JS expression)
}

export interface WorkflowEdge {
  id: string;
  from: string;           // node id
  to: string;             // node id
  label?: string;         // e.g. "Oui" / "Non" for conditions
  condition?: WorkflowCondition; // optional edge condition
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  triggerNode: string;
  currentNode: string | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  data: Record<string, unknown>;  // context data passed through nodes
  steps: WorkflowExecutionStep[];
}

export interface WorkflowExecutionStep {
  nodeId: string;
  nodeLabel: string;
  status: "pending" | "running" | "completed" | "skipped" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  output: Record<string, unknown> | null;
  error: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  executions: WorkflowExecution[];
  lastExecutionAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  version: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "acquisition" | "nurturing" | "notification" | "compliance" | "custom";
  nodes: Omit<WorkflowNode, "id">[];
  edges: Omit<WorkflowEdge, "id">[];
  icon: string;
}

// ─── Default Workflow Templates ─────────────────────────────────────

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "lead-qualify-notify",
    name: "Lead qualifié → Notification Slack",
    description: "Envoie une notification Slack quand un lead dépasse le score ICP minimum.",
    category: "acquisition",
    icon: "🔔",
    nodes: [
      { type: "trigger", label: "Lead qualifié", config: {}, position: { x: 50, y: 200 }, triggerType: "lead_qualified" },
      { type: "condition", label: "Score ≥ 70 ?", config: {}, position: { x: 300, y: 200 }, conditions: [{ field: "lead.score", operator: "greater_than", value: 70 }] },
      { type: "action", label: "Notifier Slack", config: {}, position: { x: 550, y: 120 }, actionType: "notify_slack" },
      { type: "action", label: "Créer deal", config: {}, position: { x: 550, y: 280 }, actionType: "create_deal" },
    ],
    edges: [
      { from: "0", to: "1" },
      { from: "1", to: "2", label: "Oui" },
      { from: "1", to: "3", label: "Non" },
    ],
  },
  {
    id: "new-lead-welcome",
    name: "Nouveau lead → Email de bienvenue",
    description: "Envoie automatiquement un email de bienvenue quand un nouveau lead est créé.",
    category: "nurturing",
    icon: "📧",
    nodes: [
      { type: "trigger", label: "Nouveau lead", config: {}, position: { x: 50, y: 200 }, triggerType: "lead_qualified" },
      { type: "delay", label: "Attendre 1h", config: {}, position: { x: 300, y: 200 }, delayMs: 3600000 },
      { type: "action", label: "Email bienvenue", config: {}, position: { x: 550, y: 200 }, actionType: "send_email" },
      { type: "action", label: "Ajouter tag", config: {}, position: { x: 800, y: 200 }, actionType: "add_tag" },
    ],
    edges: [
      { from: "0", to: "1" },
      { from: "1", to: "2" },
      { from: "2", to: "3" },
    ],
  },
  {
    id: "deal-won-celebrate",
    name: "Deal gagné → Célébration + Notification",
    description: "Notifie l'équipe quand un deal passe en 'Gagné' et log l'activité.",
    category: "notification",
    icon: "🎉",
    nodes: [
      { type: "trigger", label: "Deal gagné", config: {}, position: { x: 50, y: 200 }, triggerType: "deal_stage_changed" },
      { type: "condition", label: "Stage = won ?", config: {}, position: { x: 300, y: 200 }, conditions: [{ field: "deal.stage", operator: "equals", value: "closed_won" }] },
      { type: "action", label: "Notifier Discord", config: {}, position: { x: 550, y: 120 }, actionType: "notify_discord" },
      { type: "action", label: "Log activité", config: {}, position: { x: 550, y: 280 }, actionType: "log_activity" },
    ],
    edges: [
      { from: "0", to: "1" },
      { from: "1", to: "2", label: "Oui" },
      { from: "1", to: "3", label: "Non" },
    ],
  },
  {
    id: "compliance-guard",
    name: "Garde-fou compliance LinkedIn",
    description: "Bloque les actions LinkedIn quand la limite journalière est atteinte et notifie.",
    category: "compliance",
    icon: "🛡️",
    nodes: [
      { type: "trigger", label: "Violation compliance", config: {}, position: { x: 50, y: 200 }, triggerType: "compliance_violation" },
      { type: "action", label: "Notifier Slack", config: {}, position: { x: 300, y: 120 }, actionType: "notify_slack" },
      { type: "action", label: "Log activité", config: {}, position: { x: 300, y: 280 }, actionType: "log_activity" },
    ],
    edges: [
      { from: "0", to: "1" },
      { from: "0", to: "2" },
    ],
  },
  {
    id: "cold-lead-nurture",
    name: "Lead froid → Séquence nurturing auto",
    description: "Déclenche une séquence de nurturing quand un lead n'a pas répondu depuis 7 jours.",
    category: "nurturing",
    icon: "🔄",
    nodes: [
      { type: "trigger", label: "Lead status changé", config: {}, position: { x: 50, y: 200 }, triggerType: "lead_status_changed" },
      { type: "condition", label: "Status = contacted ?", config: {}, position: { x: 300, y: 200 }, conditions: [{ field: "lead.status", operator: "equals", value: "contacted" }] },
      { type: "delay", label: "Attendre 7j", config: {}, position: { x: 550, y: 200 }, delayMs: 604800000 },
      { type: "condition", label: "Toujours pas répondu ?", config: {}, position: { x: 800, y: 200 }, conditions: [{ field: "lead.status", operator: "equals", value: "contacted" }] },
      { type: "action", label: "Run Agent Nurturing", config: {}, position: { x: 1050, y: 200 }, actionType: "run_agent" },
    ],
    edges: [
      { from: "0", to: "1" },
      { from: "1", to: "2", label: "Oui" },
      { from: "2", to: "3" },
      { from: "3", to: "4", label: "Oui" },
    ],
  },
];

// ─── Trigger Labels ─────────────────────────────────────────────────

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  agent_completed: "Agent terminé",
  lead_qualified: "Lead qualifié",
  lead_status_changed: "Statut lead changé",
  deal_stage_changed: "Stage deal changé",
  email_opened: "Email ouvert",
  email_replied: "Email répondu",
  post_published: "Post publié",
  comment_received: "Commentaire reçu",
  connection_accepted: "Connexion acceptée",
  schedule: "Planifié (cron)",
  webhook_received: "Webhook reçu",
  compliance_violation: "Violation compliance",
  manual: "Déclenchement manuel",
};

export const ACTION_LABELS: Record<ActionType, string> = {
  send_email: "Envoyer email",
  send_linkedin_message: "Envoyer message LinkedIn",
  create_lead: "Créer lead",
  update_lead_status: "Mettre à jour statut lead",
  create_deal: "Créer deal",
  update_deal_stage: "Mettre à jour stage deal",
  create_contact: "Créer contact CRM",
  send_webhook: "Envoyer webhook",
  run_agent: "Lancer agent",
  add_tag: "Ajouter tag",
  add_note: "Ajouter note",
  notify_slack: "Notifier Slack",
  notify_discord: "Notifier Discord",
  log_activity: "Log activité",
  wait: "Attendre",
  branch: "Branche conditionnelle",
};

export const NODE_COLORS: Record<WorkflowNodeType, string> = {
  trigger: "#00D4FF",
  condition: "#F4A100",
  action: "#00C48C",
  delay: "#8B5CF6",
  loop: "#EC4899",
  webhook: "#FF6B6B",
  transform: "#6366F1",
};
