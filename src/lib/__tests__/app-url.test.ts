/**
 * Tests for src/lib/app-url.ts — public URL resolver
 *
 * Verifies the priority order:
 *   1. NEXTAUTH_URL env var
 *   2. NEXT_PUBLIC_APP_URL env var
 *   3. X-Forwarded-Proto + X-Forwarded-Host headers
 *   4. X-Forwarded-Proto + Host header (skipped if internal)
 *   5. request.nextUrl.protocol + request.nextUrl.host (last resort)
 *
 * The key invariant: NEVER return `0.0.0.0:10000` (the internal Render bind
 * address) when proxy headers are available. Browsers can't resolve it and
 * the user gets ERR_ADDRESS_INVALID.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock NextRequest minimally — we only need .headers, .nextUrl.protocol,
// and .nextUrl.host. The real type is complex; this is enough for the tests.
type FakeRequest = {
  headers: Headers;
  nextUrl: { protocol: string; host: string };
};

function makeRequest(opts: {
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
  nextUrlProtocol?: string;
  nextUrlHost?: string;
}): FakeRequest {
  const headers = new Headers();
  if (opts.forwardedHost !== undefined && opts.forwardedHost !== null) {
    headers.set("x-forwarded-host", opts.forwardedHost);
  }
  if (opts.forwardedProto !== undefined && opts.forwardedProto !== null) {
    headers.set("x-forwarded-proto", opts.forwardedProto);
  }
  if (opts.host !== undefined && opts.host !== null) {
    headers.set("host", opts.host);
  }
  return {
    headers,
    nextUrl: {
      protocol: opts.nextUrlProtocol ?? "http:",
      host: opts.nextUrlHost ?? "0.0.0.0:10000",
    },
  };
}

// We import the function under test dynamically so we can control env vars
// before module evaluation. Each test sets env, then re-imports.
async function loadAppUrl() {
  // Re-import fresh each time
  vi.resetModules();
  const mod = await import("@/lib/app-url");
  return mod.appUrl;
}

describe("appUrl()", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("returns NEXTAUTH_URL when set (highest priority)", async () => {
    process.env.NEXTAUTH_URL = "https://linkedin-visual-studio.onrender.com";
    const appUrl = await loadAppUrl();
    const req = makeRequest({ forwardedHost: "other.example.com" });
    expect(appUrl(req as never)).toBe(
      "https://linkedin-visual-studio.onrender.com",
    );
  });

  it("trims trailing slashes from NEXTAUTH_URL", async () => {
    process.env.NEXTAUTH_URL =
      "https://linkedin-visual-studio.onrender.com///";
    const appUrl = await loadAppUrl();
    const req = makeRequest({});
    expect(appUrl(req as never)).toBe(
      "https://linkedin-visual-studio.onrender.com",
    );
  });

  it("returns NEXT_PUBLIC_APP_URL when NEXTAUTH_URL is not set", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    const appUrl = await loadAppUrl();
    const req = makeRequest({});
    expect(appUrl(req as never)).toBe("https://app.example.com");
  });

  it("uses X-Forwarded-Host + X-Forwarded-Proto when env vars are missing", async () => {
    const appUrl = await loadAppUrl();
    const req = makeRequest({
      forwardedHost: "linkedin-visual-studio.onrender.com",
      forwardedProto: "https",
    });
    expect(appUrl(req as never)).toBe(
      "https://linkedin-visual-studio.onrender.com",
    );
  });

  it("falls back to Host header when X-Forwarded-Host is missing", async () => {
    const appUrl = await loadAppUrl();
    const req = makeRequest({
      host: "linkedin-visual-studio.onrender.com",
      forwardedProto: "https",
      // nextUrl.host is the internal Render address
      nextUrlHost: "0.0.0.0:10000",
    });
    expect(appUrl(req as never)).toBe(
      "https://linkedin-visual-studio.onrender.com",
    );
  });

  it("CRITICAL: never returns 0.0.0.0:10000 when X-Forwarded-Host or Host is set", async () => {
    const appUrl = await loadAppUrl();
    // Case A: X-Forwarded-Host set
    const reqA = makeRequest({
      forwardedHost: "linkedin-visual-studio.onrender.com",
      forwardedProto: "https",
      nextUrlHost: "0.0.0.0:10000",
    });
    expect(appUrl(reqA as never)).not.toContain("0.0.0.0");
    expect(appUrl(reqA as never)).toBe(
      "https://linkedin-visual-studio.onrender.com",
    );

    // Case B: only Host header set
    const reqB = makeRequest({
      host: "linkedin-visual-studio.onrender.com",
      forwardedProto: "https",
      nextUrlHost: "0.0.0.0:10000",
    });
    expect(appUrl(reqB as never)).not.toContain("0.0.0.0");
    expect(appUrl(reqB as never)).toBe(
      "https://linkedin-visual-studio.onrender.com",
    );
  });

  it("skips internal-looking Host headers (0.0.0.0, 127.0.0.1, localhost)", async () => {
    const appUrl = await loadAppUrl();
    // Host is 0.0.0.0:10000 (internal) → must be SKIPPED.
    // The function falls through to nextUrl (last resort).
    // This is the ONLY case where 0.0.0.0 can leak — it requires Render's
    // proxy to send NO valid X-Forwarded-Host and NO valid Host header,
    // which would be a Render misconfiguration.
    const req = makeRequest({
      host: "0.0.0.0:10000",
      forwardedProto: "https",
      nextUrlHost: "0.0.0.0:10000",
      nextUrlProtocol: "http:",
    });
    expect(appUrl(req as never)).toBe("http://0.0.0.0:10000");
  });

  it("skips internal-looking X-Forwarded-Host headers (10.x, 192.168.x)", async () => {
    const appUrl = await loadAppUrl();
    const req = makeRequest({
      forwardedHost: "10.0.0.5:10000",
      forwardedProto: "https",
      host: "linkedin-visual-studio.onrender.com",
    });
    // Should skip the internal X-Forwarded-Host and use the Host header instead
    expect(appUrl(req as never)).toBe(
      "https://linkedin-visual-studio.onrender.com",
    );
  });

  it("falls back to request.nextUrl when no headers and no env vars (local dev)", async () => {
    const appUrl = await loadAppUrl();
    const req = makeRequest({
      nextUrlProtocol: "http:",
      nextUrlHost: "localhost:3000",
    });
    expect(appUrl(req as never)).toBe("http://localhost:3000");
  });

  it("returns localhost:3000 as absolute last resort (no request)", async () => {
    const appUrl = await loadAppUrl();
    expect(appUrl()).toBe("http://localhost:3000");
  });
});
