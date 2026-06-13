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
npx prisma migrate deploy

# 5. Seed the database if empty
echo ""
echo "🌱 Seeding database if needed..."
npx prisma db seed 2>/dev/null || echo "   (Already seeded or skipping)"

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Build complete!"
echo "═══════════════════════════════════════════════"
