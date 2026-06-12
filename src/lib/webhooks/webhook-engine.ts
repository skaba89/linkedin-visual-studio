// ─── Webhook Delivery Engine (Prisma-backed) ─────────────────────────

import {
  WebhookConfig,
  WebhookDelivery,
  WebhookEvent,
  WebhookProvider,
  WebhookStatus,
  buildSlackPayload,
  buildDiscordPayload,
} from "./types";
import { db, DEFAULT_USER_ID } from "@/lib/db";

// ─── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

/** Convert a Prisma Webhook row to the public WebhookConfig shape */
function toWebhookConfig(row: {
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
  lastTriggeredAt: Date | null;
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
    events: JSON.parse(row.events) as WebhookEvent[],
    status: row.status as WebhookStatus,
    headers: row.headers ? JSON.parse(row.headers) : undefined,
    retryCount: row.retryCount,
    retryDelayMs: row.retryDelayMs,
    timeoutMs: row.timeoutMs,
    lastTriggeredAt: row.lastTriggeredAt ? row.lastTriggeredAt.toISOString() : null,
    lastStatus: row.lastStatus,
    errorCount: row.errorCount,
    totalDeliveries: row.totalDeliveries,
    successDeliveries: row.successDeliveries,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Convert a Prisma WebhookDelivery row to the public WebhookDelivery shape */
function toWebhookDelivery(row: {
  id: string;
  webhookId: string;
  event: string;
  status: string;
  attempts: number;
  request: string;
  response: string | null;
  deliveredAt: Date | null;
  nextRetryAt: Date | null;
  error: string | null;
  createdAt: Date;
}): WebhookDelivery {
  return {
    id: row.id,
    webhookId: row.webhookId,
    event: row.event as WebhookEvent,
    status: row.status as WebhookDelivery["status"],
    attempts: row.attempts,
    request: JSON.parse(row.request),
    response: row.response ? JSON.parse(row.response) : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    nextRetryAt: row.nextRetryAt ? row.nextRetryAt.toISOString() : null,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Webhook Engine ─────────────────────────────────────────────────

class WebhookEngine {
  /**
   * Register a new webhook
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
    const row = await db.webhook.create({
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
      },
    });
    return toWebhookConfig(row);
  }

  /**
   * Get a webhook by ID
   */
  async getWebhook(id: string): Promise<WebhookConfig | null> {
    const row = await db.webhook.findUnique({ where: { id } });
    if (!row) return null;
    return toWebhookConfig(row);
  }

  /**
   * Get all webhooks
   */
  async getWebhooks(): Promise<WebhookConfig[]> {
    const rows = await db.webhook.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toWebhookConfig);
  }

  /**
   * Update a webhook
   */
  async updateWebhook(
    id: string,
    updates: Partial<Pick<WebhookConfig, "name" | "url" | "events" | "status" | "headers" | "retryCount" | "timeoutMs">>
  ): Promise<WebhookConfig | null> {
    const existing = await db.webhook.findUnique({ where: { id } });
    if (!existing) return null;

    const data: Record<string, unknown> = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.url !== undefined) data.url = updates.url;
    if (updates.events !== undefined) data.events = JSON.stringify(updates.events);
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.headers !== undefined) data.headers = updates.headers ? JSON.stringify(updates.headers) : null;
    if (updates.retryCount !== undefined) data.retryCount = updates.retryCount;
    if (updates.timeoutMs !== undefined) data.timeoutMs = updates.timeoutMs;

    const row = await db.webhook.update({
      where: { id },
      data,
    });
    return toWebhookConfig(row);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(id: string): Promise<boolean> {
    try {
      await db.webhook.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Toggle webhook status (pause/resume)
   */
  async toggleWebhook(id: string): Promise<WebhookConfig | null> {
    const existing = await db.webhook.findUnique({ where: { id } });
    if (!existing) return null;

    const newStatus = existing.status === "active" ? "paused" : "active";
    const row = await db.webhook.update({
      where: { id },
      data: { status: newStatus },
    });
    return toWebhookConfig(row);
  }

  /**
   * Find webhooks that listen to a specific event
   */
  async findWebhooksByEvent(event: WebhookEvent): Promise<WebhookConfig[]> {
    // SQLite: use LIKE to check if the event string is contained in the JSON array
    // The events column stores JSON like ["agent.completed","deal.won"]
    const rows = await db.webhook.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        status: "active",
        events: { contains: event },
      },
    });
    // Extra filter to ensure exact match (not partial substring)
    return rows
      .filter((row) => {
        const events: string[] = JSON.parse(row.events);
        return events.includes(event);
      })
      .map(toWebhookConfig);
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
    // Build the payload based on provider
    const payload = this.buildPayload(webhook.provider, event, data);

    const deliveryId = generateId();
    const requestObj = {
      url: webhook.url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "HERMES-Webhook/1.0",
        "X-Hermes-Event": event,
        "X-Hermes-Delivery": deliveryId,
        ...(webhook.secret ? { "X-Hermes-Signature": this.signPayload(webhook.secret, payload) } : {}),
        ...(webhook.headers ?? {}),
      },
      body: JSON.stringify(payload),
    };

    // Create initial delivery record in DB
    let dbDelivery = await db.webhookDelivery.create({
      data: {
        id: deliveryId,
        userId: DEFAULT_USER_ID,
        webhookId: webhook.id,
        event,
        status: "pending",
        attempts: 0,
        request: JSON.stringify(requestObj),
      },
    });

    let deliveryStatus: string = "pending";
    let attempts = 0;
    let responseObj: { status: number | null; body: string | null } | null = null;
    let deliveredAt: Date | null = null;
    let nextRetryAt: Date | null = null;
    let lastError: string | null = null;

    // Webhook stats updates
    let totalDeliveriesIncrement = 1;
    let successDeliveriesIncrement = 0;
    let newErrorCount = webhook.errorCount;
    let newLastStatus: number | null = null;
    let newLastTriggeredAt: Date = new Date();
    let newWebhookStatus: string | null = null;

    // Attempt delivery with retries
    const maxAttempts = webhook.retryCount + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), webhook.timeoutMs);

        const response = await fetch(webhook.url, {
          method: "POST",
          headers: requestObj.headers,
          body: requestObj.body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        responseObj = {
          status: response.status,
          body: await response.text().catch(() => null),
        };

        if (response.status >= 200 && response.status < 300) {
          deliveryStatus = "delivered";
          deliveredAt = new Date();
          newLastStatus = response.status;
          successDeliveriesIncrement = 1;
          newErrorCount = 0;
          break;
        } else {
          lastError = `HTTP ${response.status}`;
          newLastStatus = response.status;
          if (attempt < maxAttempts) {
            deliveryStatus = "retrying";
            nextRetryAt = new Date(Date.now() + webhook.retryDelayMs * attempt);
            await new Promise((r) => setTimeout(r, webhook.retryDelayMs));
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < maxAttempts) {
          deliveryStatus = "retrying";
          nextRetryAt = new Date(Date.now() + webhook.retryDelayMs * attempt);
          await new Promise((r) => setTimeout(r, webhook.retryDelayMs));
        }
      }
    }

    if (deliveryStatus !== "delivered") {
      deliveryStatus = "failed";
      newErrorCount = webhook.errorCount + 1;

      // Disable webhook after 10 consecutive errors
      if (newErrorCount >= 10) {
        newWebhookStatus = "error";
      }
    }

    // Update delivery record in DB
    dbDelivery = await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: deliveryStatus,
        attempts,
        response: responseObj ? JSON.stringify(responseObj) : null,
        deliveredAt,
        nextRetryAt,
        error: lastError,
      },
    });

    // Update webhook stats in DB
    const webhookUpdateData: Record<string, unknown> = {
      totalDeliveries: { increment: totalDeliveriesIncrement },
      lastTriggeredAt: newLastTriggeredAt,
    };
    if (successDeliveriesIncrement > 0) {
      webhookUpdateData.successDeliveries = { increment: successDeliveriesIncrement };
    }
    if (newLastStatus !== null) {
      webhookUpdateData.lastStatus = newLastStatus;
    }
    if (deliveryStatus === "delivered") {
      webhookUpdateData.errorCount = 0;
    } else {
      webhookUpdateData.errorCount = newErrorCount;
    }
    if (newWebhookStatus) {
      webhookUpdateData.status = newWebhookStatus;
    }

    await db.webhook.update({
      where: { id: webhook.id },
      data: webhookUpdateData,
    });

    return toWebhookDelivery(dbDelivery);
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
    // In production, use crypto.createHmac
    // For now, a simple hash representation
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
   * Get delivery history
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

    const rows = await db.webhookDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit ?? 50,
    });

    return rows.map(toWebhookDelivery);
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
    const webhook = await db.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) {
      return { totalDeliveries: 0, successRate: 0, avgResponseTime: null, lastDelivery: null, errorStreak: 0 };
    }

    return {
      totalDeliveries: webhook.totalDeliveries,
      successRate: webhook.totalDeliveries > 0
        ? webhook.successDeliveries / webhook.totalDeliveries
        : 0,
      avgResponseTime: null,
      lastDelivery: webhook.lastTriggeredAt ? webhook.lastTriggeredAt.toISOString() : null,
      errorStreak: webhook.errorCount,
    };
  }

  /**
   * Test a webhook by sending a ping event
   */
  async testWebhook(webhookId: string): Promise<WebhookDelivery> {
    const webhook = await this.getWebhook(webhookId);
    if (!webhook) {
      // Create a failed delivery record in DB
      const failedDelivery = await db.webhookDelivery.create({
        data: {
          userId: DEFAULT_USER_ID,
          webhookId,
          event: "notification.created",
          status: "failed",
          attempts: 0,
          request: JSON.stringify({ url: "", method: "POST", headers: {}, body: "{}" }),
          error: "Webhook not found",
        },
      });
      return toWebhookDelivery(failedDelivery);
    }

    return this.deliverToWebhook(webhook, "notification.created", {
      test: true,
      message: "Ping de test HERMÈS",
      timestamp: new Date().toISOString(),
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

export const webhookEngine = new WebhookEngine();
export { WebhookEngine };
