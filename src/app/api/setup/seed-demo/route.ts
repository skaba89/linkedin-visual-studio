import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, assertPasswordStrength } from "@/lib/password";

/**
 * GET /api/setup/seed-demo
 *
 * Diagnostic + repair endpoint for the demo user.
 *
 * This endpoint is UNPROTECTED (no auth required) because:
 *   1. The User table columns now exist (R-011 deep v4 deployed)
 *   2. But login still fails with CredentialsSignin → authorize() returns null
 *   3. We need to diagnose WHY: is the demo user missing? passwordHash null?
 *      password verification failing?
 *   4. The user can't log in to use a protected endpoint
 *
 * What this endpoint does:
 *   1. Checks if demo@hermes.app exists in the DB
 *   2. If not, tries to create it and reports any error
 *   3. If yes, checks if passwordHash is set
 *   4. Tests password verification against the known demo password
 *   5. If passwordHash is missing or wrong, sets it to the correct hash
 *   6. Returns a full diagnostic report
 *
 * Security: only operates on demo@hermes.app, never reads/modifies other users.
 * Once login works, this endpoint can be deleted.
 */

const DEMO_EMAIL = "demo@hermes.app";
const DEMO_PASSWORD = "Demo-Hermes-2024";

type Step = { step: string; ok: boolean; detail?: string };
type DemoUser = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  role: string;
  emailVerified: Date | null;
  createdAt: Date;
};

export async function GET() {
  const steps: Step[] = [];
  let user: DemoUser | null = null;

  // Step 1: Verify password strength check passes
  try {
    assertPasswordStrength(DEMO_PASSWORD);
    steps.push({ step: "assertPasswordStrength", ok: true });
  } catch (err) {
    steps.push({
      step: "assertPasswordStrength",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, steps }, { status: 500 });
  }

  // Step 2: Check if demo user exists
  try {
    const found = await db.user.findUnique({
      where: { email: DEMO_EMAIL },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    user = found as DemoUser | null;
    steps.push({
      step: "findUnique(demo@hermes.app)",
      ok: true,
      detail: user ? `user found (id=${user.id})` : "user NOT found",
    });
  } catch (err) {
    steps.push({
      step: "findUnique(demo@hermes.app)",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, steps }, { status: 500 });
  }

  // Step 3: If user doesn't exist, create it
  if (!user) {
    try {
      const hashed = await hashPassword(DEMO_PASSWORD);
      const created = await db.user.create({
        data: {
          email: DEMO_EMAIL,
          name: "Demo User",
          passwordHash: hashed,
          role: "USER",
          emailVerified: new Date(),
        },
      });
      user = {
        id: created.id,
        email: created.email,
        name: created.name,
        passwordHash: created.passwordHash,
        role: created.role,
        emailVerified: created.emailVerified,
        createdAt: created.createdAt,
      };
      steps.push({
        step: "create(demo@hermes.app)",
        ok: true,
        detail: `created with id=${user.id}`,
      });
    } catch (err) {
      steps.push({
        step: "create(demo@hermes.app)",
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ ok: false, steps }, { status: 500 });
    }
  }

  // At this point, user is non-null — but TS doesn't know that, so use a local ref
  const u: DemoUser = user;

  // Step 4: Check if passwordHash is set
  if (!u.passwordHash) {
    steps.push({
      step: "check passwordHash",
      ok: false,
      detail: "passwordHash is null — setting it now",
    });
    try {
      const hashed = await hashPassword(DEMO_PASSWORD);
      await db.user.update({
        where: { id: u.id },
        data: { passwordHash: hashed },
      });
      u.passwordHash = hashed;
      steps.push({
        step: "update(passwordHash)",
        ok: true,
        detail: "passwordHash set",
      });
    } catch (err) {
      steps.push({
        step: "update(passwordHash)",
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ ok: false, steps }, { status: 500 });
    }
  } else {
    steps.push({
      step: "check passwordHash",
      ok: true,
      detail: "passwordHash is set",
    });
  }

  // Step 5: Test password verification
  try {
    const verified = await verifyPassword(DEMO_PASSWORD, u.passwordHash!);
    steps.push({
      step: "verifyPassword",
      ok: verified,
      detail: verified ? "password verified successfully" : "password verification FAILED — will reset",
    });
    if (!verified) {
      // Force-reset the password
      const hashed = await hashPassword(DEMO_PASSWORD);
      await db.user.update({
        where: { id: u.id },
        data: { passwordHash: hashed },
      });
      steps.push({
        step: "force-reset password",
        ok: true,
        detail: "password reset to Demo-Hermes-2024",
      });
    }
  } catch (err) {
    steps.push({
      step: "verifyPassword",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, steps }, { status: 500 });
  }

  // Step 6: Final state
  const ok = steps.every((s) => s.ok);
  const report = {
    ok,
    timestamp: new Date().toISOString(),
    steps,
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      hasPasswordHash: !!u.passwordHash,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
    },
    message: ok
      ? "Demo user is ready. Login with demo@hermes.app / Demo-Hermes-2024 should now work."
      : "Some steps failed — see steps array for details.",
  };

  return NextResponse.json(report, { status: ok ? 200 : 500 });
}
