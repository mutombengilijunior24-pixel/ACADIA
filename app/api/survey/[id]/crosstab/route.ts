// ============================================================
// ACADIA — SURVEY : TABLEAU CROISÉ (P20-A — analyse interactive)
//
// Calcul statistique pur, aucun appel OpenAI ici (voir
// /api/survey/[id]/interpret pour la passerelle IA — séparation
// volontaire : ce endpoint peut être appelé à chaque changement de
// filtre sans jamais déclencher de coût OpenAI). Le calcul lui-même
// vit dans SurveyCrosstabService (partagé avec /interpret) — jamais
// deux implémentations du même calcul.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById } from "@/lib/server/survey/SurveyStore";
import { computeCrosstab, CROSSTAB_TYPES, type CrosstabFilters } from "@/lib/server/survey/SurveyCrosstabService";
import type { CompareByDimension } from "@/lib/core/survey/SurveyAnalyticsEngine";

export const runtime = "nodejs";

const COMPARE_BY_VALUES: CompareByDimension[] = ["institution", "faculty", "level", "ageBucket", "category"];

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const survey = await getSurveyById(id);
  if (!survey) return notFound();
  if (survey.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  const url = new URL(request.url);
  const questionId = url.searchParams.get("questionId");
  const compareByParam = url.searchParams.get("compareBy");
  const compareBy = COMPARE_BY_VALUES.includes(compareByParam as CompareByDimension) ? (compareByParam as CompareByDimension) : null;

  if (!questionId || !compareBy) {
    return Response.json({ error: "Variable et dimension de comparaison requises." }, { status: 400 });
  }

  const question = survey.questions.find((q) => q.id === questionId);
  if (!question) return notFound();
  if (!CROSSTAB_TYPES.has(question.type)) {
    return Response.json({ error: "Cette question ne permet pas de tableau croisé (question ouverte ou de profil)." }, { status: 400 });
  }

  const filters: CrosstabFilters = {
    institution: url.searchParams.get("institution") ?? undefined,
    faculty: url.searchParams.get("faculty") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    ageBucket: url.searchParams.get("ageBucket") ?? undefined,
  };

  const result = await computeCrosstab(survey, question, compareBy, filters);
  return Response.json(result, { status: 200 });
}
