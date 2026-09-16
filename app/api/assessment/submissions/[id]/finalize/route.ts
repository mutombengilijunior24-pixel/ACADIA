// ============================================================
// ACADIA — FINALISATION DE LA NOTE D'UNE COPIE (mission Teacher
// Workspace + Gradebook)
//
// Mince enveloppe autour de EvaluationService.finalizeSubmissionGrade
// (construite en Mission 3, jamais dupliquée ici) — seule fonction qui
// fait entrer une soumission dans le Gradebook (transition vers
// "graded"). Cette route manquait avant cette mission : sans elle,
// aucune soumission n'atteignait jamais "graded" par une action
// enseignant réelle, alors que la fonction existait déjà.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { finalizeSubmissionGrade } from "@/lib/server/assessment/EvaluationService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const totals = await finalizeSubmissionGrade(user.id, id);
    return Response.json({ totals }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
