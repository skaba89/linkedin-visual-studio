// HERMÈS CRM Engine — Contact, Deal, and Pipeline management

import { CRMContact, CRMDeal, DealStage, DEAL_STAGES, PipelineStats, ContactTimelineEntry } from "./types";
import { db, ensureDefaultUser } from "@/lib/db";

export class CRMEngine {
  async createContact(data: Omit<CRMContact, "id" | "createdAt" | "updatedAt">): Promise<CRMContact> {
    await ensureDefaultUser();

    const contact = await db.contact.create({
      data: {
        userId: "default",
        prenom: data.prenom,
        nom: data.nom,
        email: data.email,
        telephone: data.telephone,
        entreprise: data.entreprise,
        poste: data.poste,
        secteur: data.secteur,
        siteWeb: data.siteWeb,
        linkedinUrl: data.linkedinUrl,
        source: data.source || "manual",
        notes: data.notes,
        tags: JSON.stringify(data.tags || []),
        score: data.score || 0,
      },
    });

    return this.mapContact(contact);
  }

  async updateContact(id: string, data: Partial<CRMContact>): Promise<CRMContact | null> {
    const updateData: Record<string, unknown> = {};
    if (data.prenom !== undefined) updateData.prenom = data.prenom;
    if (data.nom !== undefined) updateData.nom = data.nom;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.telephone !== undefined) updateData.telephone = data.telephone;
    if (data.entreprise !== undefined) updateData.entreprise = data.entreprise;
    if (data.poste !== undefined) updateData.poste = data.poste;
    if (data.secteur !== undefined) updateData.secteur = data.secteur;
    if (data.siteWeb !== undefined) updateData.siteWeb = data.siteWeb;
    if (data.linkedinUrl !== undefined) updateData.linkedinUrl = data.linkedinUrl;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
    if (data.score !== undefined) updateData.score = data.score;

