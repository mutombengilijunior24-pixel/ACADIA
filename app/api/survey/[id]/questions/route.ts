// ============================================================
// ACADIA — SURVEY : ÉDITION DU QUESTIONNAIRE (propriétaire uniquement)
//
// Remplacement complet des questions — utilisé par l'éditeur avant
// publication. Une fois l'enquête publiée, la modification reste
// possible mais l'utilisateur doit être averti côté client que les
// réponses déjà collectées référencent les questions par id (voir
// SurveyStore.replaceSurveyQuestions).
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById, replaceSurveyQuestions } from "@/lib/server/survey/SurveyStore";
import { controlQuestionnaireQuality } from "@/lib/core/survey/SurveyQualityControl";
import type { SurveyQuestionType } from "@/lib/core/survey/SurveyTypes";

export const runtime = "nodejs";

interface QuestionInput {
  section?: string;
  order: number;
  type: SurveyQuestionType;
  text: string;
  required?: boolean;
  variable?: string;
  indicator?: string;
  visibleForCategoryIds?: string[];
  options?: { label: string; value: string; order: number }[];
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const existing = await getSurveyById(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  let body: { questions?: QuestionInput[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!Array.isArray(body.questions)) {
    return Response.json({ error: "Liste de questions requise." }, { status: 400 });
  }

  for (const q of body.questions) {
    if (!q.text?.trim() || !q.type) {
      return Response.json({ error: "Chaque question doit avoir un texte et un type." }, { status: 400 });
    }
  }

  // Même contrôle qualité qu'à la génération (doublons, quasi-doublons,
  // options manquantes) — corrige automatiquement lorsque sûr, sinon
  // signale à l'utilisateur via `warnings` sans bloquer l'enregistrement.
  const qualityControl = controlQuestionnaireQuality(body.questions, { objective: existing.objective, problem: existing.problem });

  const survey = await replaceSurveyQuestions(id, qualityControl.questions);
  return Response.json({ survey, warnings: qualityControl.warnings }, { status: 200 });
}
