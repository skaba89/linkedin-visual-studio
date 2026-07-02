/**
 * Endpoint de reporting CSP (Content-Security-Policy-Report-Only).
 * Reçoit les violations CSP envoyées par le navigateur et les logge.
 * À activer dans src/lib/security-headers.ts en décommentant la ligne
 * Content-Security-Policy-Report-Only pendant la phase de mise en place
 * progressive de la CSP stricte.
 *
 * R-010 — Volume 2 chapitre 9 — Endpoint de reporting.
 */
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body["csp-report"]) {
      return Response.json({ ok: false }, { status: 400 });
    }

    const report = body["csp-report"] as {
      "document-uri"?: string;
      "violated-directive"?: string;
      "blocked-uri"?: string;
      "line-number"?: number;
      "column-number"?: number;
      "source-file"?: string;
    };

    // Log structuré (sera capturé par le logger configuré)
    // En production, envoyer vers Sentry / Datadog / Logflare
    console.warn("[CSP Violation]", {
      violatedDirective: report["violated-directive"],
      blockedUri: report["blocked-uri"],
      documentUri: report["document-uri"],
      sourceFile: report["source-file"],
      lineNumber: report["line-number"],
      columnNumber: report["column-number"],
      timestamp: new Date().toISOString(),
    });

    return Response.json({ ok: true }, { status: 204 });
  } catch (err) {
    // Ne jamais renvoyer 500 sur l'endpoint de report — le navigateur
    // retryerait et spammerait. Toujours 204.
    return Response.json({ ok: false }, { status: 204 });
  }
}