    try {
      const contact = await db.contact.update({
        where: { id },
        data: updateData,
      });
      return this.mapContact(contact);
    } catch {
      return null;
    }
  }

  async getContacts(filters?: {
    search?: string;
    entreprise?: string;
    secteur?: string;
    source?: string;
    minScore?: number;
    tags?: string[];
  }): Promise<CRMContact[]> {
    const where: Record<string, unknown> = { userId: "default" };

    if (filters?.entreprise) where.entreprise = { contains: filters.entreprise };
    if (filters?.secteur) where.secteur = { contains: filters.secteur };
    if (filters?.source) where.source = filters.source;
    if (filters?.minScore) where.score = { gte: filters.minScore };

    if (filters?.search) {
      where.OR = [
        { prenom: { contains: filters.search } },
        { nom: { contains: filters.search } },
        { email: { contains: filters.search } },
        { entreprise: { contains: filters.search } },
      ];
    }

    const contacts = await db.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return contacts.map(this.mapContact);
  }

  async deleteContact(id: string): Promise<boolean> {
    try {
      await db.contact.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async createDeal(data: Omit<CRMDeal, "id" | "createdAt" | "updatedAt">): Promise<CRMDeal> {
    await ensureDefaultUser();

    const deal = await db.deal.create({
      data: {
        userId: "default",
        contactId: data.contactId,
        titre: data.titre,
        valeur: data.valeur,
        devise: data.devise || "EUR",
        stage: data.stage || "prospect",
        probabilite: data.probabilite || 20,
        dateCloturePrevue: data.dateCloturePrevue,
        sourceCanal: data.sourceCanal,
        notes: data.notes,
      },
    });

    return this.mapDeal(deal);
  }

  async updateDeal(id: string, data: Partial<CRMDeal>): Promise<CRMDeal | null> {
    const updateData: Record<string, unknown> = {};
    if (data.titre !== undefined) updateData.titre = data.titre;
    if (data.valeur !== undefined) updateData.valeur = data.valeur;
    if (data.devise !== undefined) updateData.devise = data.devise;
    if (data.stage !== undefined) updateData.stage = data.stage;
    if (data.probabilite !== undefined) updateData.probabilite = data.probabilite;
    if (data.dateCloturePrevue !== undefined) updateData.dateCloturePrevue = data.dateCloturePrevue;
    if (data.sourceCanal !== undefined) updateData.sourceCanal = data.sourceCanal;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.contactId !== undefined) updateData.contactId = data.contactId;

    try {
      const deal = await db.deal.update({
        where: { id },
        data: updateData,
      });
      return this.mapDeal(deal);
    } catch {
      return null;
    }
  }

  async getDeals(filters?: { stage?: DealStage; contactId?: string; minValeur?: number }): Promise<CRMDeal[]> {
    const where: Record<string, unknown> = { userId: "default" };

    if (filters?.stage) where.stage = filters.stage;
    if (filters?.contactId) where.contactId = filters.contactId;
    if (filters?.minValeur) where.valeur = { gte: filters.minValeur };

    const deals = await db.deal.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return deals.map(this.mapDeal);
  }

  async deleteDeal(id: string): Promise<boolean> {
    try {
      await db.deal.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async moveDealStage(dealId: string, newStage: DealStage): Promise<CRMDeal | null> {
    // Auto-adjust probability based on stage
    const stageProbability: Record<DealStage, number> = {
      prospect: 10,
      qualification: 25,
      proposition: 50,
      negociation: 75,
      closed_won: 100,
      closed_lost: 0,
    };

    return this.updateDeal(dealId, {
      stage: newStage,
      probabilite: stageProbability[newStage],
    } as Partial<CRMDeal>);
  }

  async getPipelineStats(): Promise<PipelineStats> {
    const deals = await db.deal.findMany({ where: { userId: "default" } });

    const dealsByStage = {} as Record<DealStage, { count: number; totalValue: number }>;

    for (const stage of DEAL_STAGES) {
      const stageDeals = deals.filter((d) => d.stage === stage.id);
      dealsByStage[stage.id] = {
        count: stageDeals.length,
        totalValue: stageDeals.reduce((sum, d) => sum + d.valeur, 0),
      };
    }

    const totalPipelineValue = deals
      .filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")
      .reduce((sum, d) => sum + d.valeur, 0);

    const weightedPipelineValue = deals
      .filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")
      .reduce((sum, d) => sum + d.valeur * (d.probabilite / 100), 0);

    const activeDeals = deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
    const averageDealSize = activeDeals.length > 0 ? totalPipelineValue / activeDeals.length : 0;

    const wonDeals = deals.filter((d) => d.stage === "closed_won");
    const lostDeals = deals.filter((d) => d.stage === "closed_lost");
    const totalClosed = wonDeals.length + lostDeals.length;
    const winRate = totalClosed > 0 ? wonDeals.length / totalClosed : 0;

    return {
      dealsByStage,
      totalPipelineValue,
      weightedPipelineValue,
      averageDealSize,
      winRate,
    };
  }

  async getContactTimeline(contactId: string): Promise<ContactTimelineEntry[]> {
    const timeline: ContactTimelineEntry[] = [];

    // Get emails
    const emails = await db.emailMessage.findMany({
      where: { contactId, userId: "default" },
      orderBy: { createdAt: "desc" },
    });

    for (const email of emails) {
      timeline.push({
        type: "email",
        date: email.createdAt,
        content: `${email.subject} — ${email.status}`,
        metadata: { status: email.status, openedAt: email.openedAt, clickedAt: email.clickedAt, repliedAt: email.repliedAt },
      });
    }

    // Get activity logs related to this contact
    const activities = await db.activityLog.findMany({
      where: { userId: "default" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    for (const activity of activities) {
      if (activity.details?.includes(contactId)) {
        timeline.push({
          type: "activity",
          date: activity.createdAt,
          content: activity.message,
          metadata: { agentId: activity.agentId, type: activity.type },
        });
      }
    }

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return timeline;
  }

  async linkLeadToContact(leadId: string, contactId?: string): Promise<CRMContact | null> {
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return null;

    if (contactId) {
      // Update existing contact
      return this.updateContact(contactId, {
        score: lead.score,
        notes: `Lead LinkedIn: ${lead.postSujet}`,
      } as Partial<CRMContact>);
    }

    // Create new contact from lead
    return this.createContact({
      prenom: lead.prenom,
      nom: "",
      email: "",
      entreprise: lead.entreprise,
      poste: lead.poste,
      secteur: lead.secteur,
      source: "linkedin",
      tags: [lead.action, `score:${lead.score}`],
      score: lead.score,
    });
  }

  private mapContact(c: any): CRMContact {
    return {
      id: c.id,
      prenom: c.prenom,
      nom: c.nom || "",
      email: c.email || "",
      telephone: c.telephone || undefined,
      entreprise: c.entreprise || "",
      poste: c.poste || "",
      secteur: c.secteur || "",
      siteWeb: c.siteWeb || undefined,
      linkedinUrl: c.linkedinUrl || undefined,
      source: c.source || "manual",
      notes: c.notes || undefined,
      tags: typeof c.tags === "string" ? JSON.parse(c.tags) : (c.tags || []),
      score: c.score || 0,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private mapDeal(d: any): CRMDeal {
    return {
      id: d.id,
      contactId: d.contactId,
      titre: d.titre,
      valeur: d.valeur || 0,
      devise: d.devise || "EUR",
      stage: (d.stage || "prospect") as DealStage,
      probabilite: d.probabilite || 0,
      dateCloturePrevue: d.dateCloturePrevue || undefined,
      sourceCanal: d.sourceCanal || undefined,
      notes: d.notes || undefined,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}

// Singleton
export const crmEngine = new CRMEngine();
