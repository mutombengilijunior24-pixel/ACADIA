// ============================================================
// ACADIA — PUBLICATION DU QUESTIONNAIRE (Bloc C, 11/09/2026)
//
// Convertit l'instrument de recherche déjà accepté par l'étudiant
// (QuestionnaireToSurvey.ts) puis réutilise tel quel le pipeline
// Survey existant (createSurvey + publishSurvey,
// lib/server/survey/SurveyStore.ts) — aucune nouvelle
// infrastructure de lien public/logo/collecte, jamais un second
// système concurrent.
// ============================================================

import { getSessionUser, unauthorized, notFound, forbidden } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord } from "@/lib/server/research/ResearchStateService";
import { createSurvey, publishSurvey } from "@/lib/server/survey/SurveyStore";
import { toSurveyPayload } from "@/lib/core/questionnaire/QuestionnaireToSurvey";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const limit = rateLimiter.check(rateLimitKey("questionnaire-publish", user.id), 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de publications récentes. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const instrument = record.instrument;
  if (!instrument?.questionnaire) {
    return Response.json({ error: "Aucun questionnaire quantitatif à publier pour ce projet." }, { status: 400 });
  }
  if (instrument.status !== "accepted") {
    return Response.json({ error: "Validez d'abord le questionnaire avant de le publier." }, { status: 400 });
  }

  const payload = toSurveyPayload(record.project, instrument.questionnaire);
  if (payload.questions.length === 0) {
    return Response.json({ error: "Aucune question publiable dans ce questionnaire." }, { status: 400 });
  }

  try {
    const survey = await createSurvey({
      ownerId: user.id,
      title: record.project.title || "Questionnaire",
      description: instrument.questionnaire.description,
      categories: payload.categories,
      questions: payload.questions,
    });
    const published = await publishSurvey(survey.id);
    if (!published?.publicId) {
      return Response.json({ error: "La publication a échoué. Réessayez dans un instant." }, { status: 502 });
    }

    return Response.json(
      {
        surveyId: survey.id,
        publicId: published.publicId,
        publicUrl: `/s/${published.publicId}`,
        excludedCount: payload.excludedCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ACADIA] Erreur publication questionnaire :", error);
    return Response.json({ error: "ACADIA n'a pas pu publier ce questionnaire pour le moment." }, { status: 502 });
  }
}
