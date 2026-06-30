// ─── Notification Engine (Prisma-backed, multi-tenant) ───────────────
//
// HERMÈS — R-002 deep — Refactored to be multi-tenant safe.
//
// Every method now requires an explicit `userId` parameter (obtained from
// `requireUser()` in the route handler). The previous version hardcoded
// `DEFAULT_USER_ID = "default"`, which meant every user saw the same
// shared notification feed — a multi-tenant data leak.
//
// Methods that mutate a single notification by id (`getNotification`,
// `markAsRead`, `dismiss`) additionally verify ownership before
// returning/modifying, closing an IDOR gap (a user could otherwise read
// or dismiss another user's notification by guessing its id).

import {
  Notification,
  NotificationCategory,
  NotificationPreference,
  NotificationPriority,
  NotificationStats,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "./types";
import { db } from "@/lib/db";
import { parseJsonField, stringifyJsonField } from "@/lib/json-field";
import { HttpError } from "@/lib/http-error";

// ─── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// ─── Priority ranking for comparison ────────────────────────────────

const PRIORITY_RANK: Record<NotificationPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

// ─── DB → TS mappers ────────────────────────────────────────────────

type DbNotification = Awaited<ReturnType<typeof db.notification.findFirst>> & {};

function mapDbNotificationToTs(row: DbNotification): Notification {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    category: row.category as NotificationCategory,
    priority: row.priority as NotificationPriority,
    actionUrl: row.actionUrl ?? undefined,
    actionLabel: row.actionLabel ?? undefined,
    sourceAgent: row.sourceAgent ?? undefined,
    sourceWorkflow: row.sourceWorkflow ?? undefined,
    metadata: parseJsonField<Record<string, unknown> | undefined>(row.metadata as string | null | undefined, undefined),
    read: row.read,
    readAt: row.readAt?.toISOString() ?? undefined,
    dismissed: row.dismissed,
    expiresAt: row.expiresAt?.toISOString() ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

type DbNotificationPreference = Awaited<ReturnType<typeof db.notificationPreference.findFirst>> & {};

function mapDbPrefToTs(row: DbNotificationPreference): NotificationPreference {
  return {
    category: row.category as NotificationCategory,
    enabled: row.enabled,
    minPriority: row.minPriority as NotificationPriority,
    quietHoursEnabled: row.quietHoursEnabled,
    quietHoursStart: row.quietHoursStart || undefined,
    quietHoursEnd: row.quietHoursEnd || undefined,
    // DB model does not store channels; default to in_app
    channels: ["in_app"],
  };
}

// ─── Notification Engine ────────────────────────────────────────────

class NotificationEngine {
  private listeners: Array<(notification: Notification) => void> = [];
  /**
   * Per-user preference-seed flag. Replaces the previous boolean which
   * assumed a single shared user. Now we track which users have already
   * been seeded in this process to avoid repeated DB checks.
   */
  private preferencesSeeded = new Set<string>();

  /**
   * Create and dispatch a new notification for the given user.
   *
   * @param userId — the authenticated user's id (from `requireUser()`)
   */
  async notify(userId: string, input: {
    title: string;
    message: string;
    category: NotificationCategory;
    priority?: NotificationPriority;
    actionUrl?: string;
    actionLabel?: string;
    sourceAgent?: string;
    sourceWorkflow?: string;
    metadata?: Record<string, unknown>;
    expiresAt?: string;
  }): Promise<Notification> {
    if (!userId) throw new HttpError(401, "userId is required", "AUTH_REQUIRED");
    const priority = input.priority ?? "medium";

    // Check if this notification should be suppressed by preferences
    const pref = await db.notificationPreference.findUnique({
      where: { userId_category: { userId, category: input.category } },
    });

    if (pref && (!pref.enabled || PRIORITY_RANK[priority] < PRIORITY_RANK[pref.minPriority as NotificationPriority])) {
      // Still create it but mark as dismissed (suppressed)
      const suppressed = await db.notification.create({
        data: {
          userId,
          title: input.title,
          message: input.message,
          category: input.category,
          priority,
          actionUrl: input.actionUrl ?? null,
          actionLabel: input.actionLabel ?? null,
          sourceAgent: input.sourceAgent ?? null,
          sourceWorkflow: input.sourceWorkflow ?? null,
          metadata: input.metadata ? stringifyJsonField(input.metadata) : null,
          read: false,
          dismissed: true,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });
      return mapDbNotificationToTs(suppressed);
    }

    // Check quiet hours
    if (pref?.quietHoursEnabled && pref.quietHoursStart && pref.quietHoursEnd) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [startH, startM] = pref.quietHoursStart.split(":").map(Number);
      const [endH, endM] = pref.quietHoursEnd.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      const inQuietHours = startMinutes < endMinutes
        ? currentMinutes >= startMinutes && currentMinutes < endMinutes
        : currentMinutes >= startMinutes || currentMinutes < endMinutes;

      if (inQuietHours && PRIORITY_RANK[priority] < PRIORITY_RANK["critical"]) {
        // Queue for after quiet hours (in real app), for now just create
        const notif = await db.notification.create({
          data: {
            userId,
            title: input.title,
            message: input.message,
            category: input.category,
            priority,
            actionUrl: input.actionUrl ?? null,
            actionLabel: input.actionLabel ?? null,
            sourceAgent: input.sourceAgent ?? null,
            sourceWorkflow: input.sourceWorkflow ?? null,
            metadata: input.metadata ? stringifyJsonField(input.metadata) : null,
            read: false,
            dismissed: false,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          },
        });
        return mapDbNotificationToTs(notif);
      }
    }

    const row = await db.notification.create({
      data: {
        userId,
        title: input.title,
        message: input.message,
        category: input.category,
        priority,
        actionUrl: input.actionUrl ?? null,
        actionLabel: input.actionLabel ?? null,
        sourceAgent: input.sourceAgent ?? null,
        sourceWorkflow: input.sourceWorkflow ?? null,
        metadata: input.metadata ? stringifyJsonField(input.metadata) : null,
        read: false,
        dismissed: false,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    const notification = mapDbNotificationToTs(row);

    // Notify listeners (for real-time UI updates)
    for (const listener of this.listeners) {
      try {
        listener(notification);
      } catch {
        // Ignore listener errors
      }
    }

    return notification;
  }

  /**
   * Subscribe to new notifications
   */
  onNotification(listener: (notification: Notification) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get all notifications for the given user with optional filters.
   *
   * @param userId — the authenticated user's id
   */
  async getNotifications(userId: string, filters?: {
    category?: NotificationCategory;
    priority?: NotificationPriority;
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<Notification[]> {
    if (!userId) return [];
    const where: Record<string, unknown> = {
      userId,
      dismissed: false,
    };

    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.priority) {
      where.priority = filters.priority;
    }
    if (filters?.unreadOnly) {
      where.read = false;
    }

    const rows = await db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit ?? undefined,
    });

    // Filter out expired notifications
    const now = new Date().toISOString();
    const active = rows.filter((r) => !r.expiresAt || r.expiresAt.toISOString() > now);

    return active.map(mapDbNotificationToTs);
  }

  /**
   * Get a single notification by ID, scoped to the given user.
   * Returns `null` if the notification doesn't exist OR belongs to another
   * user (no existence leak).
   *
   * @param userId — the authenticated user's id
   * @param id     — the notification id
   */
  async getNotification(userId: string, id: string): Promise<Notification | null> {
    if (!userId || !id) return null;
    const row = await db.notification.findFirst({
      where: { id, userId },
    });
    if (!row) return null;
    return mapDbNotificationToTs(row);
  }

  /**
   * Mark a notification as read.
   * Only succeeds if the notification belongs to the given user.
   *
   * @param userId — the authenticated user's id
   * @param id     — the notification id
   */
  async markAsRead(userId: string, id: string): Promise<Notification | null> {
    if (!userId || !id) return null;
    try {
      // Use updateMany with userId filter so we don't leak existence
      // (returns count=0 if the notification belongs to someone else)
      const result = await db.notification.updateMany({
        where: { id, userId },
        data: { read: true, readAt: new Date() },
      });
      if (result.count === 0) return null;
      const row = await db.notification.findUnique({ where: { id } });
      return row ? mapDbNotificationToTs(row) : null;
    } catch {
      return null;
    }
  }

  /**
   * Mark all notifications as read for the given user.
   *
   * @param userId — the authenticated user's id
   */
  async markAllAsRead(userId: string): Promise<number> {
    if (!userId) return 0;
    const result = await db.notification.updateMany({
      where: {
        userId,
        read: false,
        dismissed: false,
      },
      data: { read: true, readAt: new Date() },
    });
    return result.count;
  }

  /**
   * Dismiss a notification.
   * Only succeeds if the notification belongs to the given user.
   *
   * @param userId — the authenticated user's id
   * @param id     — the notification id
   */
  async dismiss(userId: string, id: string): Promise<boolean> {
    if (!userId || !id) return false;
    try {
      const result = await db.notification.updateMany({
        where: { id, userId },
        data: { dismissed: true },
      });
      return result.count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Dismiss all notifications for the given user.
   *
   * @param userId — the authenticated user's id
   */
  async dismissAll(userId: string): Promise<number> {
    if (!userId) return 0;
    const result = await db.notification.updateMany({
      where: {
        userId,
        dismissed: false,
      },
      data: { dismissed: true },
    });
    return result.count;
  }

  /**
   * Get notification statistics for the given user.
   *
   * @param userId — the authenticated user's id
   */
  async getStats(userId: string): Promise<NotificationStats> {
    if (!userId) {
      return {
        total: 0, unread: 0,
        byCategory: { agent: 0, lead: 0, deal: 0, email: 0, linkedin: 0, compliance: 0, workflow: 0, system: 0 },
        byPriority: { low: 0, medium: 0, high: 0, critical: 0 },
        todayCount: 0,
      };
    }
    const active = await db.notification.findMany({
      where: {
        userId,
        dismissed: false,
      },
    });

    const byCategory: Record<NotificationCategory, number> = {
      agent: 0, lead: 0, deal: 0, email: 0, linkedin: 0,
      compliance: 0, workflow: 0, system: 0,
    };
    const byPriority: Record<NotificationPriority, number> = {
      low: 0, medium: 0, high: 0, critical: 0,
    };

    const today = new Date().toISOString().split("T")[0];
    let todayCount = 0;
    let unread = 0;

    for (const n of active) {
      const cat = n.category as NotificationCategory;
      const pri = n.priority as NotificationPriority;
      if (cat in byCategory) byCategory[cat]++;
      if (pri in byPriority) byPriority[pri]++;
      if (!n.read) unread++;
      if (n.createdAt.toISOString().startsWith(today)) todayCount++;
    }

    return {
      total: active.length,
      unread,
      byCategory,
      byPriority,
      todayCount,
    };
  }

  /**
   * Ensure preferences are seeded for the given user.
   * Idempotent — only inserts if no preferences exist yet for this user.
   *
   * @param userId — the authenticated user's id
   */
  private async ensurePreferencesSeeded(userId: string): Promise<void> {
    if (!userId) return;
    if (this.preferencesSeeded.has(userId)) return;

    const existing = await db.notificationPreference.findMany({
      where: { userId },
    });

    if (existing.length === 0) {
      // Seed from defaults
      await db.notificationPreference.createMany({
        data: DEFAULT_NOTIFICATION_PREFERENCES.map((p) => ({
          userId,
          category: p.category,
          enabled: p.enabled,
          minPriority: p.minPriority,
          quietHoursEnabled: p.quietHoursEnabled,
          quietHoursStart: p.quietHoursStart ?? "",
          quietHoursEnd: p.quietHoursEnd ?? "",
        })),
      });
    }

    this.preferencesSeeded.add(userId);
  }

  /**
   * Get notification preferences for the given user.
   *
   * @param userId — the authenticated user's id
   */
  async getPreferences(userId: string): Promise<NotificationPreference[]> {
    if (!userId) return [];
    await this.ensurePreferencesSeeded(userId);

    const rows = await db.notificationPreference.findMany({
      where: { userId },
    });

    return rows.map(mapDbPrefToTs);
  }

  /**
   * Update a notification preference for the given user.
   *
   * @param userId   — the authenticated user's id
   * @param category — the preference category to update
   * @param updates  — partial preference updates
   */
  async updatePreference(
    userId: string,
    category: NotificationCategory,
    updates: Partial<Omit<NotificationPreference, "category">>
  ): Promise<NotificationPreference | null> {
    if (!userId) return null;
    await this.ensurePreferencesSeeded(userId);

    const data: Record<string, unknown> = {};
    if (updates.enabled !== undefined) data.enabled = updates.enabled;
    if (updates.minPriority !== undefined) data.minPriority = updates.minPriority;
    if (updates.quietHoursEnabled !== undefined) data.quietHoursEnabled = updates.quietHoursEnabled;
    if (updates.quietHoursStart !== undefined) data.quietHoursStart = updates.quietHoursStart;
    if (updates.quietHoursEnd !== undefined) data.quietHoursEnd = updates.quietHoursEnd;

    try {
      const row = await db.notificationPreference.upsert({
        where: { userId_category: { userId, category } },
        update: data,
        create: {
          userId,
          category,
          enabled: updates.enabled ?? true,
          minPriority: updates.minPriority ?? "low",
          quietHoursEnabled: updates.quietHoursEnabled ?? false,
          quietHoursStart: updates.quietHoursStart ?? "",
          quietHoursEnd: updates.quietHoursEnd ?? "",
        },
      });
      return mapDbPrefToTs(row);
    } catch {
      return null;
    }
  }

  /**
   * Clear all notifications for the given user.
   *
   * @param userId — the authenticated user's id
   */
  async clearAll(userId: string): Promise<void> {
    if (!userId) return;
    await db.notification.deleteMany({
      where: { userId },
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

export const notificationEngine = new NotificationEngine();
export { NotificationEngine };
