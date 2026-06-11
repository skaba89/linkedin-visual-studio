// Orchestrator Types for HERMÈS

export type AgentEventType =
  // Agent Contenu events
  | "contenu:post_published"
  | "contenu:post_failed"
  | "contenu:trending_detected"
  // Agent Qualification events
  | "qualif:leads_collected"
  | "qualif:leads_scored"
  | "qualif:lead_qualified"
  // Agent Prospection events
  | "prospection:message_sent"
  | "prospection:reply_received"
  | "prospection:followup_needed"
  | "prospection:meeting_booked"
  // Agent Engagement events
  | "engagement:comment_posted"
  | "engagement:like_given"
  | "engagement:reply_received"
  // Agent Veille events
  | "veille:briefing_generated"
  | "veille:opportunity_detected"
  | "veille:competitor_activity"
  // Agent Nurturing events
  | "nurturing:action_sent"
  | "nurturing:lead_re_engaged"
  | "nurturing:lead_archived"
  // Agent Analyse events
  | "analyse:report_generated"
  | "analyse:anomaly_detected"
  | "analyse:optimization_suggested"
  // Agent Réseau events
  | "reseau:invitation_sent"
  | "reseau:invitation_accepted"
  | "reseau:invitation_ignored"
  // System events
  | "system:startup"
  | "system:shutdown"
  | "system:error"
  | "system:warmup_complete";

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  agentId: string;
  agentName: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export interface ScheduleTrigger {
  type: "schedule";
  cron: string;
  timezone?: string;
}

export interface EventTrigger {
  type: "event";
  eventType: AgentEventType;
  sourceAgentId: string;
}

export interface DelayTrigger {
  type: "delay";
  afterEvent: AgentEventType;
  delayMs: number;
}

export type Trigger = ScheduleTrigger | EventTrigger | DelayTrigger;

export interface HeartbeatRule {
  id: string;
  agentId: string;
  name: string;
  trigger: Trigger;
  enabled: boolean;
  lastFiredAt?: Date;
  nextFireAt?: Date;
}

export type OrchestratorState = "stopped" | "running" | "paused" | "error";

export interface OrchestratorMetrics {
  totalEventsProcessed: number;
  totalRulesFired: number;
  averageProcessingTimeMs: number;
  eventsByAgent: Record<string, number>;
  eventsByType: Record<string, number>;
  lastEventAt?: Date;
  uptimeMs: number;
}

export interface AgentDependency {
  from: string;
  to: string;
  event: AgentEventType;
  delayMs?: number;
}

export const DEFAULT_DEPENDENCIES: AgentDependency[] = [
  { from: "contenu", to: "qualif", event: "contenu:post_published", delayMs: 7200000 }, // 2h
  { from: "contenu", to: "engagement", event: "contenu:post_published" },
  { from: "qualif", to: "prospection", event: "qualif:lead_qualified" },
  { from: "prospection", to: "nurturing", event: "prospection:followup_needed" },
  { from: "prospection", to: "reseau", event: "prospection:reply_received" },
  { from: "veille", to: "contenu", event: "veille:opportunity_detected" },
  { from: "analyse", to: "contenu", event: "analyse:optimization_suggested" },
];

export const AGENT_IDS = [
  "contenu",
  "qualif",
  "prospection",
  "engagement",
  "veille",
  "nurturing",
  "analyse",
  "reseau",
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export const AGENT_NAMES: Record<AgentId, string> = {
  contenu: "Contenu",
  qualif: "Qualification",
  prospection: "Prospection",
  engagement: "Engagement",
  veille: "Veille",
  nurturing: "Nurturing",
  analyse: "Analyse",
  reseau: "Réseau",
};
