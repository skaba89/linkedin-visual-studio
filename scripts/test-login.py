#!/usr/bin/env python3
"""Test NextAuth credentials login using the same flow a browser would use.
This bypasses any quirks of curl's cookie handling."""
import requests
import sys
import json

BASE = "https://linkedin-visual-studio.onrender.com"
EMAIL = "demo@hermes.app"
PASSWORD = "Demo-Hermes-2024"

s = requests.Session()
s.headers.update({
    "User-Agent": "Mozilla/5.0 (Test)",
    "Accept": "application/json",
})

print("=== Step 1: Get CSRF token ===")
r = s.get(f"{BASE}/api/auth/csrf", timeout=15)
print(f"Status: {r.status_code}")
csrf = r.json().get("csrfToken")
print(f"CSRF: {csrf[:20]}...")
print(f"Cookies after CSRF: {dict(s.cookies)}")

print("\n=== Step 2: POST to /api/auth/callback/credentials ===")
r = s.post(
    f"{BASE}/api/auth/callback/credentials",
    data={
        "csrfToken": csrf,
        "email": EMAIL,
        "password": PASSWORD,
        "callbackUrl": f"{BASE}/",
        "json": "true",
    },
    timeout=15,
    allow_redirects=False,
)
print(f"Status: {r.status_code}")
print(f"Headers: {dict(r.headers)}")
print(f"Body: {r.text[:500]}")
print(f"Cookies after login: {dict(s.cookies)}")

print("\n=== Step 3: Check session ===")
r = s.get(f"{BASE}/api/auth/session", timeout=15)
print(f"Status: {r.status_code}")
print(f"Body: {r.text[:500]}")

print("\n=== Step 4: Check if session cookie is set ===")
for cookie in s.cookies:
    print(f"  {cookie.name} = {cookie.value[:50]}{'...' if len(cookie.value) > 50 else ''}  (domain={cookie.domain}, secure={cookie.secure}, httponly={cookie.has_nonstandard_attr('HttpOnly') if hasattr(cookie, 'has_nonstandard_attr') else 'N/A'})")
