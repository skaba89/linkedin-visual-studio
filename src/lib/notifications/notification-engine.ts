// ─── Notification Engine ────────────────────────────────────────────

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

// ─── Priority ranking for comparison ────────────────────────────────

const PRIORITY_RANK: Record<NotificationPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

// ─── Notification Engine ────────────────────────────────────────────

class NotificationEngine {
  private notifications: Notification[] = [];
  private preferences: NotificationPreference[] = [...DEFAULT_NOTIFICATION_PREFERENCES];
  private listeners: Array<(notification: Notification) => void> = [];

  /**
   * Create and dispatch a new notification
   */
  notify(input: {
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
  }): Notification {
    const priority = input.priority ?? "medium";

    // Check if this notification should be suppressed by preferences
    const pref = this.preferences.find((p) => p.category === input.category);
    if (pref && (!pref.enabled || PRIORITY_RANK[priority] < PRIORITY_RANK[pref.minPriority])) {
      // Still create it but mark as dismissed (suppressed)
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
        // Queue for after quiet hours (in real app), for now just create
        const notif: Notification = {
          id: generateId(),
          ...input,
          priority,
          read: false,
          dismissed: false,
          createdAt: new Date().toISOString(),
          expiresAt: input.expiresAt,
        };
        this.notifications.unshift(notif);
        return notif;
      }
    }

    const notification: Notification = {
      id: generateId(),
      ...input,
      priority,
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt,
    };

    this.notifications.unshift(notification);

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
  getNotifications(filters?: {
    category?: NotificationCategory;
    priority?: NotificationPriority;
    unreadOnly?: boolean;
    limit?: number;
  }): Notification[] {
    let result = this.notifications.filter((n) => !n.dismissed);

    if (filters?.category) {
      result = result.filter((n) => n.category === filters.category);
    }
    if (filters?.priority) {
      result = result.filter((n) => n.priority === filters.priority);
    }
    if (filters?.unreadOnly) {
      result = result.filter((n) => !n.read);
    }

    // Clean up expired notifications
    const now = new Date().toISOString();
    result = result.filter((n) => !n.expiresAt || n.expiresAt > now);

    return filters?.limit ? result.slice(0, filters.limit) : result;
  }

  /**
   * Get a single notification by ID
   */
  getNotification(id: string): Notification | undefined {
    return this.notifications.find((n) => n.id === id);
  }

  /**
   * Mark a notification as read
   */
  markAsRead(id: string): Notification | null {
    const notif = this.notifications.find((n) => n.id === id);
    if (!notif) return null;
    notif.read = true;
    notif.readAt = new Date().toISOString();
    return notif;
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): number {
    let count = 0;
    for (const n of this.notifications) {
      if (!n.read && !n.dismissed) {
        n.read = true;
        n.readAt = new Date().toISOString();
        count++;
      }
    }
    return count;
  }

  /**
   * Dismiss a notification
   */
  dismiss(id: string): boolean {
    const notif = this.notifications.find((n) => n.id === id);
    if (!notif) return false;
    notif.dismissed = true;
    return true;
  }

  /**
   * Dismiss all notifications
   */
  dismissAll(): number {
    let count = 0;
    for (const n of this.notifications) {
      if (!n.dismissed) {
        n.dismissed = true;
        count++;
      }
    }
    return count;
  }

  /**
   * Get notification statistics
   */
  getStats(): NotificationStats {
    const active = this.notifications.filter((n) => !n.dismissed);
    const today = new Date().toISOString().split("T")[0];

    const byCategory: Record<NotificationCategory, number> = {
      agent: 0, lead: 0, deal: 0, email: 0, linkedin: 0,
      compliance: 0, workflow: 0, system: 0,
    };
    const byPriority: Record<NotificationPriority, number> = {
      low: 0, medium: 0, high: 0, critical: 0,
    };

    for (const n of active) {
      byCategory[n.category]++;
      byPriority[n.priority]++;
    }

    return {
      total: active.length,
      unread: active.filter((n) => !n.read).length,
      byCategory,
      byPriority,
      todayCount: active.filter((n) => n.createdAt.startsWith(today)).length,
    };
  }

  /**
   * Get notification preferences
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
   * Load notifications from external data
   */
  loadNotifications(notifications: Notification[]): void {
    this.notifications = notifications;
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
  clearAll(): void {
    this.notifications = [];
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

export const notificationEngine = new NotificationEngine();
export { NotificationEngine };
