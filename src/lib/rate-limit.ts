/**
 * HERMÈS — R-007 — Rate limiting
 *
 * Sliding-window rate limiter with pluggable storage.
 *
 * Categories:
 *  - auth     : login attempts (POST /api/auth/[...nextauth]/callback/credentials)
 *  - register : account creation (POST /api/auth/register)
 *  - ai       : AI generation routes (/api/ai/*)
 *  - export   : bulk export (/api/data/export)
 *  - import   : bulk import (/api/data/import)
 *  - api      : default for all other /api/* routes
 *
 * Limits are per-IP (or per-userId if a session is available).
 *
 * Storage:
 *  - Default: in-memory Map (per-instance, lost on restart)
 *  - Production: plug a Redis adapter via `setRateLimitStore()`
 *    (recommended when running multiple instances — see Volume 2 §6)
 *
 * Headers (RFC draft-ietf-httpapi-ratelimit-headers):
 *  - RateLimit-Limit     : max requests per window
 *  - RateLimit-Remaining : remaining requests in current window
 *  - RateLimit-Reset     : seconds until window resets
 *  - Retry-After         : seconds to wait before retrying (only on 429)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type RateLimitCategory =
  | "auth"
  | "register"
  | "ai"
  | "export"
  | "import"
  | "api";

export interface RateLimitConfig {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Max requests in the window. */
  limit: number;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Epoch ms when the window resets. */
  resetAt: number;
  /** Seconds until reset (for headers). */
  retryAfter: number;
}

export interface RateLimitStore {
  /**
   * Atomically increment the counter for `key` and return current state.
   * Implementations MUST be thread-safe (Redis INCR, Map with single thread, etc.).
   */
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  /** Optional: clean up expired entries (for memory management). */
  reset?(key: string): Promise<void>;
}

// ─── Configuration per category ──────────────────────────────────────────────

const CATEGORIES: Record<RateLimitCategory, RateLimitConfig> = {
  // Login attempts — strict to prevent brute-force
  auth: { limit: 10, windowMs: 60_000 }, // 10/min
  // Account creation — strict to prevent spam
  register: { limit: 5, windowMs: 60_000 }, // 5/min
  // AI generation — expensive, strict
  ai: { limit: 20, windowMs: 60_000 }, // 20/min
  // Export — heavy DB load
  export: { limit: 5, windowMs: 60_000 }, // 5/min
  // Import — heavy DB writes
  import: { limit: 10, windowMs: 60_000 }, // 10/min
  // Default API
  api: { limit: 100, windowMs: 60_000 }, // 100/min
};

// ─── In-memory store (default) ───────────────────────────────────────────────

class MemoryStore implements RateLimitStore {
  private map = new Map<string, { count: number; resetAt: number }>();
  /** Periodic cleanup to avoid memory leaks from abandoned IPs. */
  private lastCleanup = Date.now();
  private readonly CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 min
  private readonly MAX_ENTRIES = 10_000;

  async hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();

    // Periodic cleanup
    if (now - this.lastCleanup > this.CLEANUP_INTERVAL_MS) {
      this.cleanup(now);
      this.lastCleanup = now;
    }

    // Cap the map size (evict oldest if exceeded)
    if (this.map.size >= this.MAX_ENTRIES && !this.map.has(key)) {
      const firstKey = this.map.keys().next().value;
      if (firstKey) this.map.delete(firstKey);
    }

    const entry = this.map.get(key);
    if (!entry || now > entry.resetAt) {
      const resetAt = now + windowMs;
      this.map.set(key, { count: 1, resetAt });
      return { count: 1, resetAt };
    }

    entry.count += 1;
    return { count: entry.count, resetAt: entry.resetAt };
  }

  async reset(key: string): Promise<void> {
    this.map.delete(key);
  }

  private cleanup(now: number): void {
    for (const [k, v] of this.map) {
      if (now > v.resetAt) {
        this.map.delete(k);
      }
    }
  }
}

