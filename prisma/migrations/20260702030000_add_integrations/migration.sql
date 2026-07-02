-- Phase 4.3 — External CRM Integrations
-- Adds the Integration model for storing credentials + sync state for
-- outbound CRM integrations (HubSpot, Pipedrive, Notion, Attio, Salesforce).

CREATE TABLE IF NOT EXISTS "Integration" (
  "id"              TEXT   NOT NULL,
  "userId"          TEXT   NOT NULL,
  "provider"        TEXT   NOT NULL,
  "name"            TEXT   NOT NULL DEFAULT '',
  "status"          TEXT   NOT NULL DEFAULT 'active',
  "credentials"     TEXT   NOT NULL DEFAULT '',
  "syncSettings"    TEXT   NOT NULL DEFAULT '{}',
  "lastSyncAt"      TIMESTAMP(3),
  "lastSyncStatus"  TEXT   NOT NULL DEFAULT 'none',
  "lastSyncError"   TEXT,
  "totalSynced"     INTEGER NOT NULL DEFAULT 0,
  "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
  "autoSyncCron"    TEXT   NOT NULL DEFAULT '0 */6 * * *',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Integration_userId_provider_key"
  ON "Integration"("userId", "provider");
CREATE INDEX IF NOT EXISTS "Integration_userId_status_idx"
  ON "Integration"("userId", "status");
CREATE INDEX IF NOT EXISTS "Integration_userId_provider_idx"
  ON "Integration"("userId", "provider");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Integration_userId_fkey'
  ) THEN
    ALTER TABLE "Integration"
      ADD CONSTRAINT "Integration_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
