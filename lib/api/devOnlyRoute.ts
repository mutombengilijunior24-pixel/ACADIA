import { NextResponse } from "next/server";

// ============================================================
// ACADIA — GARDE ROUTES DE DÉVELOPPEMENT
//
// Certaines routes (tests manuels d'A1/A2, débogage) doivent
// rester utilisables en développement mais ne jamais être
// exploitables dans une version destinée aux testeurs/production.
//
// Usage :
//
//   export async function GET() {
//     const blocked = devOnlyRoute();
//     if (blocked) return blocked;
//     ... logique existante inchangée ...
//   }
//
// process.env.NODE_ENV vaut "development" sous `next dev` et
// "production" sous `next build`/`next start` — Next.js le
// définit automatiquement, aucune configuration supplémentaire
// n'est nécessaire.
// ============================================================

// P13.25 — même garde, pour une PAGE (pas une route API) : appeler
// `assertDevOnlyPage()` en tout début de composant pour retirer une
// page de débogage hors développement (404, jamais accessible en
// production) sans la supprimer (utile en développement).
export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function devOnlyRoute(): NextResponse | null {
  if (process.env.NODE_ENV === "development") {
    return null;
  }

  // 404 plutôt que 403 : ne confirme même pas l'existence
  // de la route à un appelant extérieur.
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "DEV_ONLY_ROUTE",
        message: "Cette route est réservée à l'environnement de développement.",
      },
    },
    { status: 404 }
  );
}
