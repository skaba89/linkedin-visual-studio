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

# 2. Generate Prisma client (with Debian engine for Render)
echo ""
echo "🔧 Generating Prisma client..."
npx prisma generate

# 3. Build Next.js (standalone output)
echo ""
echo "🏗️  Building Next.js application..."
npm run build

# 4. Copy static assets to standalone output
# Next.js standalone mode does NOT copy public/ and .next/static/ automatically
echo ""
echo "📁 Copying static assets to standalone output..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# 5. Copy Prisma assets for runtime (migrations, schema)
echo ""
echo "🗄️  Copying Prisma assets to standalone output..."
mkdir -p .next/standalone/prisma
cp prisma/schema.prisma .next/standalone/prisma/
cp -r prisma/migrations .next/standalone/prisma/migrations

# 6. Copy Prisma engine binaries (required for Neon PostgreSQL connection)
echo ""
echo "🔧 Copying Prisma engine binaries..."
ENGINE_PATH=$(find node_modules/.prisma/client -name "libquery_engine-*" -type f 2>/dev/null | head -1 || true)
if [ -n "$ENGINE_PATH" ]; then
  mkdir -p .next/standalone/node_modules/.prisma/client
  cp "$ENGINE_PATH" .next/standalone/node_modules/.prisma/client/
  echo "   ✅ Copied query engine: $(basename $ENGINE_PATH)"
fi

# Copy schema.prisma to the .prisma/client directory (Prisma looks for it there)
if [ -f "node_modules/.prisma/client/schema.prisma" ]; then
  cp node_modules/.prisma/client/schema.prisma .next/standalone/node_modules/.prisma/client/ 2>/dev/null || true
fi

# 7. Run database migrations against Neon
echo ""
echo "🗄️  Running database migrations (Neon)..."
npx prisma migrate deploy

# 8. Seed the database if empty
echo ""
echo "🌱 Seeding database if needed..."
npx prisma db seed 2>/dev/null || echo "   (Already seeded or skipping)"

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Build complete!"
echo "═══════════════════════════════════════════════"
