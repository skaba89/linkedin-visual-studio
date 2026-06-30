/**
 * HERMÈS — R-002 deep — Tests unitaires pour src/lib/notifications/notification-engine.ts
 *
 * Couvre la isolation multi-tenant après refactoring :
 *  - notify(userId, ...) écrit avec le userId passé (plus de DEFAULT_USER_ID)
 *  - getNotifications(userId, ...) ne retourne QUE les notifs du user
 *  - getNotification(userId, id) retourne null si la notif appartient à un autre user
 *    (pas de fuite d'existence — IDOR fix)
 *  - markAsRead(userId, id) / dismiss(userId, id) ne modifie pas la notif d'un autre user
 *  - markAllAsRead(userId) / dismissAll(userId) / clearAll(userId) ne touchent que le user
 *  - getStats(userId) / getPreferences(userId) sont scoppés par user
 *  - updatePreference(userId, ...) écrit avec le bon userId
 *
 * Mocks :
 *  - `@/lib/db` : mock du PrismaClient avec tables notification + notificationPreference
 *
 * Run : npx vitest run src/lib/__tests__/notification-engine.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── In-memory mock DB ──────────────────────────────────────────────

type MockNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  actionUrl: string | null;
  actionLabel: string | null;
  sourceAgent: string | null;
  sourceWorkflow: string | null;
  metadata: string | null;
  read: boolean;
  readAt: Date | null;
  dismissed: boolean;
  expiresAt: Date | null;
  createdAt: Date;
};

type MockPreference = {
  userId: string;
  category: string;
  enabled: boolean;
  minPriority: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

let notifications: MockNotification[] = [];
let preferences: MockPreference[] = [];

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      create: vi.fn(async ({ data }: { data: Partial<MockNotification> }) => {
        const row: MockNotification = {
          id: `n${notifications.length + 1}`,
          userId: data.userId!,
          title: data.title!,
          message: data.message!,
          category: data.category!,
          priority: data.priority ?? "medium",
          actionUrl: data.actionUrl ?? null,
          actionLabel: data.actionLabel ?? null,
          sourceAgent: data.sourceAgent ?? null,
          sourceWorkflow: data.sourceWorkflow ?? null,
          metadata: data.metadata ?? null,
          read: data.read ?? false,
          readAt: data.readAt ?? null,
          dismissed: data.dismissed ?? false,
          expiresAt: data.expiresAt ?? null,
          createdAt: new Date(),
        };
        notifications.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where, take }: { where?: Record<string, unknown>; take?: number }) => {
        let rows = [...notifications];
        if (where?.userId) rows = rows.filter((r) => r.userId === where.userId);
        if (where?.dismissed !== undefined) rows = rows.filter((r) => r.dismissed === where.dismissed);
        if (where?.read !== undefined) rows = rows.filter((r) => r.read === where.read);
        if (where?.category) rows = rows.filter((r) => r.category === where.category);
        if (where?.priority) rows = rows.filter((r) => r.priority === where.priority);
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (take) rows = rows.slice(0, take);
        return rows;
      }),
      findFirst: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        return notifications.find((r) => r.id === where?.id && r.userId === where?.userId) ?? null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return notifications.find((r) => r.id === where.id) ?? null;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<MockNotification> }) => {
        let count = 0;
        for (let i = 0; i < notifications.length; i++) {
          const r = notifications[i];
          let match = true;
          if (where.id && r.id !== where.id) match = false;
          if (where.userId && r.userId !== where.userId) match = false;
          if (where.read !== undefined && r.read !== where.read) match = false;
          if (where.dismissed !== undefined && r.dismissed !== where.dismissed) match = false;
          if (match) {
            notifications[i] = { ...r, ...data };
            count++;
          }
        }
        return { count };
      }),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const before = notifications.length;
        notifications = notifications.filter((r) => {
          if (where.userId && r.userId !== where.userId) return true; // keep
          return false; // delete
        });
        return { count: before - notifications.length };
      }),
    },
    notificationPreference: {
      findUnique: vi.fn(async ({ where }: { where: { userId_category: { userId: string; category: string } } }) => {
        return preferences.find(
          (p) => p.userId === where.userId_category.userId && p.category === where.userId_category.category,
        ) ?? null;
      }),
      findMany: vi.fn(async ({ where }: { where?: { userId?: string } }) => {
        if (where?.userId) return preferences.filter((p) => p.userId === where.userId);
        return preferences;
      }),
      createMany: vi.fn(async ({ data }: { data: MockPreference[] }) => {
        preferences.push(...data);
        return { count: data.length };
      }),
      upsert: vi.fn(async ({ where, update, create }: {
        where: { userId_category: { userId: string; category: string } };
        update: Partial<MockPreference>;
        create: MockPreference;
      }) => {
        const idx = preferences.findIndex(
          (p) => p.userId === where.userId_category.userId && p.category === where.userId_category.category,
        );
        if (idx >= 0) {
          preferences[idx] = { ...preferences[idx], ...update };
          return preferences[idx];
        }
        preferences.push(create);
        return create;
      }),
    },
  },
}));

// ─── Import AFTER mocks are registered ──────────────────────────────

import { notificationEngine } from "@/lib/notifications";

// ─── Tests ──────────────────────────────────────────────────────────

describe("notificationEngine — R-002 multi-tenant isolation", () => {
  beforeEach(() => {
    notifications = [];
    preferences = [];
    // Reset the per-user preferencesSeeded set between tests
    (notificationEngine as unknown as { preferencesSeeded: Set<string> }).preferencesSeeded.clear();
  });

  describe("notify(userId, ...)", () => {
    it("writes the notification with the given userId (not DEFAULT_USER_ID)", async () => {
      await notificationEngine.notify("user-A", {
        title: "Hello A",
        message: "msg",
        category: "system",
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].userId).toBe("user-A");
      expect(notifications[0].title).toBe("Hello A");
    });

    it("writes to distinct users independently", async () => {
      await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      await notificationEngine.notify("user-B", { title: "B1", message: "m", category: "system" });
      const userANotifs = notifications.filter((n) => n.userId === "user-A");
      const userBNotifs = notifications.filter((n) => n.userId === "user-B");
      expect(userANotifs).toHaveLength(1);
      expect(userBNotifs).toHaveLength(1);
      expect(userANotifs[0].title).toBe("A1");
      expect(userBNotifs[0].title).toBe("B1");
    });
  });

  describe("getNotifications(userId, ...)", () => {
    it("returns only the user's notifications", async () => {
      await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      await notificationEngine.notify("user-B", { title: "B1", message: "m", category: "system" });
      await notificationEngine.notify("user-A", { title: "A2", message: "m", category: "agent" });

      const result = await notificationEngine.getNotifications("user-A");
      expect(result).toHaveLength(2);
      expect(result.every((n) => n.title.startsWith("A"))).toBe(true);
    });

    it("returns empty for a user with no notifications", async () => {
      await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      const result = await notificationEngine.getNotifications("user-B");
      expect(result).toHaveLength(0);
    });

    it("respects the unreadOnly filter", async () => {
      await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      // Mark the first one as read
      const first = notifications[0];
      first.read = true;
      const result = await notificationEngine.getNotifications("user-A", { unreadOnly: true });
      expect(result).toHaveLength(0);
    });
  });

  describe("getNotification(userId, id) — IDOR fix", () => {
    it("returns the notification when it belongs to the user", async () => {
      const n = await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      const result = await notificationEngine.getNotification("user-A", n.id);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(n.id);
    });

    it("returns null when the notification belongs to another user (no existence leak)", async () => {
      const n = await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      const result = await notificationEngine.getNotification("user-B", n.id);
      expect(result).toBeNull();
    });
  });

  describe("markAsRead(userId, id) — IDOR fix", () => {
    it("marks as read when the notification belongs to the user", async () => {
      const n = await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      const result = await notificationEngine.markAsRead("user-A", n.id);
      expect(result).not.toBeNull();
      expect(result?.read).toBe(true);
    });

    it("returns null (and does not mutate) when the notification belongs to another user", async () => {
      const n = await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      const result = await notificationEngine.markAsRead("user-B", n.id);
      expect(result).toBeNull();
      // Verify the notification was NOT mutated
      expect(notifications[0].read).toBe(false);
    });
  });

  describe("dismiss(userId, id) — IDOR fix", () => {
    it("dismisses when the notification belongs to the user", async () => {
      const n = await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      const ok = await notificationEngine.dismiss("user-A", n.id);
      expect(ok).toBe(true);
      expect(notifications[0].dismissed).toBe(true);
    });

    it("returns false (and does not mutate) when the notification belongs to another user", async () => {
      const n = await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      const ok = await notificationEngine.dismiss("user-B", n.id);
      expect(ok).toBe(false);
      expect(notifications[0].dismissed).toBe(false);
    });
  });

  describe("markAllAsRead(userId)", () => {
    it("only marks the given user's notifications", async () => {
      await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      await notificationEngine.notify("user-A", { title: "A2", message: "m", category: "system" });
      await notificationEngine.notify("user-B", { title: "B1", message: "m", category: "system" });

      const count = await notificationEngine.markAllAsRead("user-A");
      expect(count).toBe(2);
      const aNotifs = notifications.filter((n) => n.userId === "user-A");
      const bNotifs = notifications.filter((n) => n.userId === "user-B");
      expect(aNotifs.every((n) => n.read)).toBe(true);
      expect(bNotifs.every((n) => n.read)).toBe(false);
    });
  });

  describe("dismissAll(userId)", () => {
    it("only dismisses the given user's notifications", async () => {
      await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      await notificationEngine.notify("user-B", { title: "B1", message: "m", category: "system" });

      const count = await notificationEngine.dismissAll("user-A");
      expect(count).toBe(1);
      expect(notifications.find((n) => n.userId === "user-A")?.dismissed).toBe(true);
      expect(notifications.find((n) => n.userId === "user-B")?.dismissed).toBe(false);
    });
  });

  describe("getStats(userId)", () => {
    it("only counts the given user's notifications", async () => {
      await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      await notificationEngine.notify("user-A", { title: "A2", message: "m", category: "agent", priority: "high" });
      await notificationEngine.notify("user-B", { title: "B1", message: "m", category: "system" });

      const stats = await notificationEngine.getStats("user-A");
      expect(stats.total).toBe(2);
      expect(stats.unread).toBe(2);
      expect(stats.byCategory.system).toBe(1);
      expect(stats.byCategory.agent).toBe(1);
    });
  });

  describe("getPreferences(userId) + updatePreference(userId, ...)", () => {
    it("seeds preferences per user and scopes them by userId", async () => {
      const prefsA = await notificationEngine.getPreferences("user-A");
      expect(prefsA.length).toBeGreaterThan(0);
      // Seeding should have created rows with userId='user-A'
      expect(preferences.every((p) => p.userId === "user-A")).toBe(true);

      // user-B should get its own seed
      const prefsB = await notificationEngine.getPreferences("user-B");
      expect(prefsB.length).toBe(prefsA.length);
      expect(preferences.filter((p) => p.userId === "user-B")).toHaveLength(prefsB.length);
    });

    it("updatePreference only writes to the given user's row", async () => {
      await notificationEngine.getPreferences("user-A"); // seed
      await notificationEngine.getPreferences("user-B"); // seed

      await notificationEngine.updatePreference("user-A", "system", { enabled: false });
      const prefA = preferences.find((p) => p.userId === "user-A" && p.category === "system");
      const prefB = preferences.find((p) => p.userId === "user-B" && p.category === "system");
      expect(prefA?.enabled).toBe(false);
      expect(prefB?.enabled).toBe(true); // unchanged
    });
  });

  describe("clearAll(userId)", () => {
    it("only deletes the given user's notifications", async () => {
      await notificationEngine.notify("user-A", { title: "A1", message: "m", category: "system" });
      await notificationEngine.notify("user-B", { title: "B1", message: "m", category: "system" });

      await notificationEngine.clearAll("user-A");
      expect(notifications.filter((n) => n.userId === "user-A")).toHaveLength(0);
      expect(notifications.filter((n) => n.userId === "user-B")).toHaveLength(1);
    });
  });
});
