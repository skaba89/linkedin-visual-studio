import { cookies } from "next/headers";
import type { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { createLogger } from "@/lib/logger";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const log = createLogger("linkedin-token");

const TOKEN_COOKIE_NAME = "li_token";
const STATE_COOKIE_NAME = "li_oauth_state";

/**
 * HERMÈS — R-004 — LinkedIn token storage
 *
 * Le token LinkedIn est chiffré (AES-256-GCM) avant d'être posé en cookie ET
 * persisté en base (LinkedInAuth.accessToken). La clé de chiffrement est
 * `ENCRYPTION_KEY` (variable d'env, générée via `openssl rand -hex 32`).
 *
 * Format de stockage : `v1:<iv>:<ciphertext>:<tag>` (tous en base64).
 *
 * Deux surfaces de stockage, par ordre de priorité de lecture :
 *   1. Cookie httpOnly `li_token` (durée 60j, valide pour le browser courant)
 *   2. Colonne `LinkedInAuth.accessToken` (persistance cross-device, survit
 *      à l'expiration du cookie — utilisé pour les publications planifiées
 *      déclenchées côté serveur sans session browser active)
 *
 * Migration : les cookies posés avant cette version contenaient du base64
 * simple (réversible sans clé). `getTokenFromCookies()` détecte le format
 * et décode l'ancien format en fallback pour ne pas casser les sessions
 * existantes pendant la transition.
 *
 * Pour le stockage en base (LinkedInAuth.accessToken), utiliser
 * `persistTokenToDB()` / `getDecryptedTokenFromDB()` — ils wrappent
 * `encrypt()` / `decrypt()` et gèrent la migration des valeurs legacy
 * plaintext.
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
 * Profile data fetched from LinkedIn OpenID Connect /v2/userinfo.
 * Used to populate LinkedInAuth row alongside the encrypted token.
 */
export interface LinkedInProfile {
  /** LinkedIn person URN ID (sub field in OIDC) — e.g. "abc123XYZ" */
  linkedInUserId: string;
  firstName?: string;
  lastName?: string;
  /** ISO 8601 expiry timestamp from token response (optional) */
  tokenExpiresAt?: Date;
  profilePictureUrl?: string | null;
}

/**
 * Persist the LinkedIn access token (encrypted) to the database for the
 * given user. Also stores optional profile data fetched via OIDC.
 *
 * Uses `upsert` because `LinkedInAuth.userId` is @unique — only one row
 * per user is allowed.
 *
 * HERMÈS R-004 deep: the token is encrypted with AES-256-GCM before being
 * written. The plaintext never touches the DB.
 *
 * @param userId   — the authenticated user's id (from requireUser())
 * @param token    — the plaintext LinkedIn access token
 * @param profile  — optional LinkedIn profile data (linkedInUserId, names, etc.)
 */
export async function persistTokenToDB(
  userId: string,
  token: string,
  profile?: LinkedInProfile,
): Promise<void> {
  if (!userId) {
    throw new Error("persistTokenToDB(): userId is required");
  }
  if (!token) {
    log.warn("persistTokenToDB called with empty token — skipping write", { userId });
    return;
  }

  const encrypted = encrypt(token);

  await db.linkedInAuth.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: encrypted,
      linkedInUserId: profile?.linkedInUserId ?? "",
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      profilePictureUrl: profile?.profilePictureUrl ?? null,
      tokenExpiresAt: profile?.tokenExpiresAt ?? null,
    },
    update: {
      accessToken: encrypted,
      // Only overwrite profile fields when a profile was actually fetched
      ...(profile
        ? {
            linkedInUserId: profile.linkedInUserId,
            firstName: profile.firstName ?? "",
            lastName: profile.lastName ?? "",
            profilePictureUrl: profile.profilePictureUrl ?? null,
            tokenExpiresAt: profile.tokenExpiresAt ?? null,
          }
        : {}),
    },
  });

  log.info("Persisted encrypted LinkedIn token to DB", {
    userId,
    linkedInUserId: profile?.linkedInUserId ?? "(unknown)",
    hasProfile: Boolean(profile),
  });
}

/**
 * Read the LinkedIn access token from the database (decrypted).
 *
 * Handles two storage formats:
 *  - v1: ciphertext (R-004 onwards) — decrypt with ENCRYPTION_KEY
 *  - legacy plaintext (pre-R-004) — returned as-is with a warn log
 *
 * @returns the plaintext token, or null if:
 *  - no LinkedInAuth row exists for this user
 *  - the row exists but accessToken is empty
 *  - decryption fails (tampered ciphertext or wrong ENCRYPTION_KEY)
 */
export async function getDecryptedTokenFromDB(
  userId: string,
): Promise<string | null> {
  if (!userId) return null;

  const row = await db.linkedInAuth.findUnique({
    where: { userId },
    select: { accessToken: true },
  });

  if (!row) return null;
  const stored = row.accessToken;
  if (!stored) return null;

  // R-004 format — decrypt
  if (isEncrypted(stored)) {
    try {
      return decrypt(stored);
    } catch (err) {
      log.warn("Failed to decrypt LinkedIn token from DB", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  // Legacy plaintext — log warn (should be migrated via the script)
  log.warn("Found legacy plaintext LinkedIn token in DB — should run migration script", {
    userId,
    legacy: true,
  });
  return stored;
}

/**
 * Get the active LinkedIn access token for the current user.
 *
 * Resolution order:
 *  1. Cookie (fast path — same browser session)
 *  2. Database (slow path — cross-device, scheduled jobs, expired cookie)
 *
 * @returns the plaintext token, or null if neither source has a valid token.
 */
export async function getActiveLinkedInToken(userId: string): Promise<string | null> {
  // Try cookie first
  const cookieToken = await getTokenFromCookies();
  if (cookieToken) return cookieToken;

  // Fall back to DB
  return getDecryptedTokenFromDB(userId);
}

/**
 * Fetch the LinkedIn profile of the token owner via OpenID Connect.
 *
 * Endpoint: GET https://api.linkedin.com/v2/userinfo
 * Required scope: `openid profile email` (already in our SCOPES list)
 *
 * @returns a LinkedInProfile object, or null if the API call fails.
 */
export async function fetchLinkedInProfile(
  accessToken: string,
): Promise<LinkedInProfile | null> {
  try {
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      log.warn("LinkedIn /v2/userinfo failed", {
        status: res.status,
        statusText: res.statusText,
      });
      return null;
    }
    const data = (await res.json()) as {
      sub?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
    };
    if (!data.sub) {
      log.warn("LinkedIn /v2/userinfo returned no `sub` field");
      return null;
    }
    return {
      linkedInUserId: data.sub,
      firstName: data.given_name ?? "",
      lastName: data.family_name ?? "",
      profilePictureUrl: data.picture ?? null,
    };
  } catch (err) {
    log.warn("LinkedIn /v2/userinfo threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Re-export crypto helpers for routes that need to encrypt/decrypt tokens
 * stored in the database (LinkedInAuth.accessToken column).
 */
export { encrypt, decrypt, isEncrypted } from "@/lib/crypto";
