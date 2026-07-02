/**
 * HERMÈS — R-004 deep — Tests unitaires pour les helpers DB de linkedin-token.ts
 *
 * Couvre :
 *  - persistTokenToDB : upsert avec valeur chiffrée (vérifie que plaintext
 *    n'est JAMAIS passé à Prisma), skip si token vide, throw si userId vide
 *  - getDecryptedTokenFromDB : round-trip depuis une valeur chiffrée,
 *    fallback legacy plaintext avec warn, null si row manquant / token vide
 *    / ciphertext corrompu
 *  - getActiveLinkedInToken : priorité cookie, fallback DB
 *  - fetchLinkedInProfile : parsing de la réponse /v2/userinfo, gestion
 *    d'erreur API, gestion d'erreur réseau
 *
 * Mocks :
 *  - `@/lib/db` : mock du PrismaClient (linkedInAuth.upsert/findUnique)
 *  - `next/headers` : mock de `cookies()` pour contrôler le cookie li_token
 *
 * Run : npx vitest run src/lib/__tests__/linkedin-token.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";

// ─── Mock setup ─────────────────────────────────────────────────────

// In-memory store for the LinkedInAuth row keyed by userId
let mockDB: Record<string, { accessToken: string; linkedInUserId?: string } | undefined> = {};

vi.mock("@/lib/db", () => ({
  db: {
    linkedInAuth: {
      upsert: vi.fn(async ({ where, create, update }: {
        where: { userId: string };
        create: { userId: string; accessToken: string; linkedInUserId?: string };
        update: { accessToken: string; linkedInUserId?: string };
      }) => {
        const userId = where.userId;
        // Simulate Prisma upsert: create if missing, update if exists
        const existing = mockDB[userId];
        const next = existing
          ? { ...existing, ...update }
          : { ...create };
        mockDB[userId] = next;
        return next;
      }),
      findUnique: vi.fn(async ({ where, select }: {
        where: { userId: string };
        select?: Record<string, boolean>;
      }) => {
        const row = mockDB[where.userId];
        if (!row) return null;
        if (!select) return row;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(select)) if (v) out[k] = (row as Record<string, unknown>)[k];
        return out;
      }),
    },
  },
}));

// Cookie mock — controlled per-test via __setCookie
let mockCookieValue: string | undefined = undefined;
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "li_token" && mockCookieValue !== undefined
        ? { name, value: mockCookieValue }
        : undefined,
  })),
}));

// fetch mock for fetchLinkedInProfile
const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

// ─── Imports (after mocks are registered) ───────────────────────────

import {
  persistTokenToDB,
  getDecryptedTokenFromDB,
  getActiveLinkedInToken,
  fetchLinkedInProfile,
  encrypt,
  decrypt,
} from "@/lib/linkedin-token";

// ─── Stable ENCRYPTION_KEY for tests ────────────────────────────────

const TEST_KEY = "a".repeat(64);

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
});

beforeEach(() => {
  mockDB = {};
  mockCookieValue = undefined;
  fetchMock.mockReset();
  (db.linkedInAuth.upsert as unknown as { mockClear: () => void }).mockClear();
  (db.linkedInAuth.findUnique as unknown as { mockClear: () => void }).mockClear();
});

// ─── persistTokenToDB ───────────────────────────────────────────────

describe("persistTokenToDB", () => {
  it("upserts an encrypted token (plaintext never reaches Prisma)", async () => {
    const plaintext = "AQX-abc-123-456";
    await persistTokenToDB("user_1", plaintext, {
      linkedInUserId: "li_42",
      firstName: "Alice",
      lastName: "Wonderland",
    });

    expect(db.linkedInAuth.upsert).toHaveBeenCalledTimes(1);
    const call = (db.linkedInAuth.upsert as unknown as { mock: { calls: any[] } }).mock.calls[0][0];
    expect(call.where.userId).toBe("user_1");
    expect(call.create.userId).toBe("user_1");
    expect(call.create.accessToken).not.toBe(plaintext);
    expect(call.create.accessToken.startsWith("v1:")).toBe(true);
    expect(call.create.linkedInUserId).toBe("li_42");

    // Round-trip : on doit pouvoir décrypter la valeur stockée
    expect(decrypt(call.create.accessToken)).toBe(plaintext);
  });

  it("updates existing row (only accessToken when no profile)", async () => {
    // Seed existing row
    mockDB["user_2"] = {
      accessToken: encrypt("old-token"),
      linkedInUserId: "li_old",
    };

    await persistTokenToDB("user_2", "new-token");

    const call = (db.linkedInAuth.upsert as unknown as { mock: { calls: any[] } }).mock.calls[0][0];
    expect(call.update.accessToken).not.toBe("new-token");
    expect(call.update.accessToken.startsWith("v1:")).toBe(true);
    // No profile → should not overwrite linkedInUserId
    expect(call.update).not.toHaveProperty("linkedInUserId");
  });

  it("skips the write when token is empty (logs warn, no throw)", async () => {
    await persistTokenToDB("user_3", "");
    expect(db.linkedInAuth.upsert).not.toHaveBeenCalled();
  });

  it("throws when userId is empty", async () => {
    await expect(persistTokenToDB("", "token")).rejects.toThrow(/userId is required/);
  });
});

// ─── getDecryptedTokenFromDB ────────────────────────────────────────

describe("getDecryptedTokenFromDB", () => {
  it("round-trips an encrypted token (write then read)", async () => {
    const plaintext = "secret-token-XYZ";
    await persistTokenToDB("user_a", plaintext);

    const got = await getDecryptedTokenFromDB("user_a");
    expect(got).toBe(plaintext);
  });

  it("returns null when no row exists", async () => {
    const got = await getDecryptedTokenFromDB("ghost_user");
    expect(got).toBeNull();
  });

  it("returns null when row exists but accessToken is empty", async () => {
    mockDB["user_b"] = { accessToken: "" };
    const got = await getDecryptedTokenFromDB("user_b");
    expect(got).toBeNull();
  });

  it("returns null when the ciphertext is tampered (auth tag mismatch)", async () => {
    // Encrypt a real token, then flip one byte in the ciphertext segment.
    // The isEncrypted regex still matches, but decrypt() throws (auth tag
    // verification fails), and getDecryptedTokenFromDB returns null.
    const real = encrypt("secret-token-to-tamper");
    const parts = real.split(":");
    // Flip the first char of the ciphertext segment
    const ct = parts[2];
    const flipped = ct.charAt(0) === "A" ? "B" + ct.slice(1) : "A" + ct.slice(1);
    parts[2] = flipped;
    mockDB["user_c"] = { accessToken: parts.join(":") };
    const got = await getDecryptedTokenFromDB("user_c");
    expect(got).toBeNull();
  });

  it("falls back to plaintext for legacy (pre-R-004) values", async () => {
    // A real plaintext token, not v1:-prefixed
    mockDB["user_d"] = { accessToken: "legacy-plaintext-token-12345" };
    const got = await getDecryptedTokenFromDB("user_d");
    expect(got).toBe("legacy-plaintext-token-12345");
  });

  it("returns null when userId is empty", async () => {
    const got = await getDecryptedTokenFromDB("");
    expect(got).toBeNull();
  });
});

// ─── getActiveLinkedInToken ─────────────────────────────────────────

describe("getActiveLinkedInToken", () => {
  it("prefers the cookie over the DB", async () => {
    // Set both
    mockCookieValue = encrypt("cookie-token");
    mockDB["user_x"] = { accessToken: encrypt("db-token") };

    const got = await getActiveLinkedInToken("user_x");
    expect(got).toBe("cookie-token");
  });

  it("falls back to DB when cookie is missing", async () => {
    mockCookieValue = undefined;
    mockDB["user_y"] = { accessToken: encrypt("db-token") };

    const got = await getActiveLinkedInToken("user_y");
    expect(got).toBe("db-token");
  });

  it("returns null when both cookie and DB are empty", async () => {
    mockCookieValue = undefined;
    const got = await getActiveLinkedInToken("user_z");
    expect(got).toBeNull();
  });

  it("returns null when cookie is malformed AND DB is empty", async () => {
    // A cookie that looks encrypted (passes isEncrypted regex) but fails
    // decryption — getTokenFromCookies should return null, then the DB
    // fallback also returns null (no row for this user).
    const real = encrypt("cookie-token-that-will-be-tampered");
    const parts = real.split(":");
    const ct = parts[2];
    parts[2] = (ct.charAt(0) === "A" ? "B" : "A") + ct.slice(1);
    mockCookieValue = parts.join(":");
    const got = await getActiveLinkedInToken("user_zz");
    expect(got).toBeNull();
  });
});

// ─── fetchLinkedInProfile ───────────────────────────────────────────

describe("fetchLinkedInProfile", () => {
  it("parses a successful /v2/userinfo response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        sub: "li_42",
        given_name: "Alice",
        family_name: "Smith",
        picture: "https://media.linkedin.com/alice.jpg",
      }),
    });

    const profile = await fetchLinkedInProfile("token-xyz");
    expect(profile).toEqual({
      linkedInUserId: "li_42",
      firstName: "Alice",
      lastName: "Smith",
      profilePictureUrl: "https://media.linkedin.com/alice.jpg",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linkedin.com/v2/userinfo",
      expect.objectContaining({
        headers: { Authorization: "Bearer token-xyz" },
      }),
    );
  });

  it("returns null when the API returns a non-OK status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
    });
    const profile = await fetchLinkedInProfile("bad-token");
    expect(profile).toBeNull();
  });

  it("returns null when the response has no `sub` field", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ given_name: "Alice" }), // missing sub
    });
    const profile = await fetchLinkedInProfile("token-xyz");
    expect(profile).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network down"));
    const profile = await fetchLinkedInProfile("token-xyz");
    expect(profile).toBeNull();
  });
});
