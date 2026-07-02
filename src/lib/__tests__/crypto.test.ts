/**
 * HERMÈS — R-004 — Tests unitaires pour src/lib/crypto.ts
 *
 * Couvre :
 *  - encrypt : format v1:, longueur, non-déterminisme (IV aléatoire)
 *  - decrypt : round-trip, erreurs sur format corrompu / mauvaise clé
 *  - isEncrypted : type guard regex
 *  - safeEqual : comparaison constant-time
 *  - generateEncryptionKey : longueur et format hex
 *
 * Run : npx vitest run src/lib/__tests__/crypto.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  encrypt,
  decrypt,
  isEncrypted,
  safeEqual,
  generateEncryptionKey,
} from "@/lib/crypto";

// Force a stable ENCRYPTION_KEY for tests
const TEST_KEY = "a".repeat(64); // 64-char hex (32 bytes)
const OTHER_KEY = "b".repeat(64);

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
});

describe("encrypt", () => {
  it("produces a v1:-prefixed string with 4 colon-separated parts", () => {
    const ct = encrypt("hello world");
    expect(ct.startsWith("v1:")).toBe(true);
    expect(ct.split(":")).toHaveLength(4);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const a = encrypt("same plaintext");
    const b = encrypt("same plaintext");
    expect(a).not.toBe(b);
  });

  it("returns empty string for empty input", () => {
    expect(encrypt("")).toBe("");
  });

  it("throws on non-string input", () => {
    expect(() => encrypt(null as unknown as string)).toThrow(/string/);
    expect(() => encrypt(undefined as unknown as string)).toThrow(/string/);
    expect(() => encrypt(42 as unknown as string)).toThrow(/string/);
  });

  it("supports Unicode (emoji, CJK, accents)", () => {
    const plaintext = "Héllo 世界 🌍 — café";
    const ct = encrypt(plaintext);
    expect(decrypt(ct)).toBe(plaintext);
  });

  it("supports long inputs (10 KiB)", () => {
    const plaintext = "x".repeat(10 * 1024);
    const ct = encrypt(plaintext);
    expect(decrypt(ct)).toBe(plaintext);
  });
});

describe("decrypt", () => {
  it("round-trips correctly", () => {
    const plaintext = "round-trip test 123";
    const ct = encrypt(plaintext);
    expect(decrypt(ct)).toBe(plaintext);
  });

  it("returns empty string for empty input", () => {
    expect(decrypt("")).toBe("");
  });

  it("throws on non-string input", () => {
    expect(() => decrypt(null as unknown as string)).toThrow(/string/);
  });

  it("throws on missing v1: prefix", () => {
    expect(() => decrypt("plaintext-no-prefix")).toThrow(/unsupported format/);
    expect(() => decrypt("v2:foo:bar:baz")).toThrow(/unsupported format/);
  });

  it("throws on wrong number of parts", () => {
    expect(() => decrypt("v1:only:two")).toThrow(/unsupported format/);
    expect(() => decrypt("v1:a:b:c:d")).toThrow(/unsupported format/);
  });

  it("throws on invalid base64", () => {
    // Base64 of invalid chars
    expect(() => decrypt("v1:!!!:!!!:!!!")).toThrow();
  });

  it("throws on tampered ciphertext (auth tag mismatch)", () => {
    const ct = encrypt("secret");
    // Flip a byte in the ciphertext portion
    const parts = ct.split(":");
    const cipherBuf = Buffer.from(parts[2], "base64");
    cipherBuf[0] ^= 0xff;
    parts[2] = cipherBuf.toString("base64");
    const tampered = parts.join(":");
    expect(() => decrypt(tampered)).toThrow(/authentication failed/i);
  });

  it("throws on tampered auth tag", () => {
    const ct = encrypt("secret");
    const parts = ct.split(":");
    const tagBuf = Buffer.from(parts[3], "base64");
    tagBuf[0] ^= 0xff;
    parts[3] = tagBuf.toString("base64");
    const tampered = parts.join(":");
    expect(() => decrypt(tampered)).toThrow(/authentication failed/i);
  });

  it("throws when ENCRYPTION_KEY changes (key rotation without re-encrypt)", () => {
    const ct = encrypt("with original key");
    process.env.ENCRYPTION_KEY = OTHER_KEY;
    expect(() => decrypt(ct)).toThrow(/authentication failed/i);
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  it("throws when ENCRYPTION_KEY is missing", () => {
    const ct = encrypt("with key set");
    delete process.env.ENCRYPTION_KEY;
    expect(() => decrypt(ct)).toThrow(/ENCRYPTION_KEY is not set/);
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });
});

describe("isEncrypted", () => {
  it("returns true for a freshly encrypted value", () => {
    expect(isEncrypted(encrypt("anything"))).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isEncrypted("")).toBe(false);
  });

  it("returns false for plaintext without v1: prefix", () => {
    expect(isEncrypted("plaintext token")).toBe(false);
    expect(isEncrypted("AQUvX...plaintextbase64...")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
    expect(isEncrypted(42)).toBe(false);
    expect(isEncrypted({ v1: "x" })).toBe(false);
  });
});

describe("safeEqual", () => {
  it("returns true for equal strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("abcd", "abc")).toBe(false);
  });

  it("returns false when either argument is null/undefined", () => {
    expect(safeEqual(null, "abc")).toBe(false);
    expect(safeEqual("abc", null)).toBe(false);
    expect(safeEqual(undefined, "abc")).toBe(false);
    expect(safeEqual("abc", undefined)).toBe(false);
  });

  it("returns false for empty strings", () => {
    expect(safeEqual("", "")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });
});

describe("generateEncryptionKey", () => {
  it("returns a 64-char hex string", () => {
    const key = generateEncryptionKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key.length).toBe(64);
  });

  it("produces different keys on each call (random)", () => {
    const a = generateEncryptionKey();
    const b = generateEncryptionKey();
    expect(a).not.toBe(b);
  });

  it("can be used as ENCRYPTION_KEY for encrypt/decrypt round-trip", () => {
    const key = generateEncryptionKey();
    process.env.ENCRYPTION_KEY = key;
    const ct = encrypt("test with generated key");
    expect(decrypt(ct)).toBe("test with generated key");
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });
});

describe("key format acceptance", () => {
  it("accepts 64-char hex", () => {
    process.env.ENCRYPTION_KEY = "0".repeat(64);
    expect(decrypt(encrypt("hex test"))).toBe("hex test");
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  it("accepts 44-char base64", () => {
    // 32 bytes → 44 base64 chars with padding
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 0x42).toString("base64");
    expect(decrypt(encrypt("base64 test"))).toBe("base64 test");
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  it("throws on too-short string", () => {
    process.env.ENCRYPTION_KEY = "short";
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  it("throws when env var is missing", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY is not set/);
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });
});
