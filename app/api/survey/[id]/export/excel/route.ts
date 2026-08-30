// ============================================================
// ACADIA — SURVEY : EXPORT EXCEL (P21)
//
// Assemble, sans rien recalculer, les données déjà produites par
// SurveyStatsService (résumé/statistiques), SurveyExport (réponses)
// et SurveyCrosstabService (croisement optionnel, réutilise
// exactement le même calcul que /crosstab — P20-A) — une seule
// source de vérité pour chaque feuille.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById } from "@/lib/server/survey/SurveyStore";
import { computeSurveyStatsBundle } from "@/lib/server/survey/SurveyStatsService";
import { gatherSurveyResponseRows, parseFiltersFromUrl, describeFilters, exportFileBaseName } from "@/lib/server/survey/SurveyExport";
import { computeCrosstab, CROSSTAB_TYPES, type CrosstabFilters } from "@/lib/server/survey/SurveyCrosstabService";
import { buildSurveyExcelBuffer } from "@/lib/server/survey/SurveyExcel";
import type { CompareByDimension } from "@/lib/core/survey/SurveyAnalyticsEngine";
import { prisma } from "@/lib/server/db/prisma";

export const runtime = "nodejs";

const COMPARE_BY_VALUES: CompareByDimension[] = ["institution", "faculty", "level", "ageBucket", "category"];
const COMPARE_BY_LABELS: Record<CompareByDimension, string> = {
  institution: "Institution",
  faculty: "Faculté / École",
  level: "Niveau d'étude",
  ageBucket: "Tranche d'âge",
  category: "Catégorie",
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const survey = await getSurveyById(id);
  if (!survey) return notFound();
  if (survey.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  const url = new URL(request.url);
  const filters = parseFiltersFromUrl(url);
  const filtersDescription = describeFilters(url, survey);

  const [bundle, rows] = await Promise.all([computeSurveyStatsBundle(survey, filters), gatherSurveyResponseRows(survey, filters)]);

  let crosstab: Awaited<ReturnType<typeof computeCrosstab>> & { compareByLabel: string } | undefined;
  const questionId = url.searchParams.get("questionId");
  const compareByParam = url.searchParams.get("compareBy");
  const compareBy = COMPARE_BY_VALUES.includes(compareByParam as CompareByDimension) ? (compareByParam as CompareByDimension) : null;
  if (questionId && compareBy) {
    const question = survey.questions.find((q) => q.id === questionId);
    if (question && CROSSTAB_TYPES.has(question.type)) {
      const crosstabFilters: CrosstabFilters = {
        institution: filters.institution,
        faculty: filters.faculty,
        level: filters.level,
        categoryId: filters.categoryId,
        ageBucket: url.searchParams.get("ageBucket") ?? undefined,
      };
      const result = await computeCrosstab(survey, question, compareBy, crosstabFilters);
      crosstab = { ...result, compareByLabel: COMPARE_BY_LABELS[compareBy] };
    }
  }

  const buffer = await buildSurveyExcelBuffer({ survey, bundle, rows, filtersDescription, crosstab });

  await prisma.surveyEvent.create({ data: { surveyId: survey.id, type: "exported", metadata: JSON.stringify({ format: "excel", count: rows.length }) } });

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportFileBaseName(survey.title)}.xlsx"`,
    },
  });
}
