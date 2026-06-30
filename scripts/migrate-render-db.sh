#!/usr/bin/env bash
# ─── Run Prisma migrations against the Render production database ─────────────
#
# Usage:
#   bash scripts/migrate-render-db.sh "postgresql://user:pass@host/db?sslmode=require"
#
# This is a one-time operation to fix the missing passwordHash column on Render.
# After running this, login will work and all 401 errors will disappear.
#
# The DATABASE_URL can be found in Render Dashboard → your service → Environment → DATABASE_URL.

set -euo pipefail

DATABASE_URL="${1:-}"
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Usage: bash scripts/migrate-render-db.sh \"postgresql://...\""
  echo ""
  echo "   Get the DATABASE_URL from:"
  echo "   Render Dashboard → linkedin-visual-studio → Environment → DATABASE_URL"
  exit 1
fi

echo "═══════════════════════════════════════════════"
echo "  Running Prisma migrations against production"
echo "═══════════════════════════════════════════════"
echo ""

# Set DATABASE_URL for the prisma command
export DATABASE_URL

echo "📍 Target database: ${DATABASE_URL%@*}@*** (credentials hidden)"
echo ""

echo "📦 Step 1: Generate Prisma client..."
npx prisma generate
echo ""

echo "🗄️  Step 2: Apply pending migrations..."
npx prisma migrate deploy
echo ""

echo "✅ Migrations applied successfully!"
echo ""
echo "Next steps:"
echo "  1. Make sure NEXTAUTH_SECRET is set on Render (Environment tab)"
echo "  2. Trigger a redeploy on Render (Manual Deploy → Deploy latest commit)"
echo "  3. Wait for the deploy to complete (~2-4 min)"
echo "  4. Hard-refresh the page and try logging in with:"
echo "     Email:    demo@hermes.app"
echo "     Password: hermes2024"
