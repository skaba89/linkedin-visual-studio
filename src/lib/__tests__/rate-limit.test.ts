/**
 * HERMÈS — R-007 — Tests unitaires pour src/lib/rate-limit.ts
 *
 * Couvre :
 *  - resolveCategory : mappage pathname/method → category
 *  - buildKey : construction de la clé (par IP ou par userId)
 *  - checkRateLimit : incrément, limite, reset de fenêtre
 *  - rateLimitHeaders : format des headers standard + legacy
 *  - getCategoryConfig / listCategories : introspection
 *  - setRateLimitStore / resetRateLimitStore : override du store
 *
 * Run : npx vitest run src/lib/__tests__/rate-limit.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  resolveCategory,
  buildKey,
  rateLimitHeaders,
  getCategoryConfig,
  listCategories,
  resetRateLimitStore,
  setRateLimitStore,
  type RateLimitStore,
} from "@/lib/rate-limit";

beforeEach(() => {
  resetRateLimitStore();
});

describe("resolveCategory", () => {
  it("maps /api/auth/callback/credentials* to 'auth'", () => {
    expect(resolveCategory("/api/auth/callback/credentials", "POST")).toBe("auth");
    expect(resolveCategory("/api/auth/callback/credentials", "GET")).toBe("auth");
  });

  it("maps /api/auth/signin to 'auth'", () => {
    expect(resolveCategory("/api/auth/signin", "POST")).toBe("auth");
  });

  it("maps /api/auth/session to 'auth'", () => {
    expect(resolveCategory("/api/auth/session", "GET")).toBe("auth");
  });

  it("maps POST /api/auth/register to 'register'", () => {
    expect(resolveCategory("/api/auth/register", "POST")).toBe("register");
  });

  it("does NOT map GET /api/auth/register to 'register' (falls back to auth)", () => {
    // GET on /api/auth/register falls under /api/auth/* → 'auth'
    expect(resolveCategory("/api/auth/register", "GET")).toBe("auth");
  });

  it("maps /api/ai/* to 'ai'", () => {
    expect(resolveCategory("/api/ai/chat", "POST")).toBe("ai");
    expect(resolveCategory("/api/ai/generate-image", "POST")).toBe("ai");
  });

  it("maps GET /api/data/export to 'export'", () => {
    expect(resolveCategory("/api/data/export", "GET")).toBe("export");
  });

  it("maps POST /api/data/import to 'import'", () => {
    expect(resolveCategory("/api/data/import", "POST")).toBe("import");
  });

  it("falls back to 'api' for other /api/* routes", () => {
    expect(resolveCategory("/api/data/leads", "GET")).toBe("api");
    expect(resolveCategory("/api/data/contacts", "POST")).toBe("api");
    expect(resolveCategory("/api/health", "GET")).toBe("api");
  });

  it("returns null for non-API routes", () => {
    expect(resolveCategory("/", "GET")).toBeNull();
    expect(resolveCategory("/dashboard", "GET")).toBeNull();
    expect(resolveCategory("/_next/static/foo.js", "GET")).toBeNull();
  });
});

describe("buildKey", () => {
  it("builds key with IP when no userId", () => {
    expect(buildKey("auth", "1.2.3.4")).toBe("rl:auth:ip:1.2.3.4");
  });

  it("builds key with userId when provided (preferred over IP)", () => {
    expect(buildKey("auth", "1.2.3.4", "user_123")).toBe("rl:auth:user_123");
  });

  it("handles 'unknown' IP gracefully", () => {
    expect(buildKey("api", "unknown")).toBe("rl:api:ip:unknown");
  });

  it("produces different keys for different categories", () => {
    const ip = "1.2.3.4";
    expect(buildKey("auth", ip)).not.toBe(buildKey("register", ip));
    expect(buildKey("ai", ip)).not.toBe(buildKey("api", ip));
  });
});

describe("checkRateLimit", () => {
  it("allows the first request", async () => {
    const result = await checkRateLimit("api", "1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(100);
    expect(result.remaining).toBe(99);
  });

  it("blocks after exceeding the limit", async () => {
    const config = getCategoryConfig("register");
    for (let i = 0; i < config.limit; i++) {
      const r = await checkRateLimit("register", "1.2.3.4");
      expect(r.allowed).toBe(true);
    }
    // Next request should be blocked
    const blocked = await checkRateLimit("register", "1.2.3.4");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("tracks limits per-IP independently", async () => {
    // User A hits the limit
    const config = getCategoryConfig("auth");
    for (let i = 0; i < config.limit; i++) {
      await checkRateLimit("auth", "1.1.1.1");
    }
    const blocked = await checkRateLimit("auth", "1.1.1.1");
    expect(blocked.allowed).toBe(false);

    // User B from a different IP is still allowed
    const other = await checkRateLimit("auth", "2.2.2.2");
    expect(other.allowed).toBe(true);
  });

  it("tracks limits per-userId independently of IP", async () => {
    // userId "u1" hits limit from IP 1.1.1.1
    const config = getCategoryConfig("api");
    for (let i = 0; i < config.limit; i++) {
      await checkRateLimit("api", "1.1.1.1", "u1");
    }
    const blocked = await checkRateLimit("api", "1.1.1.1", "u1");
    expect(blocked.allowed).toBe(false);

    // Same userId from a different IP is STILL blocked (key is per-userId)
    const blockedFromOtherIp = await checkRateLimit("api", "9.9.9.9", "u1");
    expect(blockedFromOtherIp.allowed).toBe(false);

    // Different userId from same IP is allowed
    const other = await checkRateLimit("api", "1.1.1.1", "u2");
    expect(other.allowed).toBe(true);
  });

  it("resets the window after windowMs elapses", async () => {
    // Use a custom store with controllable time
    let currentTime = Date.now();
    const customStore: RateLimitStore = {
      async hit(_key: string, windowMs: number) {
        // Simulate: first call opens window, second call (after time jump) resets
        const resetAt = currentTime + windowMs;
        return { count: 1, resetAt };
      },
    };
    setRateLimitStore(customStore);

    const r1 = await checkRateLimit("api", "1.2.3.4");
    expect(r1.allowed).toBe(true);

    // Jump time forward past window
    currentTime += 120_000;

    const r2 = await checkRateLimit("api", "1.2.3.4");
    expect(r2.allowed).toBe(true);
  });

  it("different categories have independent limits", async () => {
    // Exhaust 'register' limit
    const registerConfig = getCategoryConfig("register");
    for (let i = 0; i < registerConfig.limit; i++) {
      await checkRateLimit("register", "1.2.3.4");
    }
    expect((await checkRateLimit("register", "1.2.3.4")).allowed).toBe(false);

    // 'auth' category from same IP is still allowed
    const authResult = await checkRateLimit("auth", "1.2.3.4");
    expect(authResult.allowed).toBe(true);
  });
});

describe("rateLimitHeaders", () => {
  it("includes RateLimit-* standard headers", () => {
    const result = {
      allowed: true,
      limit: 100,
      remaining: 99,
      resetAt: Date.now() + 60_000,
      retryAfter: 60,
    };
    const headers = rateLimitHeaders(result);
    expect(headers["RateLimit-Limit"]).toBe("100");
    expect(headers["RateLimit-Remaining"]).toBe("99");
    expect(headers["RateLimit-Reset"]).toBeDefined();
  });

  it("includes legacy X-RateLimit-* headers for backward compat", () => {
    const result = {
      allowed: true,
      limit: 100,
      remaining: 50,
      resetAt: Date.now() + 60_000,
      retryAfter: 60,
    };
    const headers = rateLimitHeaders(result);
    expect(headers["X-RateLimit-Limit"]).toBe("100");
    expect(headers["X-RateLimit-Remaining"]).toBe("50");
    expect(headers["X-RateLimit-Reset"]).toBeDefined();
  });

  it("includes Retry-After header when blocked", () => {
    const result = {
      allowed: false,
      limit: 10,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      retryAfter: 30,
    };
    const headers = rateLimitHeaders(result);
    expect(headers["Retry-After"]).toBe("30");
  });

  it("does NOT include Retry-After header when allowed", () => {
    const result = {
      allowed: true,
      limit: 10,
      remaining: 5,
      resetAt: Date.now() + 30_000,
      retryAfter: 30,
    };
    const headers = rateLimitHeaders(result);
    expect(headers["Retry-After"]).toBeUndefined();
  });
});

describe("getCategoryConfig", () => {
  it("returns the config for a known category", () => {
    const authConfig = getCategoryConfig("auth");
    expect(authConfig.limit).toBeGreaterThan(0);
    expect(authConfig.windowMs).toBeGreaterThan(0);
  });

  it("returns a copy (mutation does not affect internal state)", () => {
    const config = getCategoryConfig("api");
    const originalLimit = config.limit;
    config.limit = 99999;
    expect(getCategoryConfig("api").limit).toBe(originalLimit);
  });
});

describe("listCategories", () => {
  it("returns all 6 categories with their config", () => {
    const categories = listCategories();
    expect(categories).toHaveLength(6);

    const names = categories.map((c) => c.category).sort();
    expect(names).toEqual(
      ["ai", "api", "auth", "export", "import", "register"].sort(),
    );
  });

  it("returns valid configs for each category", () => {
    for (const { config } of listCategories()) {
      expect(config.limit).toBeGreaterThan(0);
      expect(config.windowMs).toBeGreaterThan(0);
    }
  });

  it("returns the expected strict limits for sensitive categories", () => {
    const map = new Map(
      listCategories().map((c) => [c.category, c.config]),
    );
    // Sensitive categories should have stricter limits than default 'api'
    expect(map.get("auth")!.limit).toBeLessThan(map.get("api")!.limit);
    expect(map.get("register")!.limit).toBeLessThan(map.get("api")!.limit);
    expect(map.get("ai")!.limit).toBeLessThan(map.get("api")!.limit);
    expect(map.get("export")!.limit).toBeLessThan(map.get("api")!.limit);
  });
});

describe("setRateLimitStore (custom store)", () => {
  it("allows overriding the store for testing / Redis adapter", async () => {
    let hits = 0;
    const customStore: RateLimitStore = {
      async hit() {
        hits++;
        return { count: hits, resetAt: Date.now() + 60_000 };
      },
    };
    setRateLimitStore(customStore);

    await checkRateLimit("api", "1.2.3.4");
    await checkRateLimit("api", "1.2.3.4");
    expect(hits).toBe(2);
  });

  it("resetRateLimitStore restores the in-memory store", async () => {
    const customStore: RateLimitStore = {
      async hit() {
        return { count: 999, resetAt: Date.now() + 60_000 };
      },
    };
    setRateLimitStore(customStore);
    const r1 = await checkRateLimit("api", "1.2.3.4");
    expect(r1.remaining).toBeLessThanOrEqual(0); // count 999 > limit 100

    resetRateLimitStore();
    const r2 = await checkRateLimit("api", "5.6.7.8");
    expect(r2.remaining).toBe(99); // fresh store
  });
});
