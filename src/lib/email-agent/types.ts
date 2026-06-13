// HERMÈS Email Agent Types
// Re-exports shared types from ../email/types and adds agent-specific definitions

export type { EmailSequenceStep, EmailMessageStatus } from "../email/types";

export interface EmailSequenceConfig {
  id: string;
  name: string;
  description: string;
  triggerEvent: string;
  status: "draft" | "active" | "paused" | "completed";
  steps: import("../email/types").EmailSequenceStep[];
}

export interface AgentEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  timing: string;
  category: "initial" | "followup" | "resource" | "meeting" | "checkin";
}
