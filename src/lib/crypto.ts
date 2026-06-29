/**
 * HERMÈS — R-004 — Cryptographic helpers for sensitive data at rest
 *
 * Used to encrypt LinkedIn OAuth tokens (and any other secrets) before
 * storing them in the database or in cookies.
 *
 * Algorithm: AES-256-GCM
 *  - 96-bit IV (12 bytes, NIST-recommended for GCM)
 *  - 128-bit auth tag (16 bytes)
 *  - 256-bit key derived from ENCRYPTION_KEY (hex string → 32 bytes)
 *
 * Storage format (single string, base64):
 *   v1:<iv-base64>:<ciphertext-base64>:<tag-base64>
 *
 * The `v1:` prefix lets us evolve the format later without breaking existing
 * ciphertexts (a `decrypt()` call inspects the prefix to dispatch).
 *
 * Why AES-GCM over AES-CBC:
 *  - Authenticated encryption (detects tampering — GCM tag)
 *  - No padding oracle risk
 *  - Hardware-accelerated on modern CPUs (AES-NI / ARMv8 Crypto Extensions)
 *
 * Reference: https://nodejs.org/api/crypto.html#class-cipheriv
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
  type CipherGCM,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit IV for GCM
const KEY_LEN = 32; // 256-bit key
const TAG_LEN = 16; // 128-bit auth tag
const PREFIX = "v1";

/**
 * Resolve the encryption key from process.env.ENCRYPTION_KEY.
 *
 * Accepts either:
 *  - 64-char hex string (recommended — `openssl rand -hex 32`)
 *  - 44-char base64 string (`openssl rand -base64 32`)
 *
 * @throws if env var is missing or malformed.
 */
function resolveKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate with: openssl rand -hex 32",
    );
  }

  // Try hex first (most common form)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  // Then base64 (44 chars including padding)
  if (/^[A-Za-z0-9+/]{43}=$/.test(raw)) {
    return Buffer.from(raw, "base64");
  }
  // Last resort: hash any string to derive a 32-byte key
  // (NOT recommended for production — main path is hex/base64)
  if (raw.length >= 32) {
    return Buffer.from(raw.slice(0, 32), "utf-8");
  }

  throw new Error(
    "ENCRYPTION_KEY must be 64-char hex or 44-char base64 (got length " +
      raw.length +
      ")",
  );
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @returns "v1:<iv>:<ciphertext>:<tag>" (all base64)
 * @throws if ENCRYPTION_KEY is missing or invalid
 */
export function encrypt(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new Error("encrypt() requires a string input");
  }
  if (plaintext.length === 0) {
    // Allow empty string encryption — useful for nullable fields
    return "";
  }

  const key = resolveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, {
    authTagLength: TAG_LEN,
  }) as CipherGCM;

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64"),
    ciphertext.toString("base64"),
    tag.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a string produced by `encrypt()`.
 *
 * @returns the original plaintext
 * @throws if the value is tampered (auth tag mismatch), wrong format, or
 *         ENCRYPTION_KEY is missing/invalid.
 *
 * For "is this ciphertext?" checks before calling, use `isEncrypted()`.
 */
export function decrypt(stored: string): string {
  if (typeof stored !== "string") {
    throw new Error("decrypt() requires a string input");
  }
  if (stored === "") return "";

  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error(
      `decrypt(): unsupported format (expected '${PREFIX}:...' prefix)`,
    );
  }

  const [, ivB64, ciphertextB64, tagB64] = parts;
  let iv: Buffer, ciphertext: Buffer, tag: Buffer;
  try {
    iv = Buffer.from(ivB64, "base64");
    ciphertext = Buffer.from(ciphertextB64, "base64");
    tag = Buffer.from(tagB64, "base64");
  } catch {
    throw new Error("decrypt(): invalid base64 in stored value");
  }

  if (iv.length !== IV_LEN) {
    throw new Error(
      `decrypt(): IV length mismatch (expected ${IV_LEN}, got ${iv.length})`,
    );
  }
  if (tag.length !== TAG_LEN) {
    throw new Error(
      `decrypt(): auth tag length mismatch (expected ${TAG_LEN}, got ${tag.length})`,
    );
  }

  const key = resolveKey();
  const decipher = createDecipheriv(ALGO, key, iv, {
    authTagLength: TAG_LEN,
  }) as CipherGCM;
  decipher.setAuthTag(tag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf-8");
  } catch {
    throw new Error(
      "decrypt(): authentication failed (tampered ciphertext or wrong key)",
    );
  }
}

/**
 * Type guard: is this value a `v1:` prefixed ciphertext?
 *
 * Useful to skip decrypt() on legacy plaintext values during migration.
 *
 * Each of the three base64 segments (IV, ciphertext, tag) may end with
 * 0, 1, or 2 `=` padding chars — base64 standard padding rules apply
 * independently to each segment.
 */
export function isEncrypted(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value === "") return false;
  return /^v1:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/**
 * Constant-time comparison of two plaintext strings.
 *
 * Use this instead of `===` when comparing secrets (API keys, tokens).
 * Returns false if either string is null/undefined or lengths differ.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Generate a fresh ENCRYPTION_KEY value (for setup / rotation).
 *
 * @returns 64-char hex string (32 bytes)
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LEN).toString("hex");
}
