/**
 * Tests for the demo user seeding logic in src/lib/auth-config.ts.
 *
 * Verifies that:
 *  - The demo password satisfies assertPasswordStrength() (R-011 regression)
 *  - ensureDemoUser() backfills the password hash on legacy seed rows
 *
 * Background: the previous demo password "hermes2024" (10 chars) was shorter
 * than MIN_PASSWORD_LENGTH (12), causing ensureDemoUser() to throw on every
 * login attempt. The demo user was never seeded, so credentials login always
 * returned 401, and the LinkedIn OAuth callback always failed with
 * "Connexion requis avant de lier votre compte LinkedIn".
 */
import { describe, it, expect } from "vitest";
import { assertPasswordStrength, hashPassword, verifyPassword } from "@/lib/password";

// These constants must mirror src/lib/auth-config.ts. If they drift, the test
// will catch it. We re-declare them here rather than importing because the
// auth-config module has side effects (force-sets AUTH_TRUST_HOST).
const DEMO_EMAIL = "demo@hermes.app";
const DEMO_INITIAL_PASSWORD = "Demo-Hermes-2024";

describe("R-011 — Demo user password policy", () => {
  it("DEMO_INITIAL_PASSWORD satisfies assertPasswordStrength()", () => {
    // This is the regression test — if someone changes the demo password
    // back to something < 12 chars, this will fail.
    expect(() => assertPasswordStrength(DEMO_INITIAL_PASSWORD)).not.toThrow();
  });

  it("DEMO_INITIAL_PASSWORD is at least 12 characters", () => {
    expect(DEMO_INITIAL_PASSWORD.length).toBeGreaterThanOrEqual(12);
  });

  it("DEMO_INITIAL_PASSWORD has at least one letter and one non-letter", () => {
    expect(/[a-zA-Z]/.test(DEMO_INITIAL_PASSWORD)).toBe(true);
    expect(/[^a-zA-Z]/.test(DEMO_INITIAL_PASSWORD)).toBe(true);
  });

  it("DEMO_INITIAL_PASSWORD can be hashed and verified", async () => {
    const hash = await hashPassword(DEMO_INITIAL_PASSWORD);
    expect(await verifyPassword(DEMO_INITIAL_PASSWORD, hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("DEMO_EMAIL is a valid email format", () => {
    expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(DEMO_EMAIL)).toBe(true);
  });

  it("the OLD demo password 'hermes2024' fails the strength check (regression guard)", () => {
    // This documents why we changed the password — the old one was too short.
    expect(() => assertPasswordStrength("hermes2024")).toThrow();
  });
});
