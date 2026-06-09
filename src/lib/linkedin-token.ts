import { cookies } from "next/headers";
import type { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";

const TOKEN_COOKIE_NAME = "li_token";
const STATE_COOKIE_NAME = "li_oauth_state";

/**
 * Simple base64 encoding/decoding for token storage.
 * In production, use proper encryption (e.g., AES with a server secret).
 */
function encode(text: string): string {
  return Buffer.from(text).toString("base64");
}

function decode(encoded: string): string {
  return Buffer.from(encoded, "base64").toString("utf-8");
}

/**
 * Get the LinkedIn access token from cookies
 */
export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);

  if (!tokenCookie?.value) return null;

  try {
    return decode(tokenCookie.value);
  } catch {
    return null;
  }
}

/**
 * Set the LinkedIn access token in a cookie (for use in API route responses)
 */
export function setTokenCookie(response: Response, token: string): void {
  const encoded = encode(token);
  response.headers.append(
    "Set-Cookie",
    `${TOKEN_COOKIE_NAME}=${encoded}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 60}` // 60 days
  );
}

/**
 * Clear the LinkedIn token cookie
 */
export function clearTokenCookie(response: Response): void {
  response.headers.append(
    "Set-Cookie",
    `${TOKEN_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
}

/**
 * Store OAuth state parameter in a cookie
 */
export function setStateCookie(response: Response, state: string): void {
  response.headers.append(
    "Set-Cookie",
    `${STATE_COOKIE_NAME}=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600` // 10 minutes
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
    `${STATE_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
}

/**
 * Generate a random state string for CSRF protection
 */
export function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}
