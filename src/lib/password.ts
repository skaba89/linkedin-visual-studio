/**
 * HERMÈS — R-001 — Password hashing utilities
 *
 * Uses Node's built-in `crypto.scrypt` (OWASP-recommended memory-hard KDF).
 * No external dependency required (no argon2 / bcrypt native bindings).
 *
 * Storage format (single string, all hex):
 *   scrypt:<N>:<r>:<p>:<salt>:<hash>
 *
 * Where:
 *   N — CPU/memory cost (default 16384 = 2^14, ~64 MiB memory)
 *   r — block size (default 8)
 *   p — parallelism (default 1)
 *   salt — 32 random bytes (64 hex chars)
 *   hash — derived key (64 hex chars = 32 bytes)
 *
 * Reference: https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback
 */

import {
  randomBytes,
  scrypt as _scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

/** Default scrypt parameters (tune N up for production if needed). */
const DEFAULT_PARAMS = {
  N: 16384, // CPU/memory cost
  r: 8, // block size
  p: 1, // parallelism
  keylen: 32, // derived key length (bytes)
  saltlen: 32, // salt length (bytes)
} as const;

/** Minimum password length enforced by the helpers. */
export const MIN_PASSWORD_LENGTH = 12;
/** Maximum password length (DoS guard against huge inputs). */
export const MAX_PASSWORD_LENGTH = 1024;

/**
 * Hash a plaintext password using scrypt.
 *
 * @throws if password is empty or > MAX_PASSWORD_LENGTH
 */
export async function hashPassword(
  password: string,
  opts: Partial<typeof DEFAULT_PARAMS> = {},
): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new Error("password must be a non-empty string");
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`password exceeds ${MAX_PASSWORD_LENGTH} chars`);
  }

  const params = { ...DEFAULT_PARAMS, ...opts };
  const salt = randomBytes(params.saltlen);
  const derived = await scrypt(password, salt, params.keylen, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 128 * 1024 * 1024, // 128 MiB ceiling
  });

  return [
    "scrypt",
    params.N.toString(16),
    params.r.toString(16),
    params.p.toString(16),
    salt.toString("hex"),
    derived.toString("hex"),
  ].join(":");
}

/**
 * Verify a plaintext password against a stored scrypt hash.
 *
 * Returns `false` (never throws) on:
 *  - unknown format (incl. null/undefined hash)
 *  - any derivation error
 *
 * Constant-time comparison via `timingSafeEqual` prevents timing attacks.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!password || !stored) return false;
  if (typeof stored !== "string") return false;

  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  let N: number, r: number, p: number;
  let salt: Buffer, expected: Buffer;
  try {
    N = parseInt(parts[1], 16);
    r = parseInt(parts[2], 16);
    p = parseInt(parts[3], 16);
    salt = Buffer.from(parts[4], "hex");
    expected = Buffer.from(parts[5], "hex");
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
      return false;
    }
    if (salt.length === 0 || expected.length === 0) return false;
  } catch {
    return false;
  }

  let derived: Buffer;
  try {
    derived = await scrypt(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 128 * 1024 * 1024,
    });
  } catch {
    return false;
  }

  // Constant-time comparison — only safe when lengths match
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * Quick check that a string looks like a scrypt hash (no crypto work).
 * Useful for schema validation before calling `verifyPassword`.
 */
export function isHashedPassword(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^scrypt:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]{64}:[0-9a-f]{64}$/.test(
    value,
  );
}

/**
 * Validate password strength (basic). Throws with a user-readable message.
 *
 * Rules:
 *  - ≥ 12 chars (NIST 800-63B + OWASP 2023)
 *  - ≤ 1024 chars (DoS guard)
 *  - At least one letter and one non-letter (digit or symbol)
 */
export function assertPasswordStrength(password: string): void {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    );
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }
  if (!/[a-zA-Z]/.test(password) || !/[^a-zA-Z]/.test(password)) {
    throw new Error(
      "Password must contain at least one letter and one non-letter character",
    );
  }
}
