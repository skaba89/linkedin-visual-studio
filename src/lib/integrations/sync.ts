/**
 * HERMÈS — Phase 4.3 — Integration sync engine
 *
 * Syncs HERMÈS contacts + deals to external CRMs (HubSpot, Pipedrive,
 * Notion, Attio). Each provider has its own adapter implementing the
 * IntegrationAdapter interface.
 *
 * Sync flow:
 *   1. List all HERMÈS contacts for the user (with their deals)
 *   2. For each contact:
 *      a. Check if it already exists in the external CRM (by email or LinkedIn URL)
 *      b. If yes → update it
 *      c. If no → create it
 *   3. Update the Integration row with the sync result
 *
 * Sync state:
 *   - lastSyncAt:    set to now
 *   - lastSyncStatus: success | partial | failed
 *   - lastSyncError:  error message if failed
 *   - totalSynced:    incremented by the number of records synced
 *
 * Error handling:
 *   - If a single contact fails, the sync continues (partial)
 *   - If the entire sync fails (e.g., bad credentials), status = failed
 *   - Errors are logged but not thrown (sync is idempotent and retried)
 */

import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { createLogger } from "@/lib/logger";
import type { IntegrationProvider, ProviderId } from "@/lib/integrations/providers";

const log = createLogger("integrations-sync");

