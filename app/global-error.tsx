"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ACADIA] Erreur globale (racine de l'application) :", error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            textAlign: "center",
            background: "#f8fafc",
          }}
        >
          <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase" }}>
            Erreur critique
          </p>
          <h1 style={{ marginTop: "0.75rem", fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>
            ACADIA a rencontré un problème
          </h1>
          <p style={{ marginTop: "0.5rem", maxWidth: 420, fontSize: "0.875rem", color: "#64748b" }}>
            Aucune donnée n&apos;a été perdue. Veuillez réessayer ; si le problème persiste, revenez plus tard.
          </p>
          {error.digest && (
            <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#94a3b8" }}>Référence : {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              borderRadius: "0.75rem",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.875rem",
              padding: "0.625rem 1.25rem",
              border: "none",
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
