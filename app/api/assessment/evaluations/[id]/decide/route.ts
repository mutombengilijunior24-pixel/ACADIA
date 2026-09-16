// ============================================================
// ACADIA — DÉCISION ENSEIGNANTE SUR UNE ÉVALUATION (mission AI Grading
// Engine)
//
// Seule route qui fait progresser une Evaluation au-delà de
// "ai_proposed" — mince enveloppe autour de
// EvaluationService.applyTeacherDecision (mission Academic Assessment
// Core), jamais dupliquée ici. aiScore n'est jamais modifié par cette
// route, quelle que soit la décision.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { applyTeacherDecision } from "@/lib/server/assessment/EvaluationService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";
import type { TeacherDecision } from "@/lib/core/assessment/AssessmentTypes";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_DECISIONS: readonly TeacherDecision[] = ["accept", "modify", "reject"];

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const decision = body?.decision as TeacherDecision | undefined;
  if (!decision || !VALID_DECISIONS.includes(decision)) {
    return Response.json({ error: `decision doit être l'une de : ${VALID_DECISIONS.join(", ")}.` }, { status: 400 });
  }

  try {
    const evaluation = await applyTeacherDecision({
      teacherId: user.id,
      evaluationId: id,
      decision,
      humanScore: typeof body?.humanScore === "number" ? body.humanScore : undefined,
      feedbackText: typeof body?.feedbackText === "string" ? body.feedbackText : undefined,
    });
    return Response.json({ evaluation }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
