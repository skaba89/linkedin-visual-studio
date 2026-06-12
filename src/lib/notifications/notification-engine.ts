// ─── Notification Engine — Prisma-persisted (BUG-H2 fix) ──────────────

import { db, DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/db";
import {
  Notification,
  NotificationCategory,
  NotificationPreference,
  NotificationPriority,
  NotificationStats,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "./types";

// ─── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// ─── DB ↔ Type Mappers ──────────────────────────────────────────────

function dbToNotification(row: {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  read: boolean;
  dismissed: boolean;
  actionUrl: string | null;
  actionLabel: string | null;
  sourceAgent: string | null;
  sourceWorkflow: string | null;
  metadata: string | null;
  readAt: string | null;
  expiresAt: string | null;
  createdAt: Date;
}): Notification {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    category: row.category as NotificationCategory,
    priority: row.priority as NotificationPriority,
    read: row.read,
    dismissed: row.dismissed,
    actionUrl: row.actionUrl ?? undefined,
    actionLabel: row.actionLabel ?? undefined,
    sourceAgent: row.sourceAgent ?? undefined,
    sourceWorkflow: row.sourceWorkflow ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    readAt: row.readAt ?? undefined,
    expiresAt: row.expiresAt ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Priority ranking for comparison ────────────────────────────────

const PRIORITY_RANK: Record<NotificationPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

// ─── Notification Engine (Prisma-backed) ────────────────────────────

class NotificationEngine {
  private preferences: NotificationPreference[] = [...DEFAULT_NOTIFICATION_PREFERENCES];
  private listeners: Array<(notification: Notification) => void> = [];

  /**
   * Create and dispatch a new notification — persisted to SQLite
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
    await ensureDefaultUser();
    const priority = input.priority ?? "medium";

    // Check if this notification should be suppressed by preferences
    const pref = this.preferences.find((p) => p.category === input.category);
    if (pref && (!pref.enabled || PRIORITY_RANK[priority] < PRIORITY_RANK[pref.minPriority])) {
      const suppressed: Notification = {
        id: generateId(),
        ...input,
        priority,
        read: false,
        dismissed: true,
        createdAt: new Date().toISOString(),
        expiresAt: input.expiresAt,
      };
      return suppressed;
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
        // Still create the notification (just don't alert listeners)
        const row = await db.notificationData.create({
          data: {
            userId: DEFAULT_USER_ID,
            title: input.title,
            message: input.message,
            category: input.category,
            priority,
            read: false,
            dismissed: false,
            actionUrl: input.actionUrl ?? null,
            actionLabel: input.actionLabel ?? null,
            sourceAgent: input.sourceAgent ?? null,
            sourceWorkflow: input.sourceWorkflow ?? null,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
            expiresAt: input.expiresAt ?? null,
          },
        });
        return dbToNotification(row);
      }
    }

    const row = await db.notificationData.create({
      data: {
        userId: DEFAULT_USER_ID,
        title: input.title,
        message: input.message,
        category: input.category,
        priority,
        read: false,
        dismissed: false,
        actionUrl: input.actionUrl ?? null,
        actionLabel: input.actionLabel ?? null,
        sourceAgent: input.sourceAgent ?? null,
        sourceWorkflow: input.sourceWorkflow ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        expiresAt: input.expiresAt ?? null,
      },
    });

    const notification = dbToNotification(row);

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
   * Get all notifications with optional filters — from SQLite
   */
  async getNotifications(filters?: {
    category?: NotificationCategory;
    priority?: NotificationPriority;
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<Notification[]> {
    const where: Record<string, unknown> = { userId: DEFAULT_USER_ID, dismissed: false };

    if (filters?.category) where.category = filters.category;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.unreadOnly) where.read = false;

    const rows = await db.notificationData.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit ?? 100,
    });

    const now = new Date().toISOString();
    return rows
      .filter((r) => !r.expiresAt || r.expiresAt > now)
      .map(dbToNotification);
  }

  /**
   * Get a single notification by ID
   */
  async getNotification(id: string): Promise<Notification | null> {
    const row = await db.notificationData.findUnique({ where: { id } });
    if (!row) return null;
    return dbToNotification(row);
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string): Promise<Notification | null> {
    try {
      const row = await db.notificationData.update({
        where: { id },
        data: { read: true, readAt: new Date().toISOString() },
      });
      return dbToNotification(row);
    } catch {
      return null;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<number> {
    const result = await db.notificationData.updateMany({
      where: { userId: DEFAULT_USER_ID, read: false, dismissed: false },
      data: { read: true, readAt: new Date().toISOString() },
    });
    return result.count;
  }

  /**
   * Dismiss a notification
   */
  async dismiss(id: string): Promise<boolean> {
    try {
      await db.notificationData.update({
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
    const result = await db.notificationData.updateMany({
      where: { userId: DEFAULT_USER_ID, dismissed: false },
      data: { dismissed: true },
    });
    return result.count;
  }

  /**
   * Get notification statistics — from SQLite
   */
  async getStats(): Promise<NotificationStats> {
    const rows = await db.notificationData.findMany({
      where: { userId: DEFAULT_USER_ID, dismissed: false },
    });

    const today = new Date().toISOString().split("T")[0];

    const byCategory: Record<NotificationCategory, number> = {
      agent: 0, lead: 0, deal: 0, email: 0, linkedin: 0,
      compliance: 0, workflow: 0, system: 0,
    };
    const byPriority: Record<NotificationPriority, number> = {
      low: 0, medium: 0, high: 0, critical: 0,
    };

    for (const n of rows) {
      byCategory[n.category as NotificationCategory]++;
      byPriority[n.priority as NotificationPriority]++;
    }

    return {
      total: rows.length,
      unread: rows.filter((n) => !n.read).length,
      byCategory,
      byPriority,
      todayCount: rows.filter((n) => n.createdAt.toISOString().startsWith(today)).length,
    };
  }

  /**
   * Get notification preferences (in-memory, not persisted)
   */
  getPreferences(): NotificationPreference[] {
    return [...this.preferences];
  }

  /**
   * Update a notification preference
   */
  updatePreference(
    category: NotificationCategory,
    updates: Partial<Omit<NotificationPreference, "category">>
  ): NotificationPreference | null {
    const pref = this.preferences.find((p) => p.category === category);
    if (!pref) return null;
    Object.assign(pref, updates);
    return pref;
  }

  /**
   * Load notifications from external data — no-op, DB is source of truth
   */
  loadNotifications(_notifications: Notification[]): void {
    // Kept for backwards compatibility — DB is the source of truth
  }

  /**
   * Load preferences from external data
   */
  loadPreferences(preferences: NotificationPreference[]): void {
    this.preferences = preferences;
  }

  /**
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    await db.notificationData.deleteMany({
      where: { userId: DEFAULT_USER_ID },
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

export const notificationEngine = new NotificationEngine();
export { NotificationEngine };
