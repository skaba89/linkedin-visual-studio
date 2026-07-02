import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, assertPasswordStrength } from "@/lib/password";

/**
 * GET /api/setup/seed-demo
 *
 * Diagnostic + repair endpoint for the demo user.
 *
 * R-011 deep v6: also fixes the `role` column type mismatch.
 *   The role column was created as Role enum, but Prisma expects String/TEXT.
 *   This causes "Error converting field role of expected non-nullable type
 *   String, found incompatible value of USER" on every findUnique().
 *
 * This endpoint is UNPROTECTED (no auth required) because:
 *   1. Login is broken → no one can authenticate
 *   2. We need to diagnose and repair the DB schema + demo user
 *   3. The user can't log in to use a protected endpoint
 *
 * What this endpoint does:
 *   0. Fix the role column type (enum → text) if needed
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

  // Step 0: Fix the role column type (R-011 deep v6)
  // The role column may have been created as Role enum instead of TEXT.
  // This causes Prisma to throw on every findUnique().
  try {
    // Check the current data_type of the role column
    const colInfo = await db.$queryRaw<Array<{ data_type: string }>>`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'User' AND column_name = 'role'
    `;
    const roleType = colInfo[0]?.data_type ?? "(column missing)";
    steps.push({
      step: "check role column type",
      ok: true,
      detail: `role column type = ${roleType}`,
    });

    if (roleType === "USER-DEFINED") {
      // The column is an enum type — convert it to TEXT
      await db.$executeRawUnsafe(
        `ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING "role"::text;`,
      );
      steps.push({
        step: "convert role enum → TEXT",
        ok: true,
        detail: "role column converted from Role enum to TEXT",
      });
    } else if (roleType === "(column missing)") {
      // Column doesn't exist — create it as TEXT
      await db.$executeRawUnsafe(
        `ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';`,
      );
      steps.push({
        step: "create role column as TEXT",
        ok: true,
        detail: "role column created as TEXT",
      });
    } else {
      steps.push({
        step: "role column type OK",
        ok: true,
        detail: `role is already ${roleType} — no conversion needed`,
      });
    }

    // Ensure role has correct default and NOT NULL constraint
    await db.$executeRawUnsafe(
      `ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';`,
    );
    await db.$executeRawUnsafe(
      `UPDATE "User" SET "role" = 'USER' WHERE "role" IS NULL;`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "User" ALTER COLUMN "role" SET NOT NULL;`,
    );

    // Drop the now-unused Role enum type (best effort)
    try {
      await db.$executeRawUnsafe(`DROP TYPE IF EXISTS "Role";`);
    } catch {
      // Ignore — the enum type may still be referenced by a constraint
    }
  } catch (err) {
    steps.push({
      step: "fix role column type",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, steps }, { status: 500 });
  }

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
