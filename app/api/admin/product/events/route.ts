// ============================================================
// ACADIA — ERREURS PRODUIT (admin) — Bloc 2, 08/09/2026
//
// ERROR_OCCURRED (auto-signalées côté client) — distinctes des
// erreurs techniques serveur déjà capturées par Sentry lorsqu'il est
// configuré (voir instrumentation.ts) : jamais dupliquées, jamais
// recréées ici.
// ============================================================

import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { computeErrorStats } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const errors = await computeErrorStats(100);
  return Response.json({ errors }, { status: 200 });
}
