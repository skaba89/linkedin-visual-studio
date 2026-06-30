/**
 * HERMÈS — Security headers (R-010 implementation, Volume 2 chapitre 9)
 *
 * Centralise la construction des en-têtes HTTP de sécurité :
 *  - CSP stricte avec nonce per-request (compatible Next.js App Router)
 *  - HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
 *  - Permissions-Policy verrouillant les API sensibles
 *  - COOP/COEP pour l'isolation cross-origin
 *
 * Conformité cible : OWASP ASVS 4.0 §14.5, Mozilla Observatory grade A+.
 *
 * Usage (middleware) :
 *   const nonce = generateNonce();
 *   applySecurityHeaders(response, nonce);
 *
 * Le nonce doit être régénéré à chaque requête et injecté dans
 * <Script nonce={nonce} /> côté layout racine pour autoriser les
 * scripts inline Next.js.
 */

import type { NextResponse } from "next/server";

// ─── Nonce CSP ──────────────────────────────────────────────────────────────
/**
 * Génère un nonce base64 de 16 octets pour la CSP.
 * Doit être appelé à chaque requête dans le middleware.
 *
 * Implementation note: this file is imported by src/middleware.ts which runs
 * in the Edge Runtime. The Edge Runtime does NOT support `node:crypto`, so we
 * use the Web Crypto API (`globalThis.crypto.getRandomValues`) instead, which
 * is available in both Edge and Node.js runtimes.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  // Buffer is polyfilled in the Edge Runtime by Next.js.
  return Buffer.from(bytes).toString("base64url");
}

// ─── Allowed origins (à ajuster selon l'environnement) ───────────────────────
const SELF = "'self'";

// CDN et services externes explicitement autorisés
const ALLOWED_SCRIPTS_SRC = [
  SELF,
  // Next.js dev HMR
  process.env.NODE_ENV !== "production" ? "'unsafe-eval'" : null,
  // Vercel analytics (si activé)
  "https://va.vercel-scripts.com",
  // Stripe.js (si paiement activé)
  "https://js.stripe.com",
].filter(Boolean) as string[];

const ALLOWED_STYLES_SRC = [
  SELF,
  "'unsafe-inline'", // Next.js injecte des styles critiques en ligne
  "https://fonts.googleapis.com",
];

const ALLOWED_IMG_SRC = [
  SELF,
  "data:",
  "blob:",
  "https:",
  // Avatars LinkedIn
  "https://media.licdn.com",
  "https://static.licdn.com",
  // Avatars GitHub
  "https://avatars.githubusercontent.com",
  // Gravatar
  "https://www.gravatar.com",
];

const ALLOWED_FONTS_SRC = [
  SELF,
  "data:",
  "https://fonts.gstatic.com",
];

const ALLOWED_CONNECT_SRC = [
  SELF,
  // NextAuth callbacks
  "https://accounts.google.com",
  "https://github.com",
  // API LinkedIn
  "https://api.linkedin.com",
  // Upstash Redis (rate-limit)
  process.env.UPSTASH_REDIS_REST_URL ?? null,
  // Vercel analytics
  "https://vitals.vercel-insights.com",
].filter(Boolean) as string[];

const ALLOWED_FRAME_SRC = [SELF];

const ALLOWED_OBJECT_SRC = ["'none'"];

const ALLOWED_BASE_URI = [SELF];

const ALLOWED_FORM_ACTIONS = [
  SELF,
  "https://github.com", // login OAuth
  "https://accounts.google.com", // login OAuth
];

// ─── CSP builder ─────────────────────────────────────────────────────────────
/**
 * Construit l'en-tête Content-Security-Policy.
 *
 * @param nonce — nonce per-request injecté dans les <Script> tags
 * @param reportOnly — si true, génère Content-Security-Policy-Report-Only
 *   (utile pour la mise en place progressive sans casser l'app)
 */
