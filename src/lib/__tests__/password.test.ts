/**
 * HERMÈS — R-001 — Tests unitaires pour src/lib/password.ts
 *
 * Couvre :
 *  - hashPassword : format, longueur, reproductibilité, paramètres variables
 *  - verifyPassword : cas valides, invalides, format corrompu, timing-safe
 *  - isHashedPassword : regex de validation
 *  - assertPasswordStrength : règles de robustesse
 *
 * Run : npx vitest run src/lib/__tests__/password.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  isHashedPassword,
  assertPasswordStrength,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@/lib/password";

describe("hashPassword", () => {
  it("produces a scrypt-prefixed string with 6 colon-separated parts", async () => {
    const hash = await hashPassword("super-secret-123");
    expect(hash.startsWith("scrypt:")).toBe(true);
    const parts = hash.split(":");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("scrypt");
  });

  it("produces a 64-char hex salt and a 64-char hex hash", async () => {
    const hash = await hashPassword("another-pwd-456");
    const [, , , , salt, derived] = hash.split(":");
    expect(salt).toMatch(/^[0-9a-f]{64}$/);
    expect(derived).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const a = await hashPassword("same-password-789");
    const b = await hashPassword("same-password-789");
    expect(a).not.toBe(b);
  });

  it("throws on empty password", async () => {
    await expect(hashPassword("")).rejects.toThrow(/non-empty/);
  });

  it("throws on password > MAX_PASSWORD_LENGTH", async () => {
    const tooLong = "x".repeat(MAX_PASSWORD_LENGTH + 1);
    await expect(hashPassword(tooLong)).rejects.toThrow(/exceeds/);
  });

  it("accepts custom N/r/p parameters", async () => {
    // Smaller N for faster test — still produces a valid hash
    const hash = await hashPassword("custom-params-pwd", { N: 4096, r: 8, p: 1 });
    expect(isHashedPassword(hash)).toBe(true);
    const parts = hash.split(":");
    expect(parseInt(parts[1], 16)).toBe(4096);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const hash = await hashPassword("correct-pwd-123");
    expect(await verifyPassword("correct-pwd-123", hash)).toBe(true);
  });

  it("returns false for an incorrect password", async () => {
    const hash = await hashPassword("correct-pwd-123");
    expect(await verifyPassword("wrong-pwd-456", hash)).toBe(false);
  });

  it("returns false when stored hash is null", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
  });

  it("returns false when stored hash is undefined", async () => {
    expect(await verifyPassword("anything", undefined)).toBe(false);
  });

  it("returns false when stored hash has wrong format (no scrypt: prefix)", async () => {
    expect(await verifyPassword("anything", "plainhash:abc")).toBe(false);
  });

  it("returns false when stored hash has too few parts", async () => {
    expect(await verifyPassword("anything", "scrypt:1:2:3:only")).toBe(false);
  });

  it("returns false when N/r/p are not valid hex", async () => {
    expect(
      await verifyPassword("anything", "scrypt:xx:8:1:abcd:1234"),
    ).toBe(false);
  });

  it("returns false when salt is empty", async () => {
    expect(
      await verifyPassword(
        "anything",
        "scrypt:4000:8:1::0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      ),
    ).toBe(false);
  });
});

describe("isHashedPassword", () => {
  it("returns true for a freshly hashed password", async () => {
    const hash = await hashPassword("any-pwd-123");
    expect(isHashedPassword(hash)).toBe(true);
  });

  it("returns false for plain strings", () => {
    expect(isHashedPassword("plaintext")).toBe(false);
  });

  it("returns false for null/undefined/number", () => {
    expect(isHashedPassword(null)).toBe(false);
    expect(isHashedPassword(undefined)).toBe(false);
    expect(isHashedPassword(42)).toBe(false);
  });

  it("returns false for a hash with wrong-length salt", () => {
    expect(
      isHashedPassword("scrypt:4000:8:1:short:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
    ).toBe(false);
  });
});

describe("assertPasswordStrength", () => {
  it("accepts a strong password", () => {
    expect(() => assertPasswordStrength("strong-password-123")).not.toThrow();
  });

  it("rejects a password shorter than MIN_PASSWORD_LENGTH", () => {
    expect(() => assertPasswordStrength("short1")).toThrow(
      new RegExp(`${MIN_PASSWORD_LENGTH}`),
    );
  });

  it("rejects a password with only letters", () => {
    expect(() => assertPasswordStrength("onlylettershere")).toThrow(
      /non-letter/,
    );
  });

  it("rejects a password with only digits", () => {
    expect(() => assertPasswordStrength("123456789012")).toThrow(/letter/);
  });

  it("rejects a password longer than MAX_PASSWORD_LENGTH", () => {
    expect(() =>
      assertPasswordStrength("a1".repeat(MAX_PASSWORD_LENGTH / 2 + 1)),
    ).toThrow(new RegExp(`${MAX_PASSWORD_LENGTH}`));
  });

  it("rejects a non-string input", () => {
    expect(() => assertPasswordStrength(null as unknown as string)).toThrow();
  });
});
