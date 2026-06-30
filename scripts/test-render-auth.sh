#!/usr/bin/env bash
# Test NextAuth credentials login flow against production
set -euo pipefail

BASE="https://linkedin-visual-studio.onrender.com"
COOKIES="/tmp/hermes-cookies.txt"
rm -f "$COOKIES"

echo "=== Step 1: Get CSRF token ==="
CSRF=$(curl -s -c "$COOKIES" -b "$COOKIES" -m 10 "$BASE/api/auth/csrf" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")
echo "CSRF: $CSRF"
echo ""

echo "=== Step 2: POST to /api/auth/callback/credentials ==="
RESPONSE=$(curl -s -i -c "$COOKIES" -b "$COOKIES" -m 10 \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=demo@hermes.app" \
  --data-urlencode "password=hermes2024" \
  --data-urlencode "callbackUrl=$BASE/" \
  --data-urlencode "json=true" \
  "$BASE/api/auth/callback/credentials")
echo "$RESPONSE" | head -30
echo ""

echo "=== Step 3: Check session ==="
SESSION=$(curl -s -b "$COOKIES" -m 10 "$BASE/api/auth/session")
echo "Session: $SESSION"
echo ""

echo "=== Step 4: Cookies received ==="
cat "$COOKIES" 2>&1 | tail -20
