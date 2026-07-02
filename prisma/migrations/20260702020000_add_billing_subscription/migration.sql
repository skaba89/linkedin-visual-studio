-- Phase 4.2 — Billing & Subscription
-- Adds subscription fields to UserSettings + a new UsageQuota table for
-- per-period quota tracking.

-- ─── UserSettings extension ──────────────────────────────────────────
ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "plan"                  TEXT    NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "stripeCustomerId"      TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId"  TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionStatus"    TEXT    NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "trialEndsAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "currentPeriodEnd"      TIMESTAMP(3);

-- ─── UsageQuota ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "UsageQuota" (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS "UsageQuota_userId_periodStart_key"
  ON "UsageQuota"("userId", "periodStart");
CREATE INDEX IF NOT EXISTS "UsageQuota_userId_periodEnd_idx"
  ON "UsageQuota"("userId", "periodEnd");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'UsageQuota_userId_fkey'
  ) THEN
    ALTER TABLE "UsageQuota"
      ADD CONSTRAINT "UsageQuota_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
