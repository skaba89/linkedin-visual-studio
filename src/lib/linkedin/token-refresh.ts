/**
 * HERMÈS — LinkedIn access token refresh
 *
 * LinkedIn v2 access tokens last 60 days from issuance. To keep HERMÈS
 * able to post on the user's behalf indefinitely, we refresh tokens
 * pre-expiry (when they have ≤ 7 days left).
 *
 * LinkedIn's refresh flow:
 *   POST https://www.linkedin.com/oauth/v2/accessToken
 *   Content-Type: application/x-www-form-urlencoded
 *
 *   grant_type=refresh_token
 *   refresh_token=<current_access_token>
 *   client_id=<LINKEDIN_CLIENT_ID>
 *   client_secret=<LINKEDIN_CLIENT_SECRET>
 *
 * The response is the same shape as the initial token exchange:
 *   { access_token, expires_in (seconds) }
 *
 * On success, we update LinkedInAuth.accessToken + tokenExpiresAt.
 * On failure, we log a warning — the user will need to re-authenticate
 * manually via /api/linkedin/auth. We don't surface this to the cron job
 * caller; the cron just reports aggregate stats.
 *
 * Env vars required:
 *   LINKEDIN_CLIENT_ID     — the LinkedIn app's client ID
 *   LINKEDIN_CLIENT_SECRET — the LinkedIn app's client secret
 *
 * If either is missing, the refresh is skipped with a warning. This means
 * users on the cookie-based per-tenant LinkedIn app flow (the legacy
 * callback) can't auto-refresh — they'll need to re-auth every 60 days.
 */
import { db } from "@/lib/db";
import { encrypt, isEncrypted } from "@/lib/crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("linkedin-token-refresh");

/** Refresh when ≤ this many ms remain before expiry. */
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface RefreshResult {
  userId: string;
  status: "refreshed" | "skipped" | "failed" | "not-needed" | "no-credentials";
  /** Only set on failure — the error message. */
  error?: string;
  /** Only set on success — the new expiry ISO string. */
  newExpiresAt?: string;
}

/**
 * Refresh a single user's LinkedIn token if it's nearing expiry.
 *
 * @param userId  — the HERMÈS user ID whose token should be refreshed
 * @returns the result of the refresh attempt
 */
export async function refreshLinkedInToken(userId: string): Promise<RefreshResult> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    log.warn("LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET not set — cannot refresh tokens");
    return { userId, status: "no-credentials" };
  }

  const row = await db.linkedInAuth.findUnique({
    where: { userId },
    select: { accessToken: true, tokenExpiresAt: true },
  });

  if (!row || !row.accessToken) {
    return { userId, status: "skipped", error: "no LinkedInAuth row" };
  }

  // Don't refresh if expiry is more than 7 days away — we'd burn API calls.
  if (row.tokenExpiresAt) {
    const msUntilExpiry = row.tokenExpiresAt.getTime() - Date.now();
    if (msUntilExpiry > REFRESH_WINDOW_MS) {
      return { userId, status: "not-needed" };
    }
  }

  // Decrypt the current token (we need the plaintext to use as refresh_token)
  let currentToken: string;
  if (isEncrypted(row.accessToken)) {
    try {
      const { decrypt } = await import("@/lib/crypto");
      currentToken = decrypt(row.accessToken);
    } catch (err) {
      log.error("Failed to decrypt token for refresh", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        userId,
        status: "failed",
        error: "decrypt failed",
      };
    }
  } else {
    // Legacy plaintext — use as-is
    currentToken = row.accessToken;
  }

  // Call LinkedIn's refresh endpoint
  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: currentToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.warn("LinkedIn token refresh failed", {
        userId,
        status: response.status,
        error: errorText.slice(0, 500),
      });
      return {
        userId,
        status: "failed",
        error: `LinkedIn API ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!data.access_token || typeof data.expires_in !== "number") {
      log.warn("LinkedIn refresh response missing access_token / expires_in", {
        userId,
        body: JSON.stringify(data).slice(0, 200),
      });
      return {
        userId,
        status: "failed",
        error: "malformed response",
      };
    }

    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    const newEncrypted = encrypt(data.access_token);

    await db.linkedInAuth.update({
      where: { userId },
      data: {
        accessToken: newEncrypted,
        tokenExpiresAt: newExpiresAt,
      },
    });

    log.info("LinkedIn token refreshed", {
      userId,
      newExpiresAt: newExpiresAt.toISOString(),
    });

    return {
      userId,
      status: "refreshed",
      newExpiresAt: newExpiresAt.toISOString(),
    };
  } catch (err) {
    log.error("LinkedIn refresh threw", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      userId,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Refresh all users' tokens that are within the refresh window.
 *
 * Iterates every LinkedInAuth row, attempts a refresh, returns aggregate
 * stats. Safe to call from a daily cron — only users within 7 days of
 * expiry actually hit LinkedIn's API.
 */
export async function refreshAllExpiringTokens(): Promise<{
  total: number;
  refreshed: number;
  failed: number;
  skipped: number;
  notNeeded: number;
  results: RefreshResult[];
}> {
  const rows = await db.linkedInAuth.findMany({
    select: { userId: true },
  });

  const results: RefreshResult[] = [];
  for (const row of rows) {
    const result = await refreshLinkedInToken(row.userId);
    results.push(result);
    // Small delay between calls to avoid bursting LinkedIn's rate limit
    if (result.status === "refreshed") {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return {
    total: rows.length,
    refreshed: results.filter((r) => r.status === "refreshed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped" || r.status === "no-credentials").length,
    notNeeded: results.filter((r) => r.status === "not-needed").length,
    results,
  };
}
