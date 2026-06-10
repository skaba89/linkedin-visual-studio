// HERMÈS Email Agent Types

export interface EmailSequenceStep {
  order: number;
  subject: string;
  body: string;
  delayDays: number;
  trackOpens: boolean;
  trackClicks: boolean;
}

export interface EmailSequenceConfig {
  id: string;
  name: string;
  description: string;
  triggerEvent: string;
  status: "draft" | "active" | "paused" | "completed";
  steps: EmailSequenceStep[];
}

export type EmailMessageStatus = "draft" | "queued" | "sent" | "delivered" | "opened" | "clicked" | "replied" | "bounced" | "failed";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  timing: string;
  category: "initial" | "followup" | "resource" | "meeting" | "checkin";
}
