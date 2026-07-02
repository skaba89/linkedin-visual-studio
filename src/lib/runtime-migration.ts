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

    // ─── Phase 3 — Engagement Intelligence tables ───────────────────────────
    // These ensure the 4 engagement tables + UserSettings engagement columns
    // exist even if migration 20260702010000_add_engagement_intelligence hasn't
    // been applied (which is the root cause of the 500 errors on
    // /api/data/reactors, /api/data/profile-visitors, /api/data/trending,
    // /api/data/engagement-settings right after a fresh deploy).

    // 6. UserSettings engagement columns (Phase 3)
    `ALTER TABLE "UserSettings"
       ADD COLUMN IF NOT EXISTS "engagementAutoReply"       BOOLEAN NOT NULL DEFAULT false,
       ADD COLUMN IF NOT EXISTS "engagementMaxDailyComments" INTEGER NOT NULL DEFAULT 3,
       ADD COLUMN IF NOT EXISTS "engagementTone"            TEXT    NOT NULL DEFAULT 'expert',
       ADD COLUMN IF NOT EXISTS "engagementMinHoursBetween" DOUBLE PRECISION NOT NULL DEFAULT 2;`,

    // 7. LinkedInReactor table (Phase 3)
    `CREATE TABLE IF NOT EXISTS "LinkedInReactor" (
      "id"                  TEXT   NOT NULL,
      "userId"              TEXT   NOT NULL,
      "postUrn"             TEXT   NOT NULL,
      "postId"              TEXT,
      "reactorLinkedInId"   TEXT   NOT NULL,
      "reactorName"         TEXT   NOT NULL DEFAULT '',
      "reactorHeadline"     TEXT,
      "reactorProfileUrl"   TEXT,
      "reactorAvatarUrl"    TEXT,
      "action"              TEXT   NOT NULL,
      "commentText"         TEXT,
      "commentUrn"          TEXT,
      "capturedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "syncedToCrmAt"       TIMESTAMP(3),
      "contactId"           TEXT,
      "ignored"             BOOLEAN NOT NULL DEFAULT false,
      "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"           TIMESTAMP(3) NOT NULL,
      CONSTRAINT "LinkedInReactor_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "LinkedInReactor_userId_postUrn_reactorLinkedInId_actio_key"
       ON "LinkedInReactor"("userId", "postUrn", "reactorLinkedInId", "action");`,
    `CREATE INDEX IF NOT EXISTS "LinkedInReactor_userId_action_idx"
       ON "LinkedInReactor"("userId", "action");`,
    `CREATE INDEX IF NOT EXISTS "LinkedInReactor_userId_syncedToCrmAt_idx"
       ON "LinkedInReactor"("userId", "syncedToCrmAt");`,
    `CREATE INDEX IF NOT EXISTS "LinkedInReactor_userId_capturedAt_idx"
       ON "LinkedInReactor"("userId", "capturedAt");`,

    // 8. TrendingTopic table (Phase 3)
    `CREATE TABLE IF NOT EXISTS "TrendingTopic" (
      "id"                TEXT   NOT NULL,
      "userId"            TEXT   NOT NULL,
      "topic"             TEXT   NOT NULL,
      "angle"             TEXT   NOT NULL DEFAULT '',
      "heat"              TEXT   NOT NULL DEFAULT 'warm',
      "suggestedHook"     TEXT   NOT NULL DEFAULT '',
      "sourceUrl"         TEXT,
      "detectedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "status"            TEXT   NOT NULL DEFAULT 'new',
      "targetPostUrn"     TEXT,
      "targetPostExcerpt" TEXT,
      "commentText"       TEXT,
      "commentUrn"        TEXT,
      "postedAt"          TIMESTAMP(3),
      "error"             TEXT,
      "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"         TIMESTAMP(3) NOT NULL,
      CONSTRAINT "TrendingTopic_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "TrendingTopic_userId_status_idx"
       ON "TrendingTopic"("userId", "status");`,
    `CREATE INDEX IF NOT EXISTS "TrendingTopic_userId_detectedAt_idx"
       ON "TrendingTopic"("userId", "detectedAt");`,

    // 9. ProfileVisitor table (Phase 3)
    `CREATE TABLE IF NOT EXISTS "ProfileVisitor" (
      "id"                TEXT   NOT NULL,
      "userId"            TEXT   NOT NULL,
      "visitorName"       TEXT   NOT NULL,
      "visitorHeadline"   TEXT,
      "visitorProfileUrl" TEXT,
      "visitedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "source"            TEXT   NOT NULL DEFAULT 'manual',
      "note"              TEXT,
      "syncedToCrmAt"     TIMESTAMP(3),
      "contactId"         TEXT,
      "ignored"           BOOLEAN NOT NULL DEFAULT false,
      "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"         TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ProfileVisitor_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "ProfileVisitor_userId_visitedAt_idx"
       ON "ProfileVisitor"("userId", "visitedAt");`,
    `CREATE INDEX IF NOT EXISTS "ProfileVisitor_userId_syncedToCrmAt_idx"
       ON "ProfileVisitor"("userId", "syncedToCrmAt");`,

    // 10. ExpertComment table (Phase 3)
    `CREATE TABLE IF NOT EXISTS "ExpertComment" (
      "id"                TEXT   NOT NULL,
      "userId"            TEXT   NOT NULL,
      "source"            TEXT   NOT NULL DEFAULT 'trending',
      "trendingTopicId"   TEXT,
      "reactorId"         TEXT,
      "targetPostUrn"     TEXT   NOT NULL,
      "targetPostExcerpt" TEXT   NOT NULL DEFAULT '',
      "commentText"       TEXT   NOT NULL,
      "tone"              TEXT   NOT NULL DEFAULT 'expert',
      "model"             TEXT   NOT NULL DEFAULT '',
      "status"            TEXT   NOT NULL DEFAULT 'generated',
      "commentUrn"        TEXT,
      "postedAt"          TIMESTAMP(3),
      "error"             TEXT,
      "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"         TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ExpertComment_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "ExpertComment_userId_status_idx"
       ON "ExpertComment"("userId", "status");`,
    `CREATE INDEX IF NOT EXISTS "ExpertComment_userId_createdAt_idx"
       ON "ExpertComment"("userId", "createdAt");`,
    `CREATE INDEX IF NOT EXISTS "ExpertComment_userId_source_idx"
       ON "ExpertComment"("userId", "source");`,

    // 11. Foreign keys for engagement tables (only add if they don't exist)
    //     Using DO $$ ... IF NOT EXISTS (constraint) ... to be idempotent.
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'LinkedInReactor_userId_fkey'
      ) THEN
        ALTER TABLE "LinkedInReactor"
          ADD CONSTRAINT "LinkedInReactor_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'LinkedInReactor_contactId_fkey'
      ) THEN
        ALTER TABLE "LinkedInReactor"
          ADD CONSTRAINT "LinkedInReactor_contactId_fkey"
          FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TrendingTopic_userId_fkey'
      ) THEN
        ALTER TABLE "TrendingTopic"
          ADD CONSTRAINT "TrendingTopic_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ProfileVisitor_userId_fkey'
      ) THEN
        ALTER TABLE "ProfileVisitor"
          ADD CONSTRAINT "ProfileVisitor_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ProfileVisitor_contactId_fkey'
      ) THEN
        ALTER TABLE "ProfileVisitor"
          ADD CONSTRAINT "ProfileVisitor_contactId_fkey"
          FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ExpertComment_userId_fkey'
      ) THEN
        ALTER TABLE "ExpertComment"
          ADD CONSTRAINT "ExpertComment_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;`,

    // ─── Phase 4.2 — Billing & Subscription ─────────────────────────────────
    // These ensure the UserSettings billing columns + UsageQuota table exist
    // even if migration 20260702020000_add_billing_subscription hasn't been
    // applied (which would cause 500 errors on /api/billing/* endpoints).

    // 12. UserSettings billing columns (Phase 4.2)
    `ALTER TABLE "UserSettings"
       ADD COLUMN IF NOT EXISTS "plan"                  TEXT    NOT NULL DEFAULT 'free',
       ADD COLUMN IF NOT EXISTS "stripeCustomerId"      TEXT,
       ADD COLUMN IF NOT EXISTS "stripeSubscriptionId"  TEXT,
       ADD COLUMN IF NOT EXISTS "subscriptionStatus"    TEXT    NOT NULL DEFAULT 'none',
       ADD COLUMN IF NOT EXISTS "trialEndsAt"           TIMESTAMP(3),
       ADD COLUMN IF NOT EXISTS "currentPeriodEnd"      TIMESTAMP(3);`,

    // 13. UsageQuota table (Phase 4.2)
    `CREATE TABLE IF NOT EXISTS "UsageQuota" (
      "id"                TEXT   NOT NULL,
      "userId"            TEXT   NOT NULL,
      "periodStart"       TIMESTAMP(3) NOT NULL,
      "periodEnd"         TIMESTAMP(3) NOT NULL,
      "postsPublished"    INTEGER NOT NULL DEFAULT 0,
      "commentsPosted"    INTEGER NOT NULL DEFAULT 0,
      "reactorsCaptured"  INTEGER NOT NULL DEFAULT 0,
      "aiGenerations"     INTEGER NOT NULL DEFAULT 0,
      "profileVisitors"   INTEGER NOT NULL DEFAULT 0,
      "crmContacts"       INTEGER NOT NULL DEFAULT 0,
      "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"         TIMESTAMP(3) NOT NULL,
      CONSTRAINT "UsageQuota_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UsageQuota_userId_periodStart_key"
       ON "UsageQuota"("userId", "periodStart");`,
    `CREATE INDEX IF NOT EXISTS "UsageQuota_userId_periodEnd_idx"
       ON "UsageQuota"("userId", "periodEnd");`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'UsageQuota_userId_fkey'
      ) THEN
        ALTER TABLE "UsageQuota"
          ADD CONSTRAINT "UsageQuota_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;`,
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

  log.info("Runtime schema migration complete (User columns + engagement tables)", {
    succeeded,
    failed,
  });
}
