/**
 * HERMÈS — R-001 / R-002 deep — /api/data/notifications
 *
 * R-001: requireUser() at the boundary authenticates the request.
 * R-002 deep: every notificationEngine call now receives `user.id`
 *   so notifications are scoped per user (no more shared DEFAULT_USER_ID).
 */
import { NextRequest, NextResponse } from "next/server";
import { notificationEngine } from "@/lib/notifications";
import { NotificationCategory, NotificationPriority } from "@/lib/notifications";
import { requireUser } from "@/lib/session";
import { isHttpError } from "@/lib/http-error";

// GET /api/data/notifications — List notifications with optional filters
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as NotificationCategory | null;
    const priority = searchParams.get("priority") as NotificationPriority | null;
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const statsOnly = searchParams.get("stats") === "true";

    if (statsOnly) {
      const stats = await notificationEngine.getStats(user.id);
      return NextResponse.json({ stats });
    }

    const preferences = searchParams.get("preferences") === "true";
    if (preferences) {
      const prefs = await notificationEngine.getPreferences(user.id);
      return NextResponse.json({ preferences: prefs });
    }

    const notifications = await notificationEngine.getNotifications(user.id, {
      category: category ?? undefined,
      priority: priority ?? undefined,
      unreadOnly: unreadOnly || undefined,
      limit,
    });

    const stats = await notificationEngine.getStats(user.id);

    return NextResponse.json({ notifications, stats });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Failed to fetch notifications", details: String(err) },
      { status: 500 },
    );
  }
}

// POST /api/data/notifications — Create a new notification
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { title, message, category, priority, actionUrl, actionLabel, sourceAgent, sourceWorkflow, metadata, expiresAt } = body;

    if (!title || !message || !category) {
      return NextResponse.json(
        { error: "title, message, and category are required" },
        { status: 400 },
      );
    }

    const notification = await notificationEngine.notify(user.id, {
      title,
      message,
      category,
      priority: priority ?? "medium",
      actionUrl,
      actionLabel,
      sourceAgent,
      sourceWorkflow,
      metadata,
      expiresAt,
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Failed to create notification", details: String(err) },
      { status: 500 },
    );
  }
}

// PUT /api/data/notifications — Update notifications
export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { action, id, category, updates } = body;

    switch (action) {
      case "markRead": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const notif = await notificationEngine.markAsRead(user.id, id);
        return NextResponse.json({ notification: notif });
      }
      case "markAllRead": {
        const count = await notificationEngine.markAllAsRead(user.id);
        return NextResponse.json({ markedCount: count });
      }
      case "dismiss": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const dismissed = await notificationEngine.dismiss(user.id, id);
        return NextResponse.json({ dismissed });
      }
      case "dismissAll": {
        const count = await notificationEngine.dismissAll(user.id);
        return NextResponse.json({ dismissedCount: count });
      }
      case "updatePreference": {
        if (!category) return NextResponse.json({ error: "category required" }, { status: 400 });
        const pref = await notificationEngine.updatePreference(user.id, category, updates);
        return NextResponse.json({ preference: pref });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    return NextResponse.json(
      { error: "Failed to update notification", details: String(err) },
      { status: 500 },
    );
  }
}
