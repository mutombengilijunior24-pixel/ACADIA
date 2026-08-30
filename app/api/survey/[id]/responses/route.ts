// ============================================================
// ACADIA — SURVEY : LISTE DES RÉPONSES (propriétaire uniquement, filtrable)
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById, listSurveyResponses, getSurveyDistinctFilterValues } from "@/lib/server/survey/SurveyStore";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const existing = await getSurveyById(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const institution = url.searchParams.get("institution") ?? undefined;
  const faculty = url.searchParams.get("faculty") ?? undefined;
  const level = url.searchParams.get("level") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const [responses, filterValues] = await Promise.all([
    listSurveyResponses(id, { categoryId, institution, faculty, level, status }),
    getSurveyDistinctFilterValues(id),
  ]);

  return Response.json({ responses, filterValues }, { status: 200 });
}
