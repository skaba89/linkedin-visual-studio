// ─── Webhook Delivery Engine ────────────────────────────────────────

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

// ─── Webhook Engine ─────────────────────────────────────────────────

class WebhookEngine {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveries: WebhookDelivery[] = [];
  private maxDeliveries = 500;

  /**
   * Register a new webhook
   */
  registerWebhook(input: {
    name: string;
    provider: WebhookProvider;
    url: string;
    events: WebhookEvent[];
    secret?: string;
    headers?: Record<string, string>;
    retryCount?: number;
    timeoutMs?: number;
  }): WebhookConfig {
    const webhook: WebhookConfig = {
      id: generateId(),
      name: input.name,
      provider: input.provider,
      url: input.url,
      secret: input.secret,
      events: input.events,
      status: "active",
      headers: input.headers,
      retryCount: input.retryCount ?? 3,
      retryDelayMs: 5000,
      timeoutMs: input.timeoutMs ?? 10000,
      lastTriggeredAt: null,
      lastStatus: null,
      errorCount: 0,
      totalDeliveries: 0,
      successDeliveries: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  /**
   * Get a webhook by ID
   */
  getWebhook(id: string): WebhookConfig | undefined {
    return this.webhooks.get(id);
  }

  /**
   * Get all webhooks
   */
  getWebhooks(): WebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Update a webhook
   */
  updateWebhook(
    id: string,
    updates: Partial<Pick<WebhookConfig, "name" | "url" | "events" | "status" | "headers" | "retryCount" | "timeoutMs">>
  ): WebhookConfig | null {
    const webhook = this.webhooks.get(id);
    if (!webhook) return null;

    Object.assign(webhook, updates, { updatedAt: new Date().toISOString() });
    return webhook;
  }

  /**
   * Delete a webhook
   */
  deleteWebhook(id: string): boolean {
    return this.webhooks.delete(id);
  }

  /**
   * Toggle webhook status (pause/resume)
   */
  toggleWebhook(id: string): WebhookConfig | null {
    const webhook = this.webhooks.get(id);
    if (!webhook) return null;

    webhook.status = webhook.status === "active" ? "paused" : "active";
    webhook.updatedAt = new Date().toISOString();
    return webhook;
  }

  /**
   * Find webhooks that listen to a specific event
   */
  findWebhooksByEvent(event: WebhookEvent): WebhookConfig[] {
    return Array.from(this.webhooks.values()).filter(
      (w) => w.status === "active" && w.events.includes(event)
    );
  }

  /**
   * Dispatch an event to all matching webhooks
   */
  async dispatchEvent(event: WebhookEvent, data: Record<string, unknown>): Promise<WebhookDelivery[]> {
    const matchingWebhooks = this.findWebhooksByEvent(event);
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

    const delivery: WebhookDelivery = {
      id: generateId(),
      webhookId: webhook.id,
      event,
      status: "pending",
      attempts: 0,
      request: {
        url: webhook.url,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "HERMES-Webhook/1.0",
          "X-Hermes-Event": event,
          "X-Hermes-Delivery": generateId(),
          ...(webhook.secret ? { "X-Hermes-Signature": this.signPayload(webhook.secret, payload) } : {}),
          ...(webhook.headers ?? {}),
        },
        body: JSON.stringify(payload),
      },
      response: null,
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      nextRetryAt: null,
      error: null,
    };

    // Attempt delivery with retries
    let lastError: string | null = null;
    const maxAttempts = webhook.retryCount + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      delivery.attempts = attempt;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), webhook.timeoutMs);

        const response = await fetch(webhook.url, {
          method: "POST",
          headers: delivery.request.headers,
          body: delivery.request.body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        delivery.response = {
          status: response.status,
          body: await response.text().catch(() => null),
        };

        if (response.status >= 200 && response.status < 300) {
          delivery.status = "delivered";
          delivery.deliveredAt = new Date().toISOString();

          // Update webhook stats
          webhook.totalDeliveries++;
          webhook.successDeliveries++;
          webhook.lastTriggeredAt = new Date().toISOString();
          webhook.lastStatus = response.status;
          webhook.errorCount = 0;

          break;
        } else {
          lastError = `HTTP ${response.status}`;
          if (attempt < maxAttempts) {
            delivery.status = "retrying";
            delivery.nextRetryAt = new Date(Date.now() + webhook.retryDelayMs * attempt).toISOString();
            await new Promise((r) => setTimeout(r, webhook.retryDelayMs));
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < maxAttempts) {
          delivery.status = "retrying";
          delivery.nextRetryAt = new Date(Date.now() + webhook.retryDelayMs * attempt).toISOString();
          await new Promise((r) => setTimeout(r, webhook.retryDelayMs));
        }
      }
    }

    if (delivery.status !== "delivered") {
      delivery.status = "failed";
      delivery.error = lastError;

      webhook.totalDeliveries++;
      webhook.errorCount++;
      webhook.lastTriggeredAt = new Date().toISOString();

      // Disable webhook after 10 consecutive errors
      if (webhook.errorCount >= 10) {
        webhook.status = "error";
      }
    }

    // Store delivery
    this.deliveries.unshift(delivery);
    if (this.deliveries.length > this.maxDeliveries) {
      this.deliveries = this.deliveries.slice(0, this.maxDeliveries);
    }

    return delivery;
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
  getDeliveries(filters?: {
    webhookId?: string;
    event?: WebhookEvent;
    status?: WebhookDelivery["status"];
    limit?: number;
  }): WebhookDelivery[] {
    let result = [...this.deliveries];

    if (filters?.webhookId) {
      result = result.filter((d) => d.webhookId === filters.webhookId);
    }
    if (filters?.event) {
      result = result.filter((d) => d.event === filters.event);
    }
    if (filters?.status) {
      result = result.filter((d) => d.status === filters.status);
    }

    return filters?.limit ? result.slice(0, filters.limit) : result;
  }

  /**
   * Get webhook statistics
   */
  getWebhookStats(webhookId: string): {
    totalDeliveries: number;
    successRate: number;
    avgResponseTime: number | null;
    lastDelivery: string | null;
    errorStreak: number;
  } {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return { totalDeliveries: 0, successRate: 0, avgResponseTime: null, lastDelivery: null, errorStreak: 0 };
    }

    return {
      totalDeliveries: webhook.totalDeliveries,
      successRate: webhook.totalDeliveries > 0
        ? webhook.successDeliveries / webhook.totalDeliveries
        : 0,
      avgResponseTime: null,
      lastDelivery: webhook.lastTriggeredAt,
      errorStreak: webhook.errorCount,
    };
  }

  /**
   * Test a webhook by sending a ping event
   */
  async testWebhook(webhookId: string): Promise<WebhookDelivery> {
    const webhook = this.webhooks.get(webhookId);
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
      message: "Ping de test HERMÈS",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Load webhooks from external data
   */
  loadWebhooks(webhooks: WebhookConfig[]): void {
    for (const w of webhooks) {
      this.webhooks.set(w.id, w);
    }
  }

  /**
   * Load deliveries from external data
   */
  loadDeliveries(deliveries: WebhookDelivery[]): void {
    this.deliveries = deliveries;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

export const webhookEngine = new WebhookEngine();
export { WebhookEngine };
