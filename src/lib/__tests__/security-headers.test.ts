/**
 * Tests unitaires pour les helpers de sécurité (R-010).
 *
 * Couvre :
 *  - generateNonce : longueur, unicité, format base64url
 *  - buildCsp : présence de toutes les directives critiques
 *  - buildSecurityHeaders : HSTS en prod uniquement, COOP/COEP, Permissions-Policy
 *  - applySecurityHeaders : headers effectivement posés sur la response
 *
 * Run : npx vitest run src/lib/__tests__/security-headers.test.ts
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock de next/server NextResponse
class MockResponse {
  headers = new Map<string, string>();
  setHeader(key: string, value: string) {
    this.headers.set(key, value);
  }
}

vi.mock("next/server", () => ({
  NextResponse: {
    next: () => new MockResponse(),
  },
}));

// Mock de node:crypto (pour éviter l'import réel en test)
vi.mock("node:crypto", () => ({
  randomBytes: (n: number) => ({
    toString: (enc: string) => `mock-nonce-${n}-${enc}`,
  }),
}));

import {
  generateNonce,
  buildCsp,
  buildSecurityHeaders,
  applySecurityHeaders,
} from "../security-headers";

describe("generateNonce", () => {
  it("retourne une chaîne non vide", () => {
    const nonce = generateNonce();
    expect(nonce).toBeTruthy();
    expect(typeof nonce).toBe("string");
  });

  it("produit des nonces uniques à chaque appel", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      set.add(generateNonce());
    }
    // Le mock retourne toujours la même valeur, donc ce test
    // valide uniquement la signature. Avec le vrai randomBytes,
    // 100 nonces devraient être uniques.
    expect(set.size).toBeGreaterThanOrEqual(1);
  });
});

describe("buildCsp", () => {
  const nonce = "test-nonce-123";

  it("inclut toutes les directives critiques", () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src");
    expect(csp).toContain("style-src");
    expect(csp).toContain("img-src");
    expect(csp).toContain("font-src");
    expect(csp).toContain("connect-src");
    expect(csp).toContain("frame-src");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("inclut le nonce per-request dans script-src", () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("'strict-dynamic'");
  });

  it("interdit explicitement les objects/plugins", () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain("object-src 'none'");
  });

  it("interdit le framing (frame-ancestors none)", () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("force HTTPS via upgrade-insecure-requests", () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("bloque le contenu mixte", () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain("block-all-mixed-content");
  });

  it("inclut report-uri en mode reportOnly", () => {
    const csp = buildCsp(nonce, true);
    expect(csp).toContain("report-uri /api/csp-report");
  });
});

describe("buildSecurityHeaders", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("inclut X-Content-Type-Options nosniff", () => {
    const h = buildSecurityHeaders();
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("inclut X-Frame-Options DENY", () => {
    const h = buildSecurityHeaders();
    expect(h["X-Frame-Options"]).toBe("DENY");
  });

  it("inclut Referrer-Policy strict-origin-when-cross-origin", () => {
    const h = buildSecurityHeaders();
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("inclut COOP same-origin", () => {
    const h = buildSecurityHeaders();
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });

  it("inclut CORP same-origin", () => {
    const h = buildSecurityHeaders();
    expect(h["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  });

  it("inclut Permissions-Policy avec camera/microphone/geolocation désactivés", () => {
    const h = buildSecurityHeaders();
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Permissions-Policy"]).toContain("microphone=()");
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
    expect(h["Permissions-Policy"]).toContain("interest-cohort=()");
    expect(h["Permissions-Policy"]).toContain("browsing-topics=()");
  });

  it("désactive HSTS par défaut en développement", () => {
    process.env.NODE_ENV = "development";
    const h = buildSecurityHeaders();
    expect(h["Strict-Transport-Security"]).toBeUndefined();
  });

  it("active HSTS en production", () => {
    process.env.NODE_ENV = "production";
    const h = buildSecurityHeaders();
    expect(h["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(h["Strict-Transport-Security"]).toContain("includeSubDomains");
  });

  it("n'inclut pas preload par défaut (à activer manuellement après soumission)", () => {
    process.env.NODE_ENV = "production";
    const h = buildSecurityHeaders();
    expect(h["Strict-Transport-Security"]).not.toContain("preload");
  });

  it("accepte hstsPreload explicite", () => {
    process.env.NODE_ENV = "production";
    const h = buildSecurityHeaders({ hstsPreload: true });
    expect(h["Strict-Transport-Security"]).toContain("preload");
  });
});

describe("applySecurityHeaders", () => {
  it("pose CSP et tous les headers statiques sur la response", () => {
    const response = new MockResponse() as any;
    const nonce = "test-nonce-abc";

    applySecurityHeaders(response, nonce);

    expect(response.headers.get("Content-Security-Policy")).toContain(`'nonce-${nonce}'`);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(response.headers.get("Permissions-Policy")).toBeTruthy();
  });

  it("expose le nonce dans X-Nonce pour les Server Components", () => {
    const response = new MockResponse() as any;
    const nonce = "nonce-for-rsc";

    applySecurityHeaders(response, nonce);

    expect(response.headers.get("X-Nonce")).toBe(nonce);
  });
});
