// ============================================================
// ACADIA — SURVEY : DÉTAIL D'UNE RÉPONSE (propriétaire uniquement)
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById, getSurveyResponseDetail } from "@/lib/server/survey/SurveyStore";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string; responseId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, responseId } = await context.params;
  const existing = await getSurveyById(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  const detail = await getSurveyResponseDetail(id, responseId);
  if (!detail) return notFound();

  return Response.json({ response: detail }, { status: 200 });
}
