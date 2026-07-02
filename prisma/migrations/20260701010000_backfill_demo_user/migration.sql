-- ─── R-011: Backfill demo user password ──────────────────────────────
--
-- Background:
--   The original demo user was seeded by prisma/seed.ts with NO passwordHash
--   (legacy `default` user, email=default@hermes.app). The auth-config.ts
--   `ensureDemoUser()` function was supposed to seed demo@hermes.app on
--   first login, but the demo password "hermes2024" (10 chars) failed
--   assertPasswordStrength() (≥ 12 chars required), so the seed always
--   threw and the user could never log in.
--
-- This migration ensures that:
--   1. The demo@hermes.app user exists
--   2. It has a passwordHash set
--
-- The actual hash is computed by the application (scrypt with random salt)
-- at runtime via ensureDemoUser()'s backfill branch. We only ensure the
-- row exists here; the app will set the password on first login attempt.
--
-- Idempotent: safe to re-run (INSERT ... WHERE NOT EXISTS).

INSERT INTO "User" ("id", "email", "name", "role", "createdAt", "updatedAt")
SELECT
  'demo-user',
  'demo@hermes.app',
  'Demo User',
  'USER',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "User" WHERE "email" = 'demo@hermes.app'
);
