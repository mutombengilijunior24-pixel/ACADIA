// ============================================================
// ACADIA — SUPPRESSION D'UNE RÉPONSE (mission Student Submission Engine §17)
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { deleteAnswer } from "@/lib/server/assessment/SubmissionService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; questionId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, questionId } = await context.params;

  try {
    await deleteAnswer(user.id, id, questionId);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
