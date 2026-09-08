// ============================================================
// ACADIA — VUE D'ENSEMBLE PRODUIT (admin) — Bloc 2, 08/09/2026
//
// Lecture seule, purement factuelle — jamais de cause d'abandon
// déduite ici (voir mission §23) : uniquement des comptages réels.
// ============================================================

import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { computeProductOverview, computeFunnel } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const [overview, funnel] = await Promise.all([computeProductOverview(), computeFunnel()]);

  return Response.json({ overview, funnel }, { status: 200 });
}
