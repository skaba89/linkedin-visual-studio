import type { NextConfig } from "next";

/**
 * HERMÈS — next.config.ts
 *
 * R-003 (P0) résolu : `ignoreBuildErrors: true` retiré. Toutes les erreurs
 * TypeScript ont été corrigées dans le commit R-003 (86 → 0 erreurs via
 * `tsc --noEmit`). Le build échouera désormais en cas de régression de type.
 *
 * Les headers de sécurité (R-010) sont gérés dynamiquement par le middleware
 * via src/lib/security-headers.ts car ils nécessitent un nonce CSP per-request.
 * Les headers ci-dessous s'appliquent uniquement aux assets statiques
 * (_next/static, _next/image) qui ne passent pas par le middleware.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=(), payment=(self)",
  },
  // HSTS uniquement en production (géré aussi par le middleware)
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // R-003 : `typescript.ignoreBuildErrors` retiré — 0 erreurs tsc --noEmit
  reactStrictMode: true,
  // Retire X-Powered-By header
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Headers de sécurité pour les assets statiques (hors middleware)
        source: "/_next/static/:path*",
        headers: securityHeaders,
      },
      {
        source: "/_next/image/:path*",
        headers: securityHeaders,
      },
      {
        // Favicon et manifest — mêmes headers
        source: "/favicon.ico",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
