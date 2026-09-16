// ============================================================
// ACADIA — COHÉRENCE CITATIONS ↔ BIBLIOGRAPHIE (mission Bibliography &
// Reference Intelligence §18) — rapport déterministe, jamais une
// correction automatique.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { checkBibliographyConsistency } from "@/lib/server/research/CitationService";
import { toReferenceErrorResponse } from "@/lib/server/research/referenceHttpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  try {
    const report = await checkBibliographyConsistency(user.id, id);
    return Response.json({ report }, { status: 200 });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}
