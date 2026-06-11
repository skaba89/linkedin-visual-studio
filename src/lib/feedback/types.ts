// HERMÈS Feedback Types

export type FeedbackMetricType =
  | "engagement_rate"
  | "reply_rate"
  | "conversion_rate"
  | "click_through_rate"
  | "qualification_rate"
  | "meeting_rate"
  | "connection_rate";

export type FeedbackAction =
  | "adjust_frequency"
  | "modify_template"
  | "change_timing"
  | "pause_agent"
  | "escalate"
  | "none";

export type ContentType =
  | "post"
  | "message"
  | "comment"
  | "email"
  | "connection_request";

export interface FeedbackEventData {
  sourceAgentId: string;
  contentType: ContentType;
  contentId: string;
  metricType: FeedbackMetricType;
  metricValue: number;
  baselineValue: number;
}

export interface FeedbackInsight {
  agentId: string;
  agentName: string;
  metric: FeedbackMetricType;
  currentValue: number;
  baselineValue: number;
  improvement: number;
  recommendation: string;
  action: FeedbackAction;
  priority: "high" | "medium" | "low";
}

export interface FeedbackRule {
  id: string;
  name: string;
  metricType: FeedbackMetricType;
  condition: "above" | "below" | "equals";
  threshold: number;
  action: FeedbackAction;
  message: string;
  enabled: boolean;
}

export interface AgentPerformanceSummary {
  agentId: string;
  agentName: string;
  totalEvents: number;
  avgImprovement: number;
  metrics: Record<FeedbackMetricType, { value: number; baseline: number; improvement: number }>;
  recommendations: string[];
}

export interface FeedbackDashboardData {
  overallHealth: number; // 0-100
  agentPerformances: AgentPerformanceSummary[];
  topInsights: FeedbackInsight[];
  recentActions: { agentId: string; action: FeedbackAction; reason: string; timestamp: Date }[];
}