export interface SyncResult {
  provider: ProviderId;
  status: "success" | "partial" | "failed";
  totalRecords: number;
  synced: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

export interface ContactPayload {
  id: string;
  prenom: string;
  nom: string;
  email?: string | null;
  entreprise: string;
  poste: string;
  phone?: string | null;
  linkedinUrl?: string | null;
  source: string;
  score: number;
  notes?: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationAdapter {
  provider: ProviderId;
  /** Validate credentials by making a test API call */
  validateCredentials(credentials: Record<string, string>): Promise<boolean>;
  /** Sync a single contact to the external CRM */
  syncContact(contact: ContactPayload, credentials: Record<string, string>, settings: Record<string, unknown>): Promise<{ externalId: string; action: "created" | "updated" }>;
  /** Test the connection (called when the user clicks "Test") */
  testConnection(credentials: Record<string, string>): Promise<{ ok: boolean; message: string }>;
}

// ─── Credentials encryption ──────────────────────────────────────────

/**
 * Encrypt credentials before storing them in the DB.
 * Returns an AES-256-GCM encrypted JSON blob.
 */
export function encryptCredentials(creds: Record<string, string>): string {
  return encrypt(JSON.stringify(creds));
}

/**
 * Decrypt credentials from the DB.
 * Returns an empty object if decryption fails (credentials were
 * encrypted with an old key, or the row is empty).
 */
export function decryptCredentials(encrypted: string): Record<string, string> {
  if (!encrypted) return {};
  try {
    return JSON.parse(decrypt(encrypted)) as Record<string, string>;
  } catch {
    return {};
  }
}

// ─── Adapter registry ────────────────────────────────────────────────

const adapters = new Map<ProviderId, IntegrationAdapter>();

export function registerAdapter(adapter: IntegrationAdapter): void {
  adapters.set(adapter.provider, adapter);
}

export function getAdapter(provider: string): IntegrationAdapter | null {
  return adapters.get(provider as ProviderId) ?? null;
}

// ─── HubSpot adapter ─────────────────────────────────────────────────

const hubspotAdapter: IntegrationAdapter = {
  provider: "hubspot",
  async validateCredentials(creds) {
    if (!creds.apiKey) return false;
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
        headers: { Authorization: `Bearer ${creds.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  },
  async syncContact(contact, creds, _settings) {
    // Check if contact exists by email
    let existingId: string | null = null;
    if (contact.email) {
      const searchRes = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(contact.email)}?idProperty=email`,
        { headers: { Authorization: `Bearer ${creds.apiKey}` } },
      );
      if (searchRes.ok) {
        const data = await searchRes.json() as { id: string };
        existingId = data.id;
      }
    }

    const body = {
      properties: {
        firstname: contact.prenom,
        lastname: contact.nom,
        email: contact.email ?? "",
        company: contact.entreprise,
        jobtitle: contact.poste,
        phone: contact.phone ?? "",
        linkedin_url: contact.linkedinUrl ?? "",
        lead_score: contact.score.toString(),
        hermes_source: contact.source,
      },
    };

    if (existingId) {
      const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${existingId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HubSpot update failed: ${res.status}`);
      return { externalId: existingId, action: "updated" as const };
    }

    const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HubSpot create failed: ${res.status}`);
    const data = await res.json() as { id: string };
    return { externalId: data.id, action: "created" as const };
  },
  async testConnection(creds) {
    if (!creds.apiKey) return { ok: false, message: "Clé API manquante" };
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
        headers: { Authorization: `Bearer ${creds.apiKey}` },
      });
      if (res.ok) return { ok: true, message: "Connexion réussie à HubSpot" };
      if (res.status === 401) return { ok: false, message: "Clé API invalide" };
      return { ok: false, message: `Erreur HubSpot: ${res.status}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Erreur réseau" };
    }
  },
};
registerAdapter(hubspotAdapter);

// ─── Pipedrive adapter ───────────────────────────────────────────────

const pipedriveAdapter: IntegrationAdapter = {
  provider: "pipedrive",
  async validateCredentials(creds) {
    if (!creds.apiKey || !creds.companyDomain) return false;
    try {
      const res = await fetch(`https://${creds.companyDomain}.pipedrive.com/api/v1/users/me?api_token=${creds.apiKey}`);
      return res.ok;
    } catch {
      return false;
    }
  },
  async syncContact(contact, creds, _settings) {
    const baseUrl = `https://${creds.companyDomain}.pipedrive.com/api/v1`;
    // Check if person exists by email
    let existingId: number | null = null;
    if (contact.email) {
      const searchRes = await fetch(`${baseUrl}/persons/search?term=${encodeURIComponent(contact.email)}&api_token=${creds.apiKey}`);
      if (searchRes.ok) {
        const data = await searchRes.json() as { data?: { items?: Array<{ item?: { id?: number } }> } };
        const first = data.data?.items?.[0]?.item;
        if (first?.id) existingId = first.id;
      }
    }

    const body = {
      name: `${contact.prenom} ${contact.nom}`.trim(),
      email: contact.email ? [contact.email] : [],
      phone: contact.phone ? [contact.phone] : [],
      org_name: contact.entreprise,
      "abc123_linkedin_url": contact.linkedinUrl,
    };

    if (existingId) {
      const res = await fetch(`${baseUrl}/persons/${existingId}?api_token=${creds.apiKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Pipedrive update failed: ${res.status}`);
      return { externalId: String(existingId), action: "updated" as const };
    }

    const res = await fetch(`${baseUrl}/persons?api_token=${creds.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Pipedrive create failed: ${res.status}`);
    const data = await res.json() as { data: { id: number } };
    return { externalId: String(data.data.id), action: "created" as const };
  },
  async testConnection(creds) {
    if (!creds.apiKey || !creds.companyDomain) return { ok: false, message: "Clé API ou domaine manquant" };
    try {
      const res = await fetch(`https://${creds.companyDomain}.pipedrive.com/api/v1/users/me?api_token=${creds.apiKey}`);
      if (res.ok) return { ok: true, message: "Connexion réussie à Pipedrive" };
      if (res.status === 401) return { ok: false, message: "Clé API invalide" };
      return { ok: false, message: `Erreur Pipedrive: ${res.status}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Erreur réseau" };
    }
  },
};
registerAdapter(pipedriveAdapter);

// ─── Notion adapter ──────────────────────────────────────────────────

const notionAdapter: IntegrationAdapter = {
  provider: "notion",
  async validateCredentials(creds) {
    if (!creds.apiKey || !creds.databaseId) return false;
    try {
      const res = await fetch(`https://api.notion.com/v1/databases/${creds.databaseId}`, {
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          "Notion-Version": "2022-06-28",
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  },
  async syncContact(contact, creds, _settings) {
    // Check if page exists by LinkedIn URL in the database
    let existingId: string | null = null;
    if (contact.linkedinUrl) {
      const searchRes = await fetch(`https://api.notion.com/v1/databases/${creds.databaseId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            property: "LinkedIn URL",
            url: { equals: contact.linkedinUrl },
          },
        }),
      });
      if (searchRes.ok) {
        const data = await searchRes.json() as { results: Array<{ id: string }> };
        if (data.results.length > 0) existingId = data.results[0].id;
      }
    }

    const properties = {
      Name: { title: [{ text: { content: `${contact.prenom} ${contact.nom}`.trim() } }] },
      Entreprise: { rich_text: [{ text: { content: contact.entreprise } }] },
      Poste: { rich_text: [{ text: { content: contact.poste } }] },
      Email: { email: contact.email ?? null },
      "LinkedIn URL": { url: contact.linkedinUrl ?? null },
      Score: { number: contact.score },
      Source: { select: { name: contact.source } },
    };

    if (existingId) {
      const res = await fetch(`https://api.notion.com/v1/pages/${existingId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties }),
      });
      if (!res.ok) throw new Error(`Notion update failed: ${res.status}`);
      return { externalId: existingId, action: "updated" as const };
    }

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: creds.databaseId },
        properties,
      }),
    });
    if (!res.ok) throw new Error(`Notion create failed: ${res.status}`);
    const data = await res.json() as { id: string };
    return { externalId: data.id, action: "created" as const };
  },
  async testConnection(creds) {
    if (!creds.apiKey || !creds.databaseId) return { ok: false, message: "Token ou ID de base manquant" };
    try {
      const res = await fetch(`https://api.notion.com/v1/databases/${creds.databaseId}`, {
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          "Notion-Version": "2022-06-28",
        },
      });
      if (res.ok) return { ok: true, message: "Connexion réussie à Notion" };
      if (res.status === 401) return { ok: false, message: "Token invalide" };
      if (res.status === 404) return { ok: false, message: "Base de données introuvable (vérifiez l'ID et le partage)" };
      return { ok: false, message: `Erreur Notion: ${res.status}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Erreur réseau" };
    }
  },
};
registerAdapter(notionAdapter);

// ─── Attio adapter ───────────────────────────────────────────────────

const attioAdapter: IntegrationAdapter = {
  provider: "attio",
  async validateCredentials(creds) {
    if (!creds.apiKey) return false;
    try {
      const res = await fetch("https://api.attio.com/v2/self", {
        headers: { Authorization: `Bearer ${creds.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  },
  async syncContact(contact, creds, _settings) {
    // Attio uses a "people" object by default
    const body = {
      data: {
        values: {
          name: [{ first_name: contact.prenom, last_name: contact.nom }],
          email: [{ email: contact.email }],
          company: contact.entreprise,
          title: contact.poste,
          linkedin: contact.linkedinUrl,
        },
      },
    };

    const res = await fetch("https://api.attio.com/v2/objects/people/records", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // If record exists (409), try to find + update
      if (res.status === 409 && contact.email) {
        const searchRes = await fetch("https://api.attio.com/v2/objects/people/records/query", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${creds.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filter: { email: { email: { _equals: contact.email } } },
          }),
        });
        if (searchRes.ok) {
          const data = await searchRes.json() as { data: Array<{ id: { record_id: string } }> };
          if (data.data.length > 0) {
            const existingId = data.data[0].id.record_id;
            const updateRes = await fetch(`https://api.attio.com/v2/objects/people/records/${existingId}`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${creds.apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });
            if (updateRes.ok) return { externalId: existingId, action: "updated" as const };
          }
        }
      }
      throw new Error(`Attio sync failed: ${res.status}`);
    }
    const data = await res.json() as { data: { id: { record_id: string } } };
    return { externalId: data.data.id.record_id, action: "created" as const };
  },
  async testConnection(creds) {
    if (!creds.apiKey) return { ok: false, message: "Clé API manquante" };
    try {
      const res = await fetch("https://api.attio.com/v2/self", {
        headers: { Authorization: `Bearer ${creds.apiKey}` },
      });
      if (res.ok) return { ok: true, message: "Connexion réussie à Attio" };
      if (res.status === 401) return { ok: false, message: "Clé API invalide" };
      return { ok: false, message: `Erreur Attio: ${res.status}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Erreur réseau" };
    }
  },
};
registerAdapter(attioAdapter);

// ─── Sync orchestrator ───────────────────────────────────────────────

/**
 * Run a sync for a single Integration row.
 * Called by:
 *   - The /api/integrations/[id]/sync route (manual trigger)
 *   - The /api/cron/integrations-sync cron job (auto-sync)
 */
export async function syncIntegration(integrationId: string): Promise<SyncResult> {
  const startTime = Date.now();
  const integration = await db.integration.findUnique({
    where: { id: integrationId },
  });
  if (!integration) {
    return {
      provider: "hubspot",
      status: "failed",
      totalRecords: 0,
      synced: 0,
      failed: 0,
      errors: ["Integration not found"],
      durationMs: 0,
    };
  }

  const adapter = getAdapter(integration.provider);
  if (!adapter) {
    await db.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "failed",
        lastSyncError: `No adapter for provider: ${integration.provider}`,
      },
    });
    return {
      provider: integration.provider as ProviderId,
      status: "failed",
      totalRecords: 0,
      synced: 0,
      failed: 0,
      errors: [`No adapter for provider: ${integration.provider}`],
      durationMs: Date.now() - startTime,
    };
  }

  const creds = decryptCredentials(integration.credentials);
  const settings: Record<string, unknown> = JSON.parse(integration.syncSettings || "{}");

  // Fetch all contacts for the user
  const contacts = await db.contact.findMany({
    where: { userId: integration.userId },
    take: 500, // cap per sync run to avoid timeouts
  });

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const c of contacts) {
    try {
      const payload: ContactPayload = {
        id: c.id,
        prenom: c.prenom,
        nom: c.nom,
        email: c.email ?? null,
        entreprise: c.entreprise,
        poste: c.poste,
        phone: c.telephone ?? null,
        linkedinUrl: c.linkedinUrl ?? null,
        source: c.source,
        score: c.score,
        notes: c.notes ?? null,
        tags: [],
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
      await adapter.syncContact(payload, creds, settings);
      synced++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Contact ${c.id}: ${msg}`);
      if (errors.length > 10) break; // cap error log
    }
  }

  const status: SyncResult["status"] = failed === 0 ? "success" : synced > 0 ? "partial" : "failed";

  await db.integration.update({
    where: { id: integrationId },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: status,
      lastSyncError: status === "failed" ? errors[0] : null,
      totalSynced: { increment: synced },
    },
  });

  log.info("Integration sync completed", {
    integrationId,
    provider: integration.provider,
    status,
    synced,
    failed,
    totalRecords: contacts.length,
  });

  return {
    provider: integration.provider as ProviderId,
    status,
    totalRecords: contacts.length,
    synced,
    failed,
    errors,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Bulk sync all integrations for all users (called by the cron job).
 */
export async function syncAllIntegrations(): Promise<void> {
  const integrations = await db.integration.findMany({
    where: {
      status: "active",
      autoSyncEnabled: true,
    },
    select: { id: true },
  });

  for (const integration of integrations) {
    try {
      await syncIntegration(integration.id);
    } catch (err) {
      log.error("Integration sync failed", {
        integrationId: integration.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Test the connection for an integration (manual user action).
 */
export async function testIntegrationConnection(
  provider: string,
  credentials: Record<string, string>,
): Promise<{ ok: boolean; message: string }> {
  const adapter = getAdapter(provider);
  if (!adapter) return { ok: false, message: `Provider non supporté: ${provider}` };
  return adapter.testConnection(credentials);
}

// Re-export the IntegrationProvider type for convenience
export type { IntegrationProvider };
