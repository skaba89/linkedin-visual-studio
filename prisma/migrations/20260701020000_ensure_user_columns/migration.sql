-- ─── R-011 deep: Ensure User columns exist (idempotent) ─────────────
--
-- Background:
--   The migration 20260630000000_add_password_hash_and_role is a large
--   multi-statement migration that includes:
--     1. CREATE TYPE "Role"
--     2. ALTER TABLE "User" ADD COLUMN "passwordHash"
--     3. ALTER TABLE "User" ADD COLUMN "passwordSalt"
--     4. ALTER TABLE "User" ADD COLUMN "role"
--     5. 40+ ALTER TABLE ... TYPE JSONB conversions
--
--   If ANY of the JSONB conversions fails (e.g., because a row contains
--   non-JSON text in a column expected to be JSON), the ENTIRE migration
--   fails atomically. Prisma marks it as failed and skips it on subsequent
--   `migrate deploy` runs. This leaves the User columns (passwordHash,
--   role) missing — even though they're declared at the TOP of the file.
--
--   Symptom: login fails with
--     "The column `User.passwordHash` does not exist in the current database."
--   Because the migration was marked failed, the User columns were never added.
--
-- Fix:
--   This migration re-applies ONLY the User-column-adding statements, fully
--   idempotently (IF NOT EXISTS). It does NOT touch the JSONB conversions
--   (those are tracked separately in 20260630000000). This unblocks login
--   immediately, regardless of whether the JSONB conversion migration is
--   in a failed state.
--
-- After this migration runs:
--   - User.passwordHash (TEXT, nullable) exists
--   - User.passwordSalt (TEXT, nullable) exists
--   - User.role (Role enum, default USER) exists
--   - Login will work (ensureDemoUser() can seed the demo user)
--
-- The "Role" enum type is also re-created if missing (DO $$ block).

-- Ensure Role enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
  END IF;
END
$$;

-- Ensure User.passwordHash exists
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- Ensure User.passwordSalt exists (kept for backward compat; not used by scrypt)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordSalt" TEXT;

-- Ensure User.role exists
-- Using a DO block because ADD COLUMN IF NOT EXISTS doesn't support
-- enum-typed columns with DEFAULT in all Postgres versions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'role'
  ) THEN
    ALTER TABLE "User"
      ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';
  END IF;
END
$$;
