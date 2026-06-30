#!/usr/bin/env bash
# End-to-end audit of linkedin-visual-studio.onrender.com
# Tests: deployment version, DB schema, login flow, LinkedIn OAuth, session
set -uo pipefail

BASE="https://linkedin-visual-studio.onrender.com"
COOKIES="/tmp/audit-cookies.txt"
PASS=0
FAIL=0
TOTAL=0

check() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  TOTAL=$((TOTAL + 1))
  if [[ "$actual" == *"$expected"* ]]; then
    echo "  ✅ $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name"
    echo "     expected: $expected"
    echo "     actual:   ${actual:0:200}"
    FAIL=$((FAIL + 1))
  fi
}

echo "═══════════════════════════════════════════════════════════════"
echo "  AUDIT END-TO-END — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  Target: $BASE"
echo "═══════════════════════════════════════════════════════════════"

# ─── 1. DEPLOYMENT VERSION ─────────────────────────────────────────
echo ""
echo "─── 1. DEPLOYMENT VERSION ───"
HEALTH=$(curl -s --max-time 10 "$BASE/api/health")
echo "  /api/health response:"
echo "$HEALTH" | python3 -m json.tool 2>/dev/null | head -20

# Check if seed-demo has the new "check role column type" step
SEED=$(curl -s --max-time 10 "$BASE/api/setup/seed-demo")
if echo "$SEED" | grep -q "check role column type"; then
  echo "  ✅ New version (b11de18) is deployed — /api/setup/seed-demo has 'check role column type' step"
  PASS=$((PASS + 1))
elif echo "$SEED" | grep -q "assertPasswordStrength"; then
  echo "  ❌ OLD version (b67ce21 or earlier) still deployed — /api/setup/seed-demo lacks role fix"
  echo "     Must trigger Manual Deploy on Render"
  FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

# ─── 2. DB SCHEMA STATE ────────────────────────────────────────────
echo ""
echo "─── 2. DB SCHEMA STATE (via /api/health) ───"
USER_COLS=$(echo "$HEALTH" | python3 -c "import json,sys; d=json.load(sys.stdin); print(','.join(d.get('db',{}).get('userColumns',[])))" 2>/dev/null)
check "User.passwordHash exists" "passwordHash" "$USER_COLS"
check "User.role exists" "role" "$USER_COLS"
check "User.emailVerified exists" "emailVerified" "$USER_COLS"

# ─── 3. NEXTAUTH CONFIG ────────────────────────────────────────────
echo ""
echo "─── 3. NEXTAUTH CONFIG ───"
AUTH_TRUST=$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('env',{}).get('AUTH_TRUST_HOST',''))" 2>/dev/null)
check "AUTH_TRUST_HOST set" "true" "$AUTH_TRUST"

NEXTAUTH_URL=$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('env',{}).get('NEXTAUTH_URL',''))" 2>/dev/null)
check "NEXTAUTH_URL set" "https://linkedin-visual-studio.onrender.com" "$NEXTAUTH_URL"

NEXTAUTH_SECRET=$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('env',{}).get('NEXTAUTH_SECRET',''))" 2>/dev/null)
check "NEXTAUTH_SECRET set" "set" "$NEXTAUTH_SECRET"

ENCRYPTION_KEY=$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('env',{}).get('ENCRYPTION_KEY',''))" 2>/dev/null)
check "ENCRYPTION_KEY set" "set" "$ENCRYPTION_KEY"

# ─── 4. NEXTAUTH ENDPOINTS ─────────────────────────────────────────
echo ""
echo "─── 4. NEXTAUTH ENDPOINTS ───"
CSRF_RESP=$(curl -s --max-time 10 -c "$COOKIES" "$BASE/api/auth/csrf")
check "CSRF endpoint returns token" "csrfToken" "$CSRF_RESP"

CSRF_TOKEN=$(echo "$CSRF_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['csrfToken'])" 2>/dev/null)
PROVIDERS=$(curl -s --max-time 10 "$BASE/api/auth/providers")
check "Providers endpoint returns credentials" "credentials" "$PROVIDERS"

SESSION=$(curl -s --max-time 10 -b "$COOKIES" "$BASE/api/auth/session")
check "Session endpoint (no cookies) returns empty" "{}" "$SESSION"

# ─── 5. LOGIN FLOW ─────────────────────────────────────────────────
echo ""
echo "─── 5. LOGIN FLOW (demo@hermes.app / Demo-Hermes-2024) ───"
rm -f "$COOKIES"
CSRF_RESP=$(curl -s --max-time 10 -c "$COOKIES" "$BASE/api/auth/csrf")
CSRF_TOKEN=$(echo "$CSRF_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['csrfToken'])" 2>/dev/null)

