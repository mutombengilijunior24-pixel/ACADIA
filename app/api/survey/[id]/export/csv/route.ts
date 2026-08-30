// ============================================================
// ACADIA — SURVEY : EXPORT CSV (P21)
//
// Propriétaire uniquement. Respecte les filtres actifs (mêmes
// paramètres que /stats et /crosstab) — jamais un export complet
// quand des filtres sont sélectionnés. Aucune donnée technique
// (id interne, ownerId, respondentKey) exportée.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById } from "@/lib/server/survey/SurveyStore";
import { gatherSurveyResponseRows, buildCsv, exportFileBaseName, parseFiltersFromUrl } from "@/lib/server/survey/SurveyExport";
import { prisma } from "@/lib/server/db/prisma";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const survey = await getSurveyById(id);
  if (!survey) return notFound();
  if (survey.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  const url = new URL(request.url);
  const filters = parseFiltersFromUrl(url);
  const rows = await gatherSurveyResponseRows(survey, filters);
  const csv = buildCsv(survey, rows);

  await prisma.surveyEvent.create({ data: { surveyId: survey.id, type: "exported", metadata: JSON.stringify({ format: "csv", count: rows.length }) } });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileBaseName(survey.title)}-reponses.csv"`,
    },
  });
}
