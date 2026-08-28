import type { NextConfig } from "next";

// ============================================================
// ACADIA — EN-TÊTES DE SÉCURITÉ (P17)
//
// Une Content-Security-Policy stricte n'est PAS activée ici :
// l'activer sans audit exhaustif de toutes les sources déjà
// utilisées (export PDF, polices, etc.) risquerait de casser
// silencieusement des fonctionnalités livrées — voir
// ACADIA_P17_SECURITY.md §4 pour la limite assumée.
// ============================================================

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
