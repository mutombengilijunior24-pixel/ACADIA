// ============================================================
// ACADIA — LECTURE D'UNE SOUMISSION (mission Academic Assessment Core)
//
// Ownership stricte (mission §19) : l'étudiant propriétaire OU
// l'enseignant de l'assignment concerné — jamais un tiers.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getSubmissionForStudent, getSubmissionForTeacher } from "@/lib/server/assessment/SubmissionService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";
import { AssessmentForbiddenError, AssessmentNotFoundError } from "@/lib/core/assessment/AssessmentTypes";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const submission = await getSubmissionForStudent(user.id, id);
    return Response.json({ submission, viewAs: "student" }, { status: 200 });
  } catch (error) {
    if (!(error instanceof AssessmentForbiddenError) && !(error instanceof AssessmentNotFoundError)) {
      return toAssessmentErrorResponse(error);
    }
    try {
      const submission = await getSubmissionForTeacher(user.id, id);
      return Response.json({ submission, viewAs: "teacher" }, { status: 200 });
    } catch (teacherError) {
      return toAssessmentErrorResponse(teacherError);
    }
  }
}
