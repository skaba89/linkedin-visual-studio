// ─── Webhook Delivery Engine — Prisma-persisted (BUG-H2 fix) ──────────

import { db, DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/db";
import {
  WebhookConfig,
  WebhookDelivery,
  WebhookEvent,
  WebhookProvider,
  buildSlackPayload,
  buildDiscordPayload,
} from "./types";

// ─── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// ─── DB ↔ Type Mappers ──────────────────────────────────────────────

function dbToWebhookConfig(row: {
  id: string;
  name: string;
  provider: string;
  url: string;
  secret: string | null;
  events: string;
  status: string;
  headers: string | null;
  retryCount: number;
  retryDelayMs: number;
  timeoutMs: number;
  lastTriggeredAt: string | null;
  lastStatus: number | null;
  errorCount: number;
  totalDeliveries: number;
  successDeliveries: number;
  createdAt: Date;
  updatedAt: Date;
}): WebhookConfig {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as WebhookProvider,
    url: row.url,
    secret: row.secret ?? undefined,
    events: JSON.parse(row.events || "[]"),
    status: row.status as WebhookConfig["status"],
    headers: row.headers ? JSON.parse(row.headers) : undefined,
    retryCount: row.retryCount,
    retryDelayMs: row.retryDelayMs,
    timeoutMs: row.timeoutMs,
    lastTriggeredAt: row.lastTriggeredAt,
    lastStatus: row.lastStatus,
    errorCount: row.errorCount,
    totalDeliveries: row.totalDeliveries,
    successDeliveries: row.successDeliveries,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function dbToWebhookDelivery(row: {
  id: string;
  webhookId: string;
  event: string;
  status: string;
  attempts: number;
  request: string;
  response: string | null;
  deliveredAt: string | null;
  nextRetryAt: string | null;
  error: string | null;
  createdAt: Date;
}): WebhookDelivery {
  const req = JSON.parse(row.request || "{}");
  const resp = row.response ? JSON.parse(row.response) : null;
  return {
    id: row.id,
    webhookId: row.webhookId,
    event: row.event as WebhookEvent,
    status: row.status as WebhookDelivery["status"],
    attempts: row.attempts,
    request: req,
    response: resp,
    createdAt: row.createdAt.toISOString(),
    deliveredAt: row.deliveredAt,
    nextRetryAt: row.nextRetryAt,
    error: row.error,
  };
}

// ─── Webhook Engine (Prisma-backed) ─────────────────────────────────

class WebhookEngine {

  /**
   * Register a new webhook — persisted to SQLite
   */
  async registerWebhook(input: {
    name: string;
    provider: WebhookProvider;
    url: string;
    events: WebhookEvent[];
    secret?: string;
    headers?: Record<string, string>;
    retryCount?: number;
    timeoutMs?: number;
  }): Promise<WebhookConfig> {
    await ensureDefaultUser();
    const row = await db.webhookData.create({
      data: {
        userId: DEFAULT_USER_ID,
        name: input.name,
        provider: input.provider,
        url: input.url,
        secret: input.secret ?? null,
        events: JSON.stringify(input.events),
        status: "active",
        headers: input.headers ? JSON.stringify(input.headers) : null,
        retryCount: input.retryCount ?? 3,
        retryDelayMs: 5000,
        timeoutMs: input.timeoutMs ?? 10000,
        lastTriggeredAt: null,
        lastStatus: null,
        errorCount: 0,
        totalDeliveries: 0,
        successDeliveries: 0,
      },
    });
    return dbToWebhookConfig(row);
  }

  /**
   * Get a webhook by ID
   */
  async getWebhook(id: string): Promise<WebhookConfig | null> {
    const row = await db.webhookData.findUnique({ where: { id } });
    if (!row) return null;
    return dbToWebhookConfig(row);
  }

  /**
   * Get all webhooks
   */
  async getWebhooks(): Promise<WebhookConfig[]> {
    const rows = await db.webhookData.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(dbToWebhookConfig);
  }

  /**
   * Update a webhook
   */
  async updateWebhook(
    id: string,
    updates: Partial<Pick<WebhookConfig, "name" | "url" | "events" | "status" | "headers" | "retryCount" | "timeoutMs">>
  ): Promise<WebhookConfig | null> {
    const existing = await db.webhookData.findUnique({ where: { id } });
    if (!existing) return null;

    const data: Record<string, unknown> = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.url !== undefined) data.url = updates.url;
    if (updates.events !== undefined) data.events = JSON.stringify(updates.events);
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.headers !== undefined) data.headers = JSON.stringify(updates.headers);
    if (updates.retryCount !== undefined) data.retryCount = updates.retryCount;
    if (updates.timeoutMs !== undefined) data.timeoutMs = updates.timeoutMs;

    const row = await db.webhookData.update({ where: { id }, data });
    return dbToWebhookConfig(row);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(id: string): Promise<boolean> {
    try {
      await db.webhookDeliveryData.deleteMany({ where: { webhookId: id } });
      await db.webhookData.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Toggle webhook status (pause/resume)
   */
  async toggleWebhook(id: string): Promise<WebhookConfig | null> {
    const existing = await db.webhookData.findUnique({ where: { id } });
    if (!existing) return null;

    const newStatus = existing.status === "active" ? "paused" : "active";
    const row = await db.webhookData.update({
      where: { id },
      data: { status: newStatus },
    });
    return dbToWebhookConfig(row);
  }

  /**
   * Find webhooks that listen to a specific event
   */
  async findWebhooksByEvent(event: WebhookEvent): Promise<WebhookConfig[]> {
    const rows = await db.webhookData.findMany({
      where: { userId: DEFAULT_USER_ID, status: "active" },
    });
    return rows
      .map(dbToWebhookConfig)
      .filter((w) => w.events.includes(event));
  }

  /**
   * Dispatch an event to all matching webhooks
   */
  async dispatchEvent(event: WebhookEvent, data: Record<string, unknown>): Promise<WebhookDelivery[]> {
    const matchingWebhooks = await this.findWebhooksByEvent(event);
    const deliveries: WebhookDelivery[] = [];

    for (const webhook of matchingWebhooks) {
      const delivery = await this.deliverToWebhook(webhook, event, data);
      deliveries.push(delivery);
    }

    return deliveries;
  }

  /**
   * Deliver a payload to a single webhook
   */
  private async deliverToWebhook(
    webhook: WebhookConfig,
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Promise<WebhookDelivery> {
    await ensureDefaultUser();
    const payload = this.buildPayload(webhook.provider, event, data);

    const requestId = generateId();
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "HERMES-Webhook/1.0",
      "X-Hermes-Event": event,
      "X-Hermes-Delivery": requestId,
      ...(webhook.secret ? { "X-Hermes-Signature": this.signPayload(webhook.secret, payload) } : {}),
      ...(webhook.headers ?? {}),
    };

    const requestBody = JSON.stringify(payload);

    let deliveryStatus = "pending";
    let attempts = 0;
    let lastError: string | null = null;
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let deliveredAt: string | null = null;

    // Attempt delivery with retries
    const maxAttempts = webhook.retryCount + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), webhook.timeoutMs);

        const response = await fetch(webhook.url, {
          method: "POST",
          headers: requestHeaders,
          body: requestBody,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        responseStatus = response.status;
        responseBody = await response.text().catch(() => null);

        if (response.status >= 200 && response.status < 300) {
          deliveryStatus = "delivered";
          deliveredAt = new Date().toISOString();
          break;
        } else {
          lastError = `HTTP ${response.status}`;
          if (attempt < maxAttempts) {
            deliveryStatus = "retrying";
            await new Promise((r) => setTimeout(r, webhook.retryDelayMs));
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < maxAttempts) {
          deliveryStatus = "retrying";
          await new Promise((r) => setTimeout(r, webhook.retryDelayMs));
        }
      }
    }

    if (deliveryStatus !== "delivered") {
      deliveryStatus = "failed";
    }

    // Persist delivery
    const deliveryRow = await db.webhookDeliveryData.create({
      data: {
        userId: DEFAULT_USER_ID,
        webhookId: webhook.id,
        event,
        status: deliveryStatus,
        attempts,
        request: JSON.stringify({
          url: webhook.url,
          method: "POST",
          headers: requestHeaders,
          body: requestBody,
        }),
        response: JSON.stringify({ status: responseStatus, body: responseBody }),
        deliveredAt,
        error: lastError,
      },
    });

    // Update webhook stats
    const newErrorCount = deliveryStatus === "delivered" ? 0 : webhook.errorCount + 1;
    const newStatus = newErrorCount >= 10 ? "error" : webhook.status;

    await db.webhookData.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date().toISOString(),
        lastStatus: responseStatus,
        totalDeliveries: webhook.totalDeliveries + 1,
        successDeliveries: webhook.successDeliveries + (deliveryStatus === "delivered" ? 1 : 0),
        errorCount: newErrorCount,
        status: newStatus as "active" | "paused" | "error" | "disabled",
      },
    });

    return dbToWebhookDelivery(deliveryRow);
  }

  /**
   * Build payload for a specific provider
   */
  private buildPayload(
    provider: WebhookProvider,
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const basePayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    switch (provider) {
      case "slack":
        return buildSlackPayload(event, data);
      case "discord":
        return buildDiscordPayload(event, data);
      case "zapier":
      case "make":
      case "custom":
      default:
        return basePayload;
    }
  }

  /**
   * Sign a payload with HMAC-SHA256
   */
  private signPayload(secret: string, payload: Record<string, unknown>): string {
    const str = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sha256=${secret.slice(0, 8)}${Math.abs(hash).toString(16)}`;
  }

  /**
   * Get delivery history — from SQLite
   */
  async getDeliveries(filters?: {
    webhookId?: string;
    event?: WebhookEvent;
    status?: WebhookDelivery["status"];
    limit?: number;
  }): Promise<WebhookDelivery[]> {
    const where: Record<string, unknown> = { userId: DEFAULT_USER_ID };
    if (filters?.webhookId) where.webhookId = filters.webhookId;
    if (filters?.event) where.event = filters.event;
    if (filters?.status) where.status = filters.status;

    const rows = await db.webhookDeliveryData.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit ?? 50,
    });

    return rows.map(dbToWebhookDelivery);
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(webhookId: string): Promise<{
    totalDeliveries: number;
    successRate: number;
    avgResponseTime: number | null;
    lastDelivery: string | null;
    errorStreak: number;
  }> {
    const row = await db.webhookData.findUnique({ where: { id: webhookId } });
    if (!row) {
      return { totalDeliveries: 0, successRate: 0, avgResponseTime: null, lastDelivery: null, errorStreak: 0 };
    }

    return {
      totalDeliveries: row.totalDeliveries,
      successRate: row.totalDeliveries > 0
        ? row.successDeliveries / row.totalDeliveries
        : 0,
      avgResponseTime: null,
      lastDelivery: row.lastTriggeredAt,
      errorStreak: row.errorCount,
    };
  }

  /**
   * Test a webhook by sending a ping event
   */
  async testWebhook(webhookId: string): Promise<WebhookDelivery> {
    const webhook = await this.getWebhook(webhookId);
    if (!webhook) {
      return {
        id: generateId(),
        webhookId,
        event: "notification.created",
        status: "failed",
        attempts: 0,
        request: { url: "", method: "POST", headers: {}, body: "{}" },
        response: null,
        createdAt: new Date().toISOString(),
        deliveredAt: null,
        nextRetryAt: null,
        error: "Webhook not found",
      };
    }

    return this.deliverToWebhook(webhook, "notification.created", {
      test: true,
      message: "Ping de test HERMES",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Load webhooks from external data — no-op, DB is source of truth
   */
  loadWebhooks(_webhooks: WebhookConfig[]): void {
    // Kept for backwards compatibility — DB is the source of truth
  }

  /**
   * Load deliveries from external data — no-op, DB is source of truth
   */
  loadDeliveries(_deliveries: WebhookDelivery[]): void {
    // Kept for backwards compatibility — DB is the source of truth
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

export const webhookEngine = new WebhookEngine();
export { WebhookEngine };
