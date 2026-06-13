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

# 3. Build Next.js (standalone output)
echo ""
echo "🏗️  Building Next.js application..."
npm run build

# 4. Copy static assets to standalone output
# Next.js standalone mode does NOT copy public/ and .next/static/ automatically
# These are required for the app to serve static files correctly
echo ""
echo "📁 Copying static assets to standalone output..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# 5. Copy Prisma schema and migrations for runtime
# The standalone server needs the Prisma client and engines to connect to PostgreSQL
echo ""
echo "🗄️  Copying Prisma assets to standalone output..."
mkdir -p .next/standalone/prisma
cp prisma/schema.prisma .next/standalone/prisma/
cp -r prisma/migrations .next/standalone/prisma/migrations

# 6. Copy Prisma engine binaries (required for PostgreSQL connection)
# These are in node_modules/.prisma/client or node_modules/@prisma/engines
echo ""
echo "🔧 Copying Prisma engine binaries..."
# Find and copy the query engine
ENGINE_PATH=$(find node_modules/.prisma/client -name "libquery_engine-*" -type f 2>/dev/null | head -1 || true)
if [ -n "$ENGINE_PATH" ]; then
  mkdir -p .next/standalone/node_modules/.prisma/client
  cp "$ENGINE_PATH" .next/standalone/node_modules/.prisma/client/
  echo "   ✅ Copied query engine: $(basename $ENGINE_PATH)"
fi

# Also copy the schema.prisma to the .prisma/client directory (Prisma looks for it there)
if [ -f "node_modules/.prisma/client/schema.prisma" ]; then
  cp node_modules/.prisma/client/schema.prisma .next/standalone/node_modules/.prisma/client/ 2>/dev/null || true
fi

# 7. Run database migrations (applies pending migrations)
echo ""
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# 8. Seed the database if empty (ensure default user exists)
echo ""
echo "🌱 Seeding database if needed..."
npx prisma db seed 2>/dev/null || echo "   (No seed script or already seeded — skipping)"

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Build complete!"
echo "═══════════════════════════════════════════════"
