"use client";

/**
 * HERMÈS — R-008 — Global error boundary
 *
 * Catches errors that escape the root layout (e.g. errors thrown in
 * `layout.tsx` itself, or in server components during streaming). This
 * component replaces the ENTIRE document — it must render its own
 * `<html>` and `<body>` tags.
 *
 * Reference: https://nextjs.org/docs/app/api-reference/file-conventions/error-handler
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[HERMÈS] Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#080C10",
          color: "#F0F4F8",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              marginBottom: "0.75rem",
              color: "#F0F4F8",
            }}
          >
            Erreur critique
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#7B8A9A",
              marginBottom: "1.5rem",
              lineHeight: 1.5,
            }}
          >
            Une erreur inattendue est survenue au niveau de l&apos;application.
            Vous pouvez réessayer — si le problème persiste, rechargez la page
            ou revenez plus tard.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#4A5568",
                marginBottom: "1.5rem",
                fontFamily: "monospace",
              }}
            >
              Référence: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#080C10",
              background: "#00D4FF",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem",
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
