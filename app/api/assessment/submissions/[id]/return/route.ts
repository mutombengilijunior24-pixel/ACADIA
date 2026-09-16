// ============================================================
// ACADIA — RETOUR D'UNE SOUMISSION À L'ÉTUDIANT (mission Student
// Submission Engine) — submitted/under_review/graded → returned.
// Réservé à l'enseignant propriétaire de l'assignment. Seul moyen
// d'autoriser une resoumission (voir POST .../resubmit).
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { returnSubmission } from "@/lib/server/assessment/SubmissionService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const submission = await returnSubmission(user.id, id);
    return Response.json({ submission }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
