-- ─── R-001 + R-003: DB-backed auth + Prisma Json type alignment ──────
--
-- This migration brings the database schema in sync with prisma/schema.prisma
-- after the HERMÈS security remediation (R-001 DB auth, R-003 Json types).
--
-- Three categories of changes:
--   1. Add User.passwordHash + User.passwordSalt (TEXT, nullable) for scrypt auth
--   2. Add User.role (Role enum, default USER) for RBAC
--   3. Convert 30 TEXT columns to JSONB where Prisma schema declares them as Json
--      (init migration created them as TEXT, but Prisma Client expects JSONB
--       and would throw "Database returned unexpected column type" at runtime)
--
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS) so they're safe to
-- re-run on a partially-migrated database. Prisma migrate deploy only runs
-- each migration once, but this protects against manual partial application.

-- ─── 1. Role enum ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
  END IF;
END
$$;

-- ─── 2. User columns for DB-backed auth ──────────────────────────────
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordSalt" TEXT;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'USER';

-- ─── 3. Convert TEXT → JSONB for columns declared as Json in schema ─
-- Each conversion uses USING col::JSONB so existing JSON-as-TEXT values are
-- parsed and stored as proper JSONB. NULL stays NULL; empty strings would
-- fail, but the init migration declared all these columns NOT NULL with a
-- default of '{}' or '[]', so they always contain valid JSON.

ALTER TABLE "UserSettings" ALTER COLUMN "providerApiKeys" TYPE JSONB USING "providerApiKeys"::JSONB;
ALTER TABLE "UserSettings" ALTER COLUMN "channels" TYPE JSONB USING "channels"::JSONB;
ALTER TABLE "UserSettings" ALTER COLUMN "forbiddenCommands" TYPE JSONB USING "forbiddenCommands"::JSONB;

ALTER TABLE "ICPConfig" ALTER COLUMN "titles" TYPE JSONB USING "titles"::JSONB;
ALTER TABLE "ICPConfig" ALTER COLUMN "sectors" TYPE JSONB USING "sectors"::JSONB;
ALTER TABLE "ICPConfig" ALTER COLUMN "companySizes" TYPE JSONB USING "companySizes"::JSONB;

ALTER TABLE "MarketBriefing" ALTER COLUMN "trends" TYPE JSONB USING "trends"::JSONB;
ALTER TABLE "MarketBriefing" ALTER COLUMN "opportunities" TYPE JSONB USING "opportunities"::JSONB;
ALTER TABLE "MarketBriefing" ALTER COLUMN "competitors" TYPE JSONB USING "competitors"::JSONB;

ALTER TABLE "MessageTemplate" ALTER COLUMN "notes" TYPE JSONB USING "notes"::JSONB;

ALTER TABLE "Experiment" ALTER COLUMN "variants" TYPE JSONB USING "variants"::JSONB;
ALTER TABLE "ExperimentResult" ALTER COLUMN "metadata" TYPE JSONB USING "metadata"::JSONB;

ALTER TABLE "Contact" ALTER COLUMN "tags" TYPE JSONB USING "tags"::JSONB;

ALTER TABLE "EmailSequence" ALTER COLUMN "steps" TYPE JSONB USING "steps"::JSONB;

ALTER TABLE "Workflow" ALTER COLUMN "nodes" TYPE JSONB USING "nodes"::JSONB;
ALTER TABLE "Workflow" ALTER COLUMN "edges" TYPE JSONB USING "edges"::JSONB;
ALTER TABLE "Workflow" ALTER COLUMN "tags" TYPE JSONB USING "tags"::JSONB;

ALTER TABLE "WorkflowExecution" ALTER COLUMN "data" TYPE JSONB USING "data"::JSONB;
ALTER TABLE "WorkflowExecution" ALTER COLUMN "steps" TYPE JSONB USING "steps"::JSONB;

ALTER TABLE "Notification" ALTER COLUMN "metadata" TYPE JSONB USING "metadata"::JSONB;

ALTER TABLE "Webhook" ALTER COLUMN "events" TYPE JSONB USING "events"::JSONB;
ALTER TABLE "Webhook" ALTER COLUMN "headers" TYPE JSONB USING "headers"::JSONB;

ALTER TABLE "WebhookDelivery" ALTER COLUMN "request" TYPE JSONB USING "request"::JSONB;
ALTER TABLE "WebhookDelivery" ALTER COLUMN "response" TYPE JSONB USING "response"::JSONB;

ALTER TABLE "OrchestratorState" ALTER COLUMN "rules" TYPE JSONB USING "rules"::JSONB;
ALTER TABLE "OrchestratorState" ALTER COLUMN "metrics" TYPE JSONB USING "metrics"::JSONB;

ALTER TABLE "ComplianceState" ALTER COLUMN "usage" TYPE JSONB USING "usage"::JSONB;
ALTER TABLE "ComplianceState" ALTER COLUMN "violations" TYPE JSONB USING "violations"::JSONB;
ALTER TABLE "ComplianceState" ALTER COLUMN "mimicryConfig" TYPE JSONB USING "mimicryConfig"::JSONB;

ALTER TABLE "EventHistory" ALTER COLUMN "data" TYPE JSONB USING "data"::JSONB;
