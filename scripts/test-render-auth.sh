#!/bin/bash
# Test the full NextAuth login flow on Render to verify NEXTAUTH_SECRET is set.
# Usage: bash scripts/test-render-auth.sh

BASE="https://linkedin-visual-studio.onrender.com"
COOKIE_JAR="/tmp/render-cookies.txt"
rm -f "$COOKIE_JAR"

echo "=== 1. GET /api/auth/csrf (fetch CSRF token) ==="
CSRF_RESPONSE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/auth/csrf")
echo "$CSRF_RESPONSE"
CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('csrfToken',''))" 2>/dev/null)
echo "CSRF token: $CSRF_TOKEN"
echo ""

echo "=== 2. POST /api/auth/callback/credentials (login as demo@hermes.app) ==="
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -w "\nHTTP_STATUS:%{http_code}\nREDIRECT:%{redirect_url}" \
  -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=demo@hermes.app" \
  --data-urlencode "password=hermes2024" \
  --data-urlencode "csrfToken=$CSRF_TOKEN" \
  --data-urlencode "callbackUrl=/api/auth/session" \
  --max-time 30)
echo "$LOGIN_RESPONSE"
echo ""

echo "=== 3. Cookies set after login ==="
cat "$COOKIE_JAR" 2>/dev/null | grep -v "^#" | grep -v "^$"
echo ""

echo "=== 4. GET /api/auth/session (verify session is established) ==="
SESSION_RESPONSE=$(curl -s -b "$COOKIE_JAR" "$BASE/api/auth/session")
echo "$SESSION_RESPONSE"
echo ""

echo "=== 5. GET /api/linkedin/me (with session — should NOT be 401 if logged in) ==="
curl -s -b "$COOKIE_JAR" -w "\nHTTP %{http_code}\n" "$BASE/api/linkedin/me"
echo ""

echo "=== 6. GET /api/ai/test (ZAI, no user key — should be 200 or 503, NOT 401) ==="
curl -s -b "$COOKIE_JAR" -X POST -H "Content-Type: application/json" \
  -d '{"providerId":"zai","apiKey":""}' \
  -w "\nHTTP %{http_code}\n" "$BASE/api/ai/test"

rm -f "$COOKIE_JAR"
