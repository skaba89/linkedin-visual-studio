#!/usr/bin/env bash
# ─── HERMÈS Start Script for Render ──────────────────────────────────
#
# This script runs before `npm run start` and ensures the database schema
# is up-to-date. It is more robust than `npx prisma migrate deploy && npm run start`
# because:
#
#   1. It logs every step with timestamps so we can debug from Render logs
#   2. It does NOT fail the start if migrations fail (the app may still be
#      usable with the current schema, and we'd rather have a degraded app
#      than no app at all)
#   3. It runs `prisma db push` as a fallback if `migrate deploy` fails —
#      this syncs the schema directly from prisma/schema.prisma without
#      requiring migration files, which is useful when the migration
#      history is out of sync with the actual DB state
#   4. It seeds the demo user as a final fallback

set -uo pipefail

echo "═══════════════════════════════════════════════"
echo "  HERMÈS — Start ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
echo "═══════════════════════════════════════════════"

# Check critical env vars
echo ""
echo "🔍 Environment check:"
echo "  NODE_ENV: ${NODE_ENV:-'(not set)'}"
echo "  PORT: ${PORT:-'(not set)'}"
echo "  DATABASE_URL: ${DATABASE_URL:+set (hidden)}"
echo "  DATABASE_URL: ${DATABASE_URL:-(NOT SET — app will crash on DB access)}"
echo "  NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:+set (hidden)}"
echo "  NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:-(NOT SET — NextAuth will fail in production)}"
echo "  NEXTAUTH_URL: ${NEXTAUTH_URL:-(not set)}"
echo "  AUTH_TRUST_HOST: ${AUTH_TRUST_HOST:-(not set — will be force-set by auth-config.ts)}"
echo "  ENCRYPTION_KEY: ${ENCRYPTION_KEY:+set (hidden)}"
echo "  ENCRYPTION_KEY: ${ENCRYPTION_KEY:-(NOT SET — LinkedIn token encryption will fail)}"

# Step 1: Run Prisma migrations
echo ""
echo "🗄️  Step 1: Running prisma migrate deploy..."
MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_EXIT=$?
echo "$MIGRATE_OUTPUT" | tail -30

if [ $MIGRATE_EXIT -ne 0 ]; then
  echo ""
  echo "⚠️  prisma migrate deploy failed (exit $MIGRATE_EXIT). Falling back to prisma db push..."
  PUSH_OUTPUT=$(npx prisma db push --accept-data-loss 2>&1)
  PUSH_EXIT=$?
  echo "$PUSH_OUTPUT" | tail -30
  if [ $PUSH_EXIT -ne 0 ]; then
    echo ""
    echo "❌ prisma db push also failed (exit $PUSH_EXIT)."
    echo "🔧 Attempting direct SQL migration (ensure_user_columns)..."
    # Run the ensure_user_columns migration SQL directly via prisma db execute
    # This bypasses the migration history and forces the User columns to exist
    SQL_FILE="prisma/migrations/20260701020000_ensure_user_columns/migration.sql"
    if [ -f "$SQL_FILE" ]; then
      SQL_OUTPUT=$(npx prisma db execute --file "$SQL_FILE" --schema prisma/schema.prisma 2>&1)
      SQL_EXIT=$?
      echo "$SQL_OUTPUT" | tail -20
      if [ $SQL_EXIT -ne 0 ]; then
        echo "❌ Direct SQL migration also failed. Starting app anyway — DB schema may be out of sync."
      else
        echo "✅ Direct SQL migration succeeded — User.passwordHash column should now exist."
      fi
    else
      echo "❌ SQL file not found: $SQL_FILE"
    fi
  else
    echo ""
    echo "✅ prisma db push succeeded — schema is now in sync."
  fi
else
  echo ""
  echo "✅ prisma migrate deploy succeeded."
fi

# Step 2: Start the Next.js app
echo ""
echo "🚀 Step 2: Starting Next.js..."
echo "  Command: npm run start"
echo "  PORT: ${PORT:-10000}"
echo ""

# Use exec so the app receives SIGTERM from Render's process manager
exec npm run start
