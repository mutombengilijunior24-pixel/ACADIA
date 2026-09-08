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

  // La police PDF embarquée (app/api/export/pdf/fonts/*.ttf) est lue
  // via un chemin construit à l'exécution (path.join(process.cwd(), ...))
  // — non détectable statiquement par le traceur de fichiers Vercel.
  // Sans cette inclusion explicite, les .ttf ne seraient pas inclus
  // dans le bundle de la fonction serverless et le rendu PDF en
  // production retomberait silencieusement sur la police PDF standard
  // (sans support grec/mathématique) — voir audit "100 étudiants".
  outputFileTracingIncludes: {
    "/api/export/pdf": ["./app/api/export/pdf/fonts/**/*"],
  },
};

export default nextConfig;
