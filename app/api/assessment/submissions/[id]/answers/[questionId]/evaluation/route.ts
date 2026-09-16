// ============================================================
// ACADIA — LECTURE D'UNE PROPOSITION D'ÉVALUATION (mission AI Grading
// Engine)
//
// Enseignant UNIQUEMENT — jamais l'étudiant, même le sien : une
// proposition IA n'a de sens qu'avant validation humaine (mission "IA
// PROPOSE → PROFESSEUR VÉRIFIE"), l'exposer côté étudiant reviendrait à
// présenter une note non validée comme définitive.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getEvaluationForTeacherBySubmissionAndQuestion } from "@/lib/server/assessment/AIGradingService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; questionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, questionId } = await context.params;

  try {
    const evaluation = await getEvaluationForTeacherBySubmissionAndQuestion(user.id, id, questionId);
    return Response.json({ evaluation }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
