"use client";

/**
 * HERMÈS — R-008 — React error boundary (route-level)
 *
 * Catches errors thrown during render of any route segment. Displays a
 * recoverable error UI with a "Try again" button that resets the boundary.
 *
 * For errors that escape this boundary (e.g. root layout throw), see
 * `global-error.tsx`.
 *
 * Usage: automatic — Next.js wraps every route segment with this file.
 */

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the server-side error reporter (could be Sentry, Datadog, etc.)
    console.error("[HERMÈS] Route error boundary caught:", error);
  }, [error]);

  return (
    <div
      style={{
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
      <div
        style={{
          maxWidth: "32rem",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            marginBottom: "0.75rem",
            color: "#F0F4F8",
          }}
        >
          Une erreur est survenue
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "#7B8A9A",
            marginBottom: "1.5rem",
            lineHeight: 1.5,
          }}
        >
          La page n&apos;a pas pu se charger correctement. Vous pouvez réessayer
          ou revenir à l&apos;accueil.
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
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
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
          <a
            href="/"
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#7B8A9A",
              background: "#18212F",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem",
              cursor: "pointer",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}
