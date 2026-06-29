import { cookies } from "next/headers";
import type { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { createLogger } from "@/lib/logger";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";
import { randomBytes } from "node:crypto";

const log = createLogger("linkedin-token");

const TOKEN_COOKIE_NAME = "li_token";
const STATE_COOKIE_NAME = "li_oauth_state";

/**
 * HERMÈS — R-004 — LinkedIn token storage
 *
 * Le token LinkedIn est désormais chiffré (AES-256-GCM) avant d'être posé
 * en cookie. La clé de chiffrement est `ENCRYPTION_KEY` (variable d'env,
 * générée via `openssl rand -hex 32`).
 *
 * Format du cookie : `v1:<iv>:<ciphertext>:<tag>` (tous en base64).
 *
 * Migration : les cookies posés avant cette version contenaient du base64
 * simple (reversible sans clé). `getTokenFromCookies()` détecte le format
 * et décode l'ancien format en fallback pour ne pas casser les sessions
 * existantes pendant la transition.
 *
 * Pour le stockage en base (LinkedInAuth.accessToken), utiliser directement
 * `encrypt()` / `decrypt()` depuis `@/lib/crypto`.
 */

/**
 * Get the LinkedIn access token from cookies.
 *
 * @returns the decrypted plaintext token, or null if:
 *  - no cookie is present
 *  - the cookie is malformed
 *  - decryption fails (tampered or wrong ENCRYPTION_KEY)
 *
 * Backward-compat: legacy base64-encoded cookies are still decoded during
 * the transition period (logged as warn).
 */
export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);

  if (!tokenCookie?.value) return null;

  const raw = tokenCookie.value;

  // New format: v1:<iv>:<ciphertext>:<tag>
  if (isEncrypted(raw)) {
    try {
      return decrypt(raw);
    } catch (err) {
      log.warn("Failed to decrypt LinkedIn token from cookie", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  // Legacy format: plain base64 (R-004 pre-migration)
  // Decode for backward-compat — will be replaced on next setTokenCookie()
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    log.warn("Decoded legacy (unencrypted) LinkedIn token cookie — will be re-encrypted on next set", {
      legacy: true,
    });
    return decoded;
  } catch (err) {
    log.warn("Failed to decode LinkedIn token from cookie", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Set the LinkedIn access token in a cookie (encrypted).
 *
 * Uses AES-256-GCM with ENCRYPTION_KEY. The cookie is HttpOnly + SameSite=Lax
 * and expires in 60 days (LinkedIn token lifetime).
 */
export function setTokenCookie(response: Response, token: string): void {
  if (!token) {
    log.warn("setTokenCookie called with empty token — skipping");
    return;
  }
  const encrypted = encrypt(token);
  response.headers.append(
    "Set-Cookie",
    `${TOKEN_COOKIE_NAME}=${encrypted}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 60} ${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}

/**
 * Clear the LinkedIn token cookie
 */
export function clearTokenCookie(response: Response): void {
  response.headers.append(
    "Set-Cookie",
    `${TOKEN_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  );
}

/**
 * Store OAuth state parameter in a cookie
 */
export function setStateCookie(response: Response, state: string): void {
  response.headers.append(
    "Set-Cookie",
    `${STATE_COOKIE_NAME}=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`, // 10 minutes
  );
}

/**
 * Get OAuth state from cookies
 */
export async function getStateFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE_NAME);
  return stateCookie?.value ?? null;
}

/**
 * Clear OAuth state cookie
 */
export function clearStateCookie(response: Response): void {
  response.headers.append(
    "Set-Cookie",
    `${STATE_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  );
}

/**
 * Generate a random state string for CSRF protection.
 *
 * HERMÈS R-004: replaces the previous Math.random()-based implementation
 * with a CSPRNG (node:crypto.randomBytes) — 16 bytes hex = 128 bits of
 * entropy, which is the minimum recommended for CSRF tokens.
 */
export function generateState(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Re-export crypto helpers for routes that need to encrypt/decrypt tokens
 * stored in the database (LinkedInAuth.accessToken column).
 */
export { encrypt, decrypt, isEncrypted } from "@/lib/crypto";
