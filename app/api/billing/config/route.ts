// ============================================================
// ACADIA — CATALOGUE DE PRICING (mission Conversion + Pay-as-you-progress)
//
// Lecture seule, aucune authentification requise (le catalogue et le
// statut bêta ne sont pas des données sensibles — un visiteur anonyme
// doit pouvoir comprendre le modèle avant de s'inscrire). Point
// UNIQUE que le client interroge pour savoir "combien ça coûte" —
// jamais un prix recalculé ou dupliqué côté front.
// ============================================================

import { ENTITLEMENT_CATALOG, isBetaMode } from "@/lib/server/billing/PricingConfig";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    {
      betaMode: isBetaMode(),
      catalog: Object.values(ENTITLEMENT_CATALOG),
    },
    { status: 200 }
  );
}
