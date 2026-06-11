// HERMÈS Email Agent — Automated email sequences and tracking

import { EmailSequenceStep, EmailTemplate, EmailMessageStatus } from "./types";
import { db, ensureDefaultUser } from "@/lib/db";

// Default email templates
const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: "initial-outreach",
    name: "Premier contact — Référence au post",
    subject: "Suite à votre interaction sur LinkedIn",
    body: `Bonjour [prénom],

J'ai remarqué que vous aviez [commenté / aimé] mon post sur [sujet]. Je m'intéresse beaucoup aux enjeux d'[angle spécifique] chez les [type d'entreprise].

Une question rapide : quel est votre principal défi en ce moment sur [thème] ?

Cordialement`,
    timing: "J+0 · Premier contact",
    category: "initial",
  },
  {
    id: "followup-j3",
    name: "Relance J+3 — Rappel court",
    subject: "Re: Suite à votre interaction sur LinkedIn",
    body: `Bonjour [prénom], je voulais m'assurer que mon message ne s'était pas perdu.

Est-ce que [thème de votre question initiale] est toujours une priorité pour vous en ce moment ?

Cordialement`,
    timing: "J+3 · Si pas de réponse",
    category: "followup",
  },
  {
    id: "followup-j7",
    name: "Relance J+7 — Ressource gratuite",
    subject: "Ressource qui pourrait vous intéresser",
    body: `Bonjour [prénom],

Je partage cette semaine un guide sur [sujet de la ressource]. Je pense que ça peut vous intéresser vu votre focus sur [enjeu spécifique].

Si vous voulez, je peux vous montrer comment on l'applique concrètement chez des [profils similaires]. 20 minutes suffisent.

Cordialement`,
    timing: "J+7 · Valeur + CTA",
    category: "resource",
  },
  {
    id: "resource-sharing",
    name: "Partage de ressource",
    subject: "[Prénom], un article qui pourrait vous aider",
    body: `Bonjour [prénom],

Je suis tombé sur cet article qui aborde exactement [sujet]. Vu votre poste de [poste] chez [entreprise], je pense que ça pourrait vous être utile.

N'hésitez pas si vous voulez en discuter.

Cordialement`,
    timing: "Variable · Selon le contexte",
    category: "resource",
  },
  {
    id: "meeting-proposal",
    name: "Proposition de rendez-vous",
    subject: "20 minutes pour échanger ?",
    body: `Bonjour [prénom],

Suite à nos échanges, je pense qu'il y a un vrai point de convergence entre vos enjeux et ce que nous faisons.

Seriez-vous disponible pour un court échange de 20 minutes cette semaine ? Je vous montrerai concrètement comment [résultat spécifique].

Cordialement`,
    timing: "Quand le prospect est qualifié",
    category: "meeting",
  },
];

export class EmailAgent {
  private templates: EmailTemplate[] = [...DEFAULT_TEMPLATES];

  async generateEmail(
    contact: { prenom: string; nom?: string; poste?: string; entreprise?: string; email?: string },
    step: EmailSequenceStep,
    context?: Record<string, string>
  ): Promise<{ subject: string; body: string }> {
    let subject = step.subject;
    let body = step.body;

    // Replace placeholders
    const replacements: Record<string, string> = {
      "[prénom]": contact.prenom || "cher prospect",
      "[nom]": contact.nom || "",
      "[poste]": contact.poste || "",
      "[entreprise]": contact.entreprise || "",
      ...context,
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      subject = subject.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
      body = body.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
    }

    return { subject, body };
  }

  async sendEmail(contactId: string, subject: string, body: string, sequenceId?: string): Promise<string> {
    await ensureDefaultUser();

    const email = await db.emailMessage.create({
      data: {
        userId: "default",
        contactId,
        sequenceId,
        subject,
        body,
        status: "sent",
        sentAt: new Date(),
      },
    });

    return email.id;
  }

  async executeSequence(sequenceId: string, contactId: string): Promise<void> {
    await ensureDefaultUser();

    const sequence = await db.emailSequence.findUnique({
      where: { id: sequenceId },
    });

    if (!sequence || sequence.status !== "active") return;

    const steps: EmailSequenceStep[] = JSON.parse(sequence.steps);
    const contact = await db.contact.findUnique({ where: { id: contactId } });
    if (!contact) return;

    for (const step of steps) {
      const { subject, body } = await this.generateEmail(
        {
          prenom: contact.prenom,
          nom: contact.nom,
          poste: contact.poste,
          entreprise: contact.entreprise,
        },
        step
      );

      await this.sendEmail(contactId, subject, body, sequenceId);
    }
  }

  async trackOpen(messageId: string): Promise<void> {
    await db.emailMessage.update({
      where: { id: messageId },
      data: { openedAt: new Date(), status: "opened" },
    });
  }

  async trackClick(messageId: string): Promise<void> {
    await db.emailMessage.update({
      where: { id: messageId },
      data: { clickedAt: new Date(), status: "clicked" },
    });
  }

  async trackReply(messageId: string): Promise<void> {
    await db.emailMessage.update({
      where: { id: messageId },
      data: { repliedAt: new Date(), status: "replied" },
    });
  }

  async getSequenceStats(sequenceId: string): Promise<{
    totalSent: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  }> {
    const messages = await db.emailMessage.findMany({
      where: { sequenceId, userId: "default" },
    });

    const totalSent = messages.filter((m) => m.status !== "draft" && m.status !== "queued").length;
    const opened = messages.filter((m) => m.openedAt).length;
    const clicked = messages.filter((m) => m.clickedAt).length;
    const replied = messages.filter((m) => m.repliedAt).length;

    return {
      totalSent,
      openRate: totalSent > 0 ? opened / totalSent : 0,
      clickRate: totalSent > 0 ? clicked / totalSent : 0,
      replyRate: totalSent > 0 ? replied / totalSent : 0,
    };
  }

  getTemplates(): EmailTemplate[] {
    return [...this.templates];
  }
}

// Singleton
export const emailAgent = new EmailAgent();