export function buildCsp(nonce: string, reportOnly = false): string {
  const directives: string[] = [
    `default-src ${SELF}`,
    `script-src ${ALLOWED_SCRIPTS_SRC.join(" ")} 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src ${ALLOWED_STYLES_SRC.join(" ")}`,
    `img-src ${ALLOWED_IMG_SRC.join(" ")}`,
    `font-src ${ALLOWED_FONTS_SRC.join(" ")}`,
    `connect-src ${ALLOWED_CONNECT_SRC.join(" ")}`,
    `frame-src ${ALLOWED_FRAME_SRC.join(" ")}`,
    `object-src ${ALLOWED_OBJECT_SRC.join(" ")}`,
    `base-uri ${ALLOWED_BASE_URI.join(" ")}`,
    `form-action ${ALLOWED_FORM_ACTIONS.join(" ")}`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
    `block-all-mixed-content`,
    `require-trusted-types-for 'script'`,
  ];

  // Reporting endpoint (à configurer dans next.config.ts headers)
  if (reportOnly) {
    directives.push("report-uri /api/csp-report");
  }

  return directives.join("; ");
}

// ─── Headers statiques ──────────────────────────────────────────────────────
export interface SecurityHeadersOptions {
  /** Désactive HSTS (utile en localhost dev). Défaut: false en production. */
  disableHsts?: boolean;
  /** Âge HSTS en secondes. Défaut : 1 an (31536000). */
  hstsMaxAge?: number;
  /** Inclut les sous-domaines dans HSTS. Défaut : true. */
  hstsIncludeSubdomains?: boolean;
  /** Active HSTS preload. Défaut : false (uniquement après soumission à hstspreload.org). */
  hstsPreload?: boolean;
}

export function buildSecurityHeaders(
  opts: SecurityHeadersOptions = {},
): Record<string, string> {
  const isProd = process.env.NODE_ENV === "production";
  const {
    disableHsts = !isProd,
    hstsMaxAge = 31536000,
    hstsIncludeSubdomains = true,
    hstsPreload = false,
  } = opts;

  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-DNS-Prefetch-Control": "on",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()", // opt-out FLoC
      "browsing-topics=()", // opt-out Topics API
      "payment=(self)", // Stripe
      "clipboard-read=(self)",
      "clipboard-write=(self)",
    ].join(", "),
  };

  if (!disableHsts) {
    const parts = [`max-age=${hstsMaxAge}`];
    if (hstsIncludeSubdomains) parts.push("includeSubDomains");
    if (hstsPreload) parts.push("preload");
    headers["Strict-Transport-Security"] = parts.join("; ");
  }

  return headers;
}

// ─── Application à une NextResponse ──────────────────────────────────────────
/**
 * Applique tous les headers de sécurité à une NextResponse.
 * À appeler dans le middleware, sur chaque requête.
 */
export function applySecurityHeaders(
  response: NextResponse,
  nonce: string,
  opts?: SecurityHeadersOptions,
): void {
  // 1. CSP avec nonce per-request
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  // Report-only pour mise en place progressive (à désactiver après validation)
  // response.headers.set("Content-Security-Policy-Report-Only", buildCsp(nonce, true));

  // 2. Headers statiques
  const staticHeaders = buildSecurityHeaders(opts);
  for (const [key, value] of Object.entries(staticHeaders)) {
    response.headers.set(key, value);
  }

  // 3. Header personnalisé pour exposer le nonce aux Server Components
  // (les Server Components peuvent lire request.headers.get('x-nonce'))
  response.headers.set("X-Nonce", nonce);

  // 4. Supprimer X-Powered-By (déjà géré par next.config.ts poweredByHeader:false)
  // Next.js le retire automatiquement si poweredByHeader est false.
}

// ─── Headers pour next.config.ts (static assets) ─────────────────────────────
/**
 * Headers statiques à appliquer aux assets statiques via next.config.ts.
 * Le CSP est géré par le middleware car il nécessite un nonce per-request.
 */
export function staticAssetHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    ...buildSecurityHeaders(),
  };
}
