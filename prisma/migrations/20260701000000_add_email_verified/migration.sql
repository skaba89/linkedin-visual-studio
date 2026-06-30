-- ─── Add User.emailVerified column ──────────────────────────────────
--
-- Background:
--   The `emailVerified` field was added to `prisma/schema.prisma` (model User)
--   as part of the HERMÈS NextAuth integration (R-001), but no SQL migration
--   was ever created. As a result:
--     - The Prisma Client generated from the schema includes the field.
--     - But the actual PostgreSQL database on Neon does NOT have the column.
--   This caused runtime errors whenever NextAuth tried to read/update
--   `emailVerified`, AND caused the production build to fail because the
--   Prisma Client types expected a field that the DB schema didn't have
--   (the build's `tsc --noEmit` step ran against a freshly-generated client
--   from the schema, not from the actual DB).
--
-- This migration is idempotent (IF NOT EXISTS) so it is safe to re-run.
-- It adds the column as NULLABLE TIMESTAMP (matches schema: `DateTime?`).

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);