// ─── Singleton store (overridable for tests / Redis) ─────────────────────────

let store: RateLimitStore = new MemoryStore();

/**
 * Override the default in-memory store.
 *
 * In production with multiple instances, plug a Redis-backed store:
 *
 *   import { setRateLimitStore } from "@/lib/rate-limit";
 *   import { RedisRateLimitStore } from "@/lib/rate-limit-redis";
 *   setRateLimitStore(new RedisRateLimitStore(process.env.REDIS_URL!));
 */
export function setRateLimitStore(newStore: RateLimitStore): void {
  store = newStore;
}

/** For tests only — reset to a fresh in-memory store. */
export function resetRateLimitStore(): void {
  store = new MemoryStore();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve a category from a request path + method.
 *
 * Returns `null` if the path doesn't need rate-limiting (e.g., static files).
 */
export function resolveCategory(
  pathname: string,
  method: string,
): RateLimitCategory | null {
  // Auth: login attempts
  if (
    pathname.startsWith("/api/auth/callback/credentials") ||
    pathname.startsWith("/api/auth/signin") ||
    pathname.startsWith("/api/auth/session")
  ) {
    return "auth";
  }
  // Register
  if (pathname === "/api/auth/register" && method === "POST") {
    return "register";
  }
  // AI
  if (pathname.startsWith("/api/ai/")) {
    return "ai";
  }
  // Export / Import
  if (pathname === "/api/data/export" && method === "GET") {
    return "export";
  }
  if (pathname === "/api/data/import" && method === "POST") {
    return "import";
  }
  // Default API
  if (pathname.startsWith("/api/")) {
    return "api";
  }
  return null;
}

/**
 * Compute the rate-limit key for a request.
 *
 * Prefers `userId` (when authenticated) over IP, so a single user can't
 * bypass their per-account limit by rotating IPs.
 */
export function buildKey(
  category: RateLimitCategory,
  ip: string,
  userId?: string,
): string {
  const identity = userId ?? `ip:${ip}`;
  return `rl:${category}:${identity}`;
}

/**
 * Apply rate-limiting for the given category + identity.
 *
 * @returns `RateLimitResult` — caller must add the standard headers and
 *          return a 429 response if `allowed === false`.
 */
export async function checkRateLimit(
  category: RateLimitCategory,
  ip: string,
  userId?: string,
): Promise<RateLimitResult> {
  const config = CATEGORIES[category];
  const key = buildKey(category, ip, userId);

  const { count, resetAt } = await store.hit(key, config.windowMs);
  const now = Date.now();
  const allowed = count <= config.limit;
  const remaining = Math.max(0, config.limit - count);
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));

  return {
    allowed,
    limit: config.limit,
    remaining,
    resetAt,
    retryAfter,
  };
}

/**
 * Build the standard rate-limit headers to attach to responses.
 *
 * Implements draft-ietf-httpapi-ratelimit-headers:
 *   RateLimit-Limit: <limit>
 *   RateLimit-Remaining: <remaining>
 *   RateLimit-Reset: <seconds>
 *
 * Also adds legacy X-RateLimit-* for backward compat with older clients.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const now = Date.now();
  const resetSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(resetSeconds),
    // Legacy aliases (some clients still use these)
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(resetSeconds),
    ...(result.allowed
      ? {}
      : { "Retry-After": String(result.retryAfter) }),
  };
}

/**
 * Get the config for a category (read-only).
 * Useful for documentation / OpenAPI specs.
 */
export function getCategoryConfig(category: RateLimitCategory): Readonly<RateLimitConfig> {
  return { ...CATEGORIES[category] };
}

/**
 * List all categories with their config (read-only).
 * Useful for the /api/health or admin endpoints.
 */
export function listCategories(): ReadonlyArray<{
  category: RateLimitCategory;
  config: RateLimitConfig;
}> {
  return (Object.keys(CATEGORIES) as RateLimitCategory[]).map((category) => ({
    category,
    config: { ...CATEGORIES[category] },
  }));
}
