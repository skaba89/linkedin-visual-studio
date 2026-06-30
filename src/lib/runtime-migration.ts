/**
 * R-011 deep v3 — Runtime schema migration for User columns.
 *
 * Why this exists:
 *   The migration 20260630000000_add_password_hash_and_role is a large multi-
 *   statement migration that includes JSONB type conversions. If any of those
 *   conversions fails on the production DB, the ENTIRE migration fails
 *   atomically, and Prisma marks it as failed. Subsequent `prisma migrate
 *   deploy` runs skip it. This leaves User.passwordHash missing → login fails.
 *
 *   The start.sh script tries to recover with `prisma db push` and
 *   `prisma db execute`, but those only run if the Render dashboard's
 *   startCommand is set to `bash start.sh`. If the dashboard still uses
 *   the old `npx prisma migrate deploy && npm run start`, the fallbacks
 *   never run.
 *
 *   This module is imported from instrumentation-node.ts (which runs at
 *   server boot on the Node.js runtime), so it executes regardless of
 *   the startCommand configuration. It uses Prisma's $executeRawUnsafe
 *   to run the idempotent User-column-adding SQL directly.
 *
 * R-011 deep v6: also fix the `role` column type mismatch.
 *   The original runtime migration created `role` as `"Role"` ENUM type.
 *   But the Prisma schema declares `role String`. This mismatch causes
 *   Prisma to throw "Error converting field role of expected non-nullable
 *   type String, found incompatible value of USER" on every findUnique().
 *   Fix: ALTER the column type from Role enum to TEXT.
 *
 * Safety:
 *   - All statements use IF NOT EXISTS (idempotent)
 *   - Errors are caught and logged, never thrown — the server must boot
 *   - Runs once per process (guarded by a module-level flag)
 */

import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("runtime-migration");

let hasRun = false;

/**
 * Ensure the User table has the columns required for NextAuth credentials
 * login: passwordHash, passwordSalt, role, emailVerified.
 *
 * Also fix the `role` column type if it was created as ENUM instead of TEXT.
 * This is a runtime fallback for when prisma migrate deploy fails.
 */
export async function ensureUserColumns(): Promise<void> {
  if (hasRun) return;
  hasRun = true;

  const statements = [
    // 1. User.passwordHash (TEXT, nullable)
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;`,

    // 2. User.passwordSalt (TEXT, nullable — kept for backward compat)
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordSalt" TEXT;`,

    // 3. User.role (TEXT, default 'USER') — R-011 deep v6: use TEXT, NOT enum.
    //    The Prisma schema declares `role String`, so the column MUST be TEXT.
    //    If the column doesn't exist, create it as TEXT.
    //    If it exists as a different type (e.g. Role enum), convert it to TEXT.
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'role'
      ) THEN
        ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';
      END IF;
    END $$;`,

    // 3b. R-011 deep v6 — Convert role column from Role enum to TEXT if needed.
    //     This fixes the "incompatible value of USER" Prisma error.
    //     The USING clause casts the enum value to text.
    `DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'role'
        AND data_type = 'USER-DEFINED'
      ) THEN
        ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING "role"::text;
      END IF;
    END $$;`,

    // 3c. Ensure role has a default and is NOT NULL (in case it was created nullable)
    `ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';`,

    // 3d. Backfill any NULL role values to 'USER' before setting NOT NULL
    `UPDATE "User" SET "role" = 'USER' WHERE "role" IS NULL;`,

    // 3e. Set role to NOT NULL
    `ALTER TABLE "User" ALTER COLUMN "role" SET NOT NULL;`,

    // 4. User.emailVerified (TIMESTAMP, nullable)
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);`,

    // 5. R-011 deep v6 — Drop the Role enum type if it exists (no longer needed
    //    since we use TEXT now). This prevents confusion in future migrations.
    //    We use DROP TYPE IF EXISTS which is idempotent.
    `DROP TYPE IF EXISTS "Role";`,
  ];

  let succeeded = 0;
  let failed = 0;

  for (const sql of statements) {
    try {
      await db.$executeRawUnsafe(sql);
      succeeded++;
    } catch (err) {
      failed++;
      log.warn("Runtime migration statement failed (continuing)", {
        sql: sql.substring(0, 80) + "...",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log.info("Runtime User-column migration complete", {
    succeeded,
    failed,
  });
}