LOGIN_RESP=$(curl -s --max-time 15 -b "$COOKIES" -c "$COOKIES" -w "\n%{http_code}" \
  -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=demo@hermes.app&password=Demo-Hermes-2024&csrfToken=$CSRF_TOKEN&callbackUrl=%2F&json=true")

LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
LOGIN_BODY=$(echo "$LOGIN_RESP" | head -n -1)
echo "  Login HTTP status: $LOGIN_CODE"
echo "  Login response body: ${LOGIN_BODY:0:300}"

if [[ "$LOGIN_CODE" == "200" ]] && ! echo "$LOGIN_BODY" | grep -q "error"; then
  echo "  ✅ Login succeeded"
  PASS=$((PASS + 1))
else
  echo "  ❌ Login failed"
  FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

# Check if session cookie was set
SESSION_COOKIE=$(grep -E "next-auth\.session-token|__Secure-next-auth" "$COOKIES" 2>/dev/null | head -1)
if [[ -n "$SESSION_COOKIE" ]]; then
  echo "  ✅ Session cookie set"
  PASS=$((PASS + 1))
else
  echo "  ❌ No session cookie set"
  FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

# ─── 6. SESSION AFTER LOGIN ────────────────────────────────────────
echo ""
echo "─── 6. SESSION AFTER LOGIN ───"
SESSION=$(curl -s --max-time 10 -b "$COOKIES" "$BASE/api/auth/session")
echo "  Session response: ${SESSION:0:300}"
if echo "$SESSION" | grep -q '"user"'; then
  echo "  ✅ Session contains user object"
  PASS=$((PASS + 1))
else
  echo "  ❌ Session does not contain user"
  FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

# ─── 7. LINKEDIN OAUTH FLOW ────────────────────────────────────────
echo ""
echo "─── 7. LINKEDIN OAUTH FLOW ───"
LINKEDIN_AUTH=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}|%{redirect_url}" -b "$COOKIES" "$BASE/api/linkedin/auth")
LINKEDIN_CODE=$(echo "$LINKEDIN_AUTH" | cut -d'|' -f1)
LINKEDIN_REDIRECT=$(echo "$LINKEDIN_AUTH" | cut -d'|' -f2)
echo "  /api/linkedin/auth HTTP: $LINKEDIN_CODE"
echo "  Redirect URL: ${LINKEDIN_REDIRECT:0:200}"

if [[ "$LINKEDIN_CODE" == "307" ]] && echo "$LINKEDIN_REDIRECT" | grep -q "linkedin.com/oauth/v2/authorization"; then
  echo "  ✅ LinkedIn OAuth redirect to linkedin.com"
  PASS=$((PASS + 1))
elif [[ "$LINKEDIN_CODE" == "307" ]] && echo "$LINKEDIN_REDIRECT" | grep -q "linkedin=error"; then
  echo "  ❌ LinkedIn auth redirects to error page (no session?)"
  FAIL=$((FAIL + 1))
else
  echo "  ❌ Unexpected LinkedIn auth response"
  FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

# Check redirect_uri in the LinkedIn auth URL
if echo "$LINKEDIN_REDIRECT" | grep -q "redirect_uri=https%3A%2F%2Flinkedin-visual-studio.onrender.com"; then
  echo "  ✅ redirect_uri uses correct public URL"
  PASS=$((PASS + 1))
elif echo "$LINKEDIN_REDIRECT" | grep -q "redirect_uri=https%3A%2F%2F0.0.0.0"; then
  echo "  ❌ redirect_uri uses 0.0.0.0 (BUG NOT FIXED)"
  FAIL=$((FAIL + 1))
else
  echo "  ⚠️  redirect_uri uses unexpected host: ${LINKEDIN_REDIRECT:0:200}"
fi
TOTAL=$((TOTAL + 1))

# ─── 8. PROTECTED ROUTES ───────────────────────────────────────────
echo ""
echo "─── 8. PROTECTED ROUTES (with session) ───"
LINKEDIN_ME=$(curl -s --max-time 10 -b "$COOKIES" -w "\n%{http_code}" "$BASE/api/linkedin/me")
LINKEDIN_ME_CODE=$(echo "$LINKEDIN_ME" | tail -1)
LINKEDIN_ME_BODY=$(echo "$LINKEDIN_ME" | head -n -1)
echo "  /api/linkedin/me HTTP: $LINKEDIN_ME_CODE"
echo "  /api/linkedin/me body: ${LINKEDIN_ME_BODY:0:200}"

if [[ "$LINKEDIN_ME_CODE" == "200" ]]; then
  echo "  ✅ /api/linkedin/me accessible with session"
  PASS=$((PASS + 1))
elif [[ "$LINKEDIN_ME_CODE" == "401" ]]; then
  echo "  ❌ /api/linkedin/me returns 401 (session not recognized)"
  FAIL=$((FAIL + 1))
else
  echo "  ⚠️  Unexpected status"
  FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

# ─── 9. SECURITY HEADERS ───────────────────────────────────────────
echo ""
echo "─── 9. SECURITY HEADERS ───"
HEADERS=$(curl -s --max-time 10 -I "$BASE/")
CSP=$(echo "$HEADERS" | grep -i "^content-security-policy:" | head -1)
echo "  CSP: ${CSP:0:150}..."
if [[ -n "$CSP" ]]; then
  echo "  ✅ CSP header present"
  PASS=$((PASS + 1))
else
  echo "  ❌ CSP header missing"
  FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

HSTS=$(echo "$HEADERS" | grep -i "^strict-transport-security:" | head -1)
if [[ -n "$HSTS" ]]; then
  echo "  ✅ HSTS header present"
  PASS=$((PASS + 1))
else
  echo "  ❌ HSTS header missing"
  FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

# ─── SUMMARY ───────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  SUMMARY: $PASS/$TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════════════════════════════"
exit 0
