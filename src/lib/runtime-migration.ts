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
 * This is a runtime fallback for when prisma migrate deploy fails.
 */
export async function ensureUserColumns(): Promise<void> {
  if (hasRun) return;
  hasRun = true;

  const statements = [
    // 1. Role enum type
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
        CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
      END IF;
    END $$;`,

    // 2. User.passwordHash (TEXT, nullable)
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;`,

    // 3. User.passwordSalt (TEXT, nullable — kept for backward compat)
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordSalt" TEXT;`,

    // 4. User.role (Role enum, default USER) — use DO block for enum-typed column
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'role'
      ) THEN
        ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';
      END IF;
    END $$;`,

    // 5. User.emailVerified (TIMESTAMP, nullable)
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);`,
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
