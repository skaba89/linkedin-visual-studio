#!/usr/bin/env bash
# ─── HERMES Build Script for Render ─────────────────────────────────
set -euo pipefail

echo "═══════════════════════════════════════════════"
echo "  HERMES — Build for Render (PostgreSQL)"
echo "═══════════════════════════════════════════════"

# 1. Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm ci --production=false

# 2. Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
npx prisma generate

# 3. Run database migrations (applies pending migrations)
echo ""
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# 4. Seed the database if empty (ensure default user exists)
echo ""
echo "🌱 Seeding database if needed..."
npx prisma db seed 2>/dev/null || echo "   (No seed script or already seeded — skipping)"

# 5. Build Next.js (standalone output)
echo ""
echo "🏗️  Building Next.js application..."
npm run build

# 6. Copy static assets to standalone output
# Next.js standalone mode does NOT copy public/ and .next/static/ automatically
# These are required for the app to serve static files correctly
echo ""
echo "📁 Copying static assets to standalone output..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Build complete!"
echo "═══════════════════════════════════════════════"
