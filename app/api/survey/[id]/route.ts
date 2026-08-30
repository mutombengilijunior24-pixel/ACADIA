// ============================================================
// ACADIA — SURVEY : DÉTAIL / MISE À JOUR (propriétaire uniquement)
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById, updateSurveyMeta } from "@/lib/server/survey/SurveyStore";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const survey = await getSurveyById(id);
  if (!survey) return notFound();
  if (survey.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  return Response.json({ survey }, { status: 200 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const existing = await getSurveyById(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const allowed = ["title", "description", "objective", "problem", "targetAudience", "institution", "isAnonymous", "targetResponses", "startDate", "endDate"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const survey = await updateSurveyMeta(id, patch);
  return Response.json({ survey }, { status: 200 });
}
