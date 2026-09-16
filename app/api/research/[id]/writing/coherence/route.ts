// ============================================================
// ACADIA — AUDIT DE COHÉRENCE VERTICALE DE LA RÉDACTION (Mission 9, §13/§38)
//
// Toujours recalculé à la volée (jamais persisté) — même philosophie
// que ScientificDiscussion (P10) : reste automatiquement à jour avec
// le dernier état du projet, sans risque de rapport périmé silencieux.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { checkCoherence, WritingForbiddenError, WritingNotFoundError } from "@/lib/server/research/WritingSectionService";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  try {
    const report = await checkCoherence(user.id, id);
    return Response.json({ report }, { status: 200 });
  } catch (error) {
    if (error instanceof WritingNotFoundError) return notFound();
    if (error instanceof WritingForbiddenError) return forbidden(error.message, { actorId: user.id, entityType: "ResearchProject", entityId: id });
    throw error;
  }
}
