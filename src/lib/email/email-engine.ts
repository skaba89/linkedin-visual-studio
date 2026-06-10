// ============================================================
// Email Engine — Phase 3: Multi-canal
// Sequence management, stats computation, template rendering
// ============================================================

import {
  type EmailMessageData,
  type EmailMessageStatus,
  type EmailStats,
  type EmailSequenceData,
  type EmailSequenceStep,
  type EmailTemplate,
  type SequenceEnrollment,
  DEFAULT_EMAIL_TEMPLATES,
  renderEmailTemplate,
} from "./types";

// ---- Stats Computation ----

export function computeEmailStats(messages: EmailMessageData[]): EmailStats {
  const totalSent = messages.filter((m) => m.status !== "draft" && m.status !== "queued").length;
  const totalOpened = messages.filter((m) => m.openedAt).length;
  const totalClicked = messages.filter((m) => m.clickedAt).length;
  const totalReplied = messages.filter((m) => m.repliedAt).length;
  const totalBounced = messages.filter((m) => m.status === "bounced").length;

  return {
    totalSent,
    totalOpened,
    totalClicked,
    totalReplied,
    totalBounced,
    openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
    clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
    replyRate: totalSent > 0 ? (totalReplied / totalSent) * 100 : 0,
    bounceRate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
  };
}

// ---- Sequence Step Resolution ----

export function getNextStep(
  sequence: EmailSequenceData,
  currentStep: number
): EmailSequenceStep | null {
  const steps = Array.isArray(sequence.steps) ? sequence.steps : [];
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const nextIndex = sorted.findIndex((s) => s.order > currentStep);
  if (nextIndex === -1) return null;
  return sorted[nextIndex];
}

export function computeNextStepDate(
  step: EmailSequenceStep,
  previousStepDate: Date
): Date {
  const next = new Date(previousStepDate);
  next.setDate(next.getDate() + step.delayDays);
  // Set to business hours (9 AM CET)
  next.setHours(9, 0, 0, 0);
  // Skip weekends
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

// ---- Sequence Enrollment ----

export function createEnrollment(
  contactId: string,
  sequenceId: string,
  firstStep: EmailSequenceStep
): SequenceEnrollment {
  const now = new Date();
  const nextStepAt = computeNextStepDate(firstStep, now);

  return {
    contactId,
    sequenceId,
    currentStep: firstStep.order,
    enrolledAt: now.toISOString(),
    nextStepAt: nextStepAt.toISOString(),
    status: "active",
  };
}

// ---- Template Helpers ----

export function getDefaultTemplates(): EmailTemplate[] {
  return [...DEFAULT_EMAIL_TEMPLATES];
}

export function getTemplateByCategory(
  category: EmailTemplate["category"]
): EmailTemplate[] {
  return DEFAULT_EMAIL_TEMPLATES.filter((t) => t.category === category);
}

export function renderAndPrepareEmail(
  template: EmailTemplate | EmailSequenceStep,
  contactData: {
    prenom?: string;
    nom?: string;
    entreprise?: string;
    poste?: string;
    secteur?: string;
  },
  contactId: string,
  sequenceId?: string
): { contactId: string; sequenceId?: string; subject: string; body: string; status: EmailMessageStatus } {
  const rendered = renderEmailTemplate(template, contactData);
  return {
    contactId,
    sequenceId,
    subject: rendered.subject,
    body: rendered.body,
    status: "draft",
  };
}

// ---- Sequence Validation ----

export function validateSequenceSteps(steps: EmailSequenceStep[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (steps.length === 0) {
    errors.push("La sequence doit contenir au moins une etape");
  }

  // Check for duplicate orders
  const orders = steps.map((s) => s.order);
  const uniqueOrders = new Set(orders);
  if (uniqueOrders.size !== orders.length) {
    errors.push("Les etapes ont des ordres dupliques");
  }

  // Check each step has subject and body
  for (const step of steps) {
    if (!step.subject.trim()) {
      errors.push(`Etape ${step.order}: sujet manquant`);
    }
    if (!step.body.trim()) {
      errors.push(`Etape ${step.order}: corps manquant`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---- Message Grouping (for inbox view) ----

export interface EmailThread {
  contactId: string;
  contactName: string;
  messages: EmailMessageData[];
  lastMessageDate: string;
  unread: boolean;
}

export function groupMessagesByContact(
  messages: EmailMessageData[],
  contacts: Array<{ id: string; prenom: string; nom: string }>
): EmailThread[] {
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const grouped = new Map<string, EmailMessageData[]>();
  for (const msg of messages) {
    const existing = grouped.get(msg.contactId) ?? [];
    existing.push(msg);
    grouped.set(msg.contactId, existing);
  }

  const threads: EmailThread[] = [];
  for (const [contactId, msgs] of grouped) {
    const contact = contactMap.get(contactId);
    const sorted = [...msgs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const lastDate = sorted[0]?.createdAt ?? new Date().toISOString();
    const hasReplied = sorted.some((m) => m.status === "replied");
    const hasDraft = sorted.some((m) => m.status === "draft");

    threads.push({
      contactId,
      contactName: contact ? `${contact.prenom} ${contact.nom}`.trim() : contactId,
      messages: sorted,
      lastMessageDate: lastDate,
      unread: hasReplied || hasDraft,
    });
  }

  threads.sort(
    (a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()
  );

  return threads;
}

// ---- Email Sequence Builder ----

export function buildSequenceFromTemplate(
  name: string,
  description: string,
  triggerEvent: string,
  templates: EmailTemplate[]
): Omit<EmailSequenceData, "id" | "userId" | "createdAt" | "updatedAt"> {
  const steps: EmailSequenceStep[] = templates.map((t, i) => ({
    id: `step-${i + 1}`,
    order: i + 1,
    subject: t.subject,
    body: t.body,
    delayDays: i === 0 ? 0 : i === 1 ? 3 : 7,
    trackOpens: true,
    trackClicks: true,
  }));

  return {
    name,
    description,
    triggerEvent: triggerEvent as EmailSequenceData["triggerEvent"],
    status: "draft",
    steps,
  };
}

// Predefined sequences
export function getDefaultSequences(): Array<Omit<EmailSequenceData, "id" | "userId" | "createdAt" | "updatedAt">> {
  return [
    buildSequenceFromTemplate(
      "Prospection initiale",
      "Sequence de prospection email en 3 etapes pour premiers contacts",
      "lead_qualified",
      [DEFAULT_EMAIL_TEMPLATES[0], DEFAULT_EMAIL_TEMPLATES[1], DEFAULT_EMAIL_TEMPLATES[2]]
    ),
    buildSequenceFromTemplate(
      "Nurturing mensuel",
      "Sequence de nurturing pour leads pas encore prets",
      "nurturing_trigger",
      [DEFAULT_EMAIL_TEMPLATES[3]]
    ),
    buildSequenceFromTemplate(
      "Qualification approfondie",
      "Sequence de qualification apres premier echange positif",
      "lead_replied",
      [DEFAULT_EMAIL_TEMPLATES[4], DEFAULT_EMAIL_TEMPLATES[5]]
    ),
  ];
}
