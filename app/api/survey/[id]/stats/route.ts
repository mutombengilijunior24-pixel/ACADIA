// ============================================================
// ACADIA — SURVEY : STATISTIQUES / CENTRE DE PILOTAGE (propriétaire uniquement)
//
// Calcule fréquences/moyennes/médianes/répartitions/évolution réelles
// à partir des réponses effectivement collectées (SurveyAnalyticsEngine,
// déterministe) — jamais une valeur inventée. Filtres combinables
// appliqués côté serveur (institution/faculté/niveau/tranche d'âge/
// catégorie/période) : jamais toutes les réponses chargées en mémoire
// côté client pour recalculer quoi que ce soit.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById, getSurveyDistinctFilterValues } from "@/lib/server/survey/SurveyStore";
import { computeSurveyStatsBundle } from "@/lib/server/survey/SurveyStatsService";
import { AGE_BUCKETS } from "@/lib/core/survey/SurveyAnalyticsEngine";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const survey = await getSurveyById(id);
  if (!survey) return notFound();
  if (survey.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  const url = new URL(request.url);
  const institution = url.searchParams.get("institution") ?? undefined;
  const faculty = url.searchParams.get("faculty") ?? undefined;
  const level = url.searchParams.get("level") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const ageBucketKey = url.searchParams.get("ageBucket") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const timelineDays = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 30));

  const ageRange = ageBucketKey ? AGE_BUCKETS.find((b) => b.key === ageBucketKey) : undefined;

  const responseFilters = {
    institution,
    faculty,
    level,
    categoryId,
    ageMin: ageRange?.min,
    ageMax: ageRange?.max,
    from,
    to,
  };

  const [bundle, filterValues] = await Promise.all([
    computeSurveyStatsBundle(survey, responseFilters, timelineDays),
    getSurveyDistinctFilterValues(id),
  ]);

  return Response.json(
    {
      stats: bundle.stats,
      frequencies: bundle.frequencies,
      breakdowns: bundle.breakdowns,
      timeline: bundle.timeline,
      filterValues,
      activeFilters: responseFilters,
    },
    { status: 200 }
  );
}
