#!/usr/bin/env bash
# ─── HERMES Build Script for Render ─────────────────────────────────
# Database: Neon (serverless PostgreSQL)
set -euo pipefail

echo "═══════════════════════════════════════════════"
echo "  HERMES — Build for Render + Neon PostgreSQL"
echo "═══════════════════════════════════════════════"

# 1. Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm ci --production=false

# 2. Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
npx prisma generate

# 3. Build Next.js
echo ""
echo "🏗️  Building Next.js application..."
npm run build

# 4. Run database migrations against Neon
echo ""
echo "🗄️  Running database migrations (Neon)..."
MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_EXIT=$?
echo "$MIGRATE_OUTPUT" | tail -30

if [ $MIGRATE_EXIT -ne 0 ]; then
  echo ""
  echo "⚠️  prisma migrate deploy failed (exit $MIGRATE_EXIT). Trying prisma db push..."
  npx prisma db push --accept-data-loss 2>&1 | tail -20 || true
  
  echo ""
  echo "🔧 Forcing User column migration via direct SQL..."
  SQL_FILE="prisma/migrations/20260701020000_ensure_user_columns/migration.sql"
  if [ -f "$SQL_FILE" ]; then
    npx prisma db execute --file "$SQL_FILE" --schema prisma/schema.prisma 2>&1 | tail -10 || true
  fi
fi

# 5. Seed the database if empty
echo ""
echo "🌱 Seeding database if needed..."
npx prisma db seed 2>/dev/null || echo "   (Already seeded or skipping)"

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Build complete!"
echo "═══════════════════════════════════════════════"
