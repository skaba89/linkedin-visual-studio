// ─── Notification Engine (Prisma-backed) ─────────────────────────────

import {
  Notification,
  NotificationCategory,
  NotificationPreference,
  NotificationPriority,
  NotificationStats,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "./types";
import { db, DEFAULT_USER_ID } from "@/lib/db";

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
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
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
  private preferencesSeeded = false;

  /**
   * Create and dispatch a new notification
   */
  async notify(input: {
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
    const priority = input.priority ?? "medium";

    // Check if this notification should be suppressed by preferences
    const pref = await db.notificationPreference.findUnique({
      where: { category: input.category },
    });

    if (pref && (!pref.enabled || PRIORITY_RANK[priority] < PRIORITY_RANK[pref.minPriority as NotificationPriority])) {
      // Still create it but mark as dismissed (suppressed)
      const suppressed = await db.notification.create({
        data: {
          userId: DEFAULT_USER_ID,
          title: input.title,
          message: input.message,
          category: input.category,
          priority,
          actionUrl: input.actionUrl ?? null,
          actionLabel: input.actionLabel ?? null,
          sourceAgent: input.sourceAgent ?? null,
          sourceWorkflow: input.sourceWorkflow ?? null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
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
            userId: DEFAULT_USER_ID,
            title: input.title,
            message: input.message,
            category: input.category,
            priority,
            actionUrl: input.actionUrl ?? null,
            actionLabel: input.actionLabel ?? null,
            sourceAgent: input.sourceAgent ?? null,
            sourceWorkflow: input.sourceWorkflow ?? null,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
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
        userId: DEFAULT_USER_ID,
        title: input.title,
        message: input.message,
        category: input.category,
        priority,
        actionUrl: input.actionUrl ?? null,
        actionLabel: input.actionLabel ?? null,
        sourceAgent: input.sourceAgent ?? null,
        sourceWorkflow: input.sourceWorkflow ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
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
   * Get all notifications with optional filters
   */
  async getNotifications(filters?: {
    category?: NotificationCategory;
    priority?: NotificationPriority;
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<Notification[]> {
    const where: Record<string, unknown> = {
      userId: DEFAULT_USER_ID,
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
   * Get a single notification by ID
   */
  async getNotification(id: string): Promise<Notification | null> {
    const row = await db.notification.findUnique({ where: { id } });
    if (!row) return null;
    return mapDbNotificationToTs(row);
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string): Promise<Notification | null> {
    try {
      const row = await db.notification.update({
        where: { id },
        data: { read: true, readAt: new Date() },
      });
      return mapDbNotificationToTs(row);
    } catch {
      return null;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<number> {
    const result = await db.notification.updateMany({
      where: {
        userId: DEFAULT_USER_ID,
        read: false,
        dismissed: false,
      },
      data: { read: true, readAt: new Date() },
    });
    return result.count;
  }

  /**
   * Dismiss a notification
   */
  async dismiss(id: string): Promise<boolean> {
    try {
      await db.notification.update({
        where: { id },
        data: { dismissed: true },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Dismiss all notifications
   */
  async dismissAll(): Promise<number> {
    const result = await db.notification.updateMany({
      where: {
        userId: DEFAULT_USER_ID,
        dismissed: false,
      },
      data: { dismissed: true },
    });
    return result.count;
  }

  /**
   * Get notification statistics
   */
  async getStats(): Promise<NotificationStats> {
    const active = await db.notification.findMany({
      where: {
        userId: DEFAULT_USER_ID,
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
   * Ensure preferences are seeded for the default user
   */
  private async ensurePreferencesSeeded(): Promise<void> {
    if (this.preferencesSeeded) return;

    const existing = await db.notificationPreference.findMany({
      where: { userId: DEFAULT_USER_ID },
    });

    if (existing.length === 0) {
      // Seed from defaults
      await db.notificationPreference.createMany({
        data: DEFAULT_NOTIFICATION_PREFERENCES.map((p) => ({
          userId: DEFAULT_USER_ID,
          category: p.category,
          enabled: p.enabled,
          minPriority: p.minPriority,
          quietHoursEnabled: p.quietHoursEnabled,
          quietHoursStart: p.quietHoursStart ?? "",
          quietHoursEnd: p.quietHoursEnd ?? "",
        })),
      });
    }

    this.preferencesSeeded = true;
  }

  /**
   * Get notification preferences
   */
  async getPreferences(): Promise<NotificationPreference[]> {
    await this.ensurePreferencesSeeded();

    const rows = await db.notificationPreference.findMany({
      where: { userId: DEFAULT_USER_ID },
    });

    return rows.map(mapDbPrefToTs);
  }

  /**
   * Update a notification preference
   */
  async updatePreference(
    category: NotificationCategory,
    updates: Partial<Omit<NotificationPreference, "category">>
  ): Promise<NotificationPreference | null> {
    await this.ensurePreferencesSeeded();

    const data: Record<string, unknown> = {};
    if (updates.enabled !== undefined) data.enabled = updates.enabled;
    if (updates.minPriority !== undefined) data.minPriority = updates.minPriority;
    if (updates.quietHoursEnabled !== undefined) data.quietHoursEnabled = updates.quietHoursEnabled;
    if (updates.quietHoursStart !== undefined) data.quietHoursStart = updates.quietHoursStart;
    if (updates.quietHoursEnd !== undefined) data.quietHoursEnd = updates.quietHoursEnd;

    try {
      const row = await db.notificationPreference.upsert({
        where: { category },
        update: data,
        create: {
          userId: DEFAULT_USER_ID,
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
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    await db.notification.deleteMany({
      where: { userId: DEFAULT_USER_ID },
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

export const notificationEngine = new NotificationEngine();
export { NotificationEngine };
