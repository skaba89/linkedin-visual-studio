import { NextRequest, NextResponse } from "next/server";
import { webhookEngine } from "@/lib/webhooks";
import { WebhookProvider, WebhookEvent } from "@/lib/webhooks";

// GET /api/data/webhooks — List webhooks and/or deliveries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDeliveries = searchParams.get("deliveries") === "true";
    const webhookId = searchParams.get("webhookId");
    const event = searchParams.get("event") as WebhookEvent | null;
    const status = searchParams.get("status") as "pending" | "delivered" | "failed" | "retrying" | null;
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const webhooks = await webhookEngine.getWebhooks();

    const result: Record<string, unknown> = { webhooks };

    if (includeDeliveries) {
      result.deliveries = await webhookEngine.getDeliveries({
        webhookId: webhookId ?? undefined,
        event: event ?? undefined,
        status: status ?? undefined,
        limit,
      });
    }

    if (webhookId) {
      const stats = await webhookEngine.getWebhookStats(webhookId);
      result.stats = stats;
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch webhooks", details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/data/webhooks — Register a new webhook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, provider, url, events, secret, headers, retryCount, timeoutMs } = body;

    if (!name || !provider || !url || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: "name, provider, url, and events[] are required" },
        { status: 400 }
      );
    }

    const webhook = await webhookEngine.registerWebhook({
      name,
      provider: provider as WebhookProvider,
      url,
      events: events as WebhookEvent[],
      secret,
      headers,
      retryCount,
      timeoutMs,
    });

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to register webhook", details: String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/data/webhooks — Update or toggle a webhook
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (action === "toggle") {
      const webhook = await webhookEngine.toggleWebhook(id);
      if (!webhook) {
        return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
      }
      return NextResponse.json({ webhook });
    }

    if (action === "test") {
      const delivery = await webhookEngine.testWebhook(id);
      return NextResponse.json({ delivery });
    }

    const webhook = await webhookEngine.updateWebhook(id, updates);
    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({ webhook });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update webhook", details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/data/webhooks — Delete a webhook
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const deleted = await webhookEngine.deleteWebhook(id);
    if (!deleted) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete webhook", details: String(error) },
      { status: 500 }
    );
  }
}
