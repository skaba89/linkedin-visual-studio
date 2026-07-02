/**
 * HERMÈS — Phase 3.3 — Reactor → CRM sync
 *
 * Syncs captured LinkedIn reactors into the CRM as Contact rows. A reactor
 * (someone who liked or commented on the user's post) is a warm lead by
 * definition — they raised their hand and engaged with the user's content.
 *
 * Sync rules:
 *   - Only sync reactors that haven't been synced yet (syncedToCrmAt IS NULL)
 *   - Skip reactors marked as `ignored` (user said "not a lead")
 *   - Deduplication: if a Contact with the same linkedinUrl or full name
 *     already exists for this user, link the reactor to the existing
 *     Contact instead of creating a duplicate
 *   - Comment-action reactors get a higher score (75) than like-action
 *     reactors (60), because commenting is a stronger engagement signal
 *   - New contacts get tags `["linkedin", "reactor", "<action>"]` so they
 *     can be filtered in the CRM view
 *   - Multi-tenant safe: every query is scoped by userId
 */
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { stringifyJsonField } from "@/lib/json-field";

const log = createLogger("reactor-crm-sync");

const SCORE_LIKE = 60;
const SCORE_COMMENT = 75;

export interface ReactorCrmSyncResult {
  userId: string;
  total: number;
  created: number;
  linked: number;
  skipped: number;
  failed: number;
}

/**
 * Find an existing Contact for the user that matches the reactor by
 * LinkedIn URL or by name. Returns the contactId if found, null otherwise.
 */
async function findExistingContact(
  userId: string,
  reactorLinkedInId: string,
  reactorName: string,
): Promise<string | null> {
  // 1. Try LinkedIn profile URL match (most reliable)
  const profileUrl = `https://www.linkedin.com/in/${reactorLinkedInId}`;
  const byUrl = await db.contact.findFirst({
    where: { userId, linkedinUrl: profileUrl },
    select: { id: true },
  });
  if (byUrl) return byUrl.id;

  // 2. Try name match (less reliable, but catches manually-entered contacts)
  // The Contact model splits prenom/nom, so we parse the reactor name.
  if (reactorName && reactorName.trim().length > 2) {
    const parts = reactorName.trim().split(/\s+/);
    if (parts.length >= 2) {
      const prenom = parts[0];
      const nom = parts.slice(1).join(" ");
      const byName = await db.contact.findFirst({
        where: {
          userId,
          prenom: { equals: prenom, mode: "insensitive" },
          nom: { equals: nom, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (byName) return byName.id;
    }
  }

  return null;
}

/**
 * Sync a single reactor to the CRM.
 *
 * @returns "created" | "linked" | "skipped" | "failed"
 */
async function syncOneReactor(reactorId: string): Promise<"created" | "linked" | "skipped" | "failed"> {
  const reactor = await db.linkedInReactor.findUnique({ where: { id: reactorId } });
  if (!reactor) return "failed";
  if (reactor.ignored) return "skipped";
  if (reactor.syncedToCrmAt && reactor.contactId) return "skipped";

  try {
    const existingContactId = await findExistingContact(
      reactor.userId,
      reactor.reactorLinkedInId,
      reactor.reactorName,
    );

    if (existingContactId) {
      // Link the reactor to the existing contact
      await db.linkedInReactor.update({
        where: { id: reactor.id },
        data: {
          contactId: existingContactId,
          syncedToCrmAt: new Date(),
        },
      });
      return "linked";
    }

    // Parse name into prenom / nom for the Contact model
    const nameParts = reactor.reactorName.trim().split(/\s+/);
    const prenom = nameParts[0] || reactor.reactorName;
    const nom = nameParts.slice(1).join(" ");

    const score = reactor.action === "comment" ? SCORE_COMMENT : SCORE_LIKE;
    const tags = stringifyJsonField(["linkedin", "reactor", reactor.action]);

    const contact = await db.contact.create({
      data: {
        userId: reactor.userId,
        prenom,
        nom,
        entreprise: "",
        poste: reactor.reactorHeadline ?? "",
        secteur: "",
        linkedinUrl: reactor.reactorProfileUrl ?? `https://www.linkedin.com/in/${reactor.reactorLinkedInId}`,
        source: `linkedin_${reactor.action}`,
        notes: reactor.commentText
          ? `Commenté sur votre post: "${reactor.commentText.slice(0, 280)}"`
          : `A liké votre post LinkedIn`,
        tags,
        score,
      },
    });

    await db.linkedInReactor.update({
      where: { id: reactor.id },
      data: {
        contactId: contact.id,
        syncedToCrmAt: new Date(),
      },
    });

    return "created";
  } catch (err) {
    log.warn("Failed to sync reactor to CRM", {
      reactorId,
      error: err instanceof Error ? err.message : String(err),
    });
    return "failed";
  }
}

/**
 * Sync all unsynced reactors for a user into the CRM.
 *
 * @param userId — the HERMÈS user ID
 * @param limit — max reactors to sync in one call (default 100)
 */
export async function syncReactorsToCrmForUser(
  userId: string,
  limit: number = 100,
): Promise<ReactorCrmSyncResult> {
  const reactors = await db.linkedInReactor.findMany({
    where: {
      userId,
      ignored: false,
      syncedToCrmAt: null,
    },
    orderBy: { capturedAt: "desc" },
    take: limit,
    select: { id: true },
  });

  let created = 0;
  let linked = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of reactors) {
    const result = await syncOneReactor(r.id);
    if (result === "created") created++;
    else if (result === "linked") linked++;
    else if (result === "skipped") skipped++;
    else failed++;
  }

  log.info("Reactor CRM sync complete for user", {
    userId,
    total: reactors.length,
    created,
    linked,
    skipped,
    failed,
  });

  return {
    userId,
    total: reactors.length,
    created,
    linked,
    skipped,
    failed,
  };
}

/**
 * Sync all unsynced reactors for all users.
 * Called by the /api/cron/reactor-capture route (after capture).
 */
export async function syncReactorsToCrmForAllUsers(): Promise<{
  totalUsers: number;
  totalCreated: number;
  totalLinked: number;
  results: ReactorCrmSyncResult[];
}> {
  // Find users who have unsynced reactors
  const users = await db.linkedInReactor.groupBy({
    by: ["userId"],
    where: {
      ignored: false,
      syncedToCrmAt: null,
    },
    _count: { _all: true },
  });

  const results: ReactorCrmSyncResult[] = [];
  for (const u of users) {
    const result = await syncReactorsToCrmForUser(u.userId);
    results.push(result);
  }

  return {
    totalUsers: users.length,
    totalCreated: results.reduce((s, r) => s + r.created, 0),
    totalLinked: results.reduce((s, r) => s + r.linked, 0),
    results,
  };
}
