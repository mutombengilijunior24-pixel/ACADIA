// ============================================================
// ACADIA — PRISE EN REVUE D'UNE SOUMISSION (mission Student Submission
// Engine) — submitted → under_review. Réservé à l'enseignant
// propriétaire de l'assignment.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { markUnderReview } from "@/lib/server/assessment/SubmissionService";
import { getSubmissionReviewForTeacher } from "@/lib/server/assessment/TeacherWorkspaceService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// ------------------------------------------------------------
// GET — mission Teacher Workspace + Gradebook §13/§14 : payload
// complet de revue (questions, réponses, propositions IA assainies)
// pour l'enseignant propriétaire. N'expose jamais aiRawProposal brut
// (voir TeacherWorkspaceService.extractReadableAiInsights).
// ------------------------------------------------------------

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const review = await getSubmissionReviewForTeacher(user.id, id);
    void trackProductEvent({ userId: user.id, eventType: "SUBMISSION_OPENED", metadata: { submissionId: id } });
    if (review.items.some((i) => i.evaluation)) {
      void trackProductEvent({ userId: user.id, eventType: "AI_PROPOSAL_VIEWED", metadata: { submissionId: id } });
    }
    return Response.json({ review }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const submission = await markUnderReview(user.id, id);
    return Response.json({ submission }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
