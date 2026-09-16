// ============================================================
// ACADIA — RÉSULTATS D'UN ÉTUDIANT, DANS LE CONTEXTE DE L'ENSEIGNANT
// (mission Teacher Workspace + Gradebook §24)
//
// Ownership imposée dans la requête elle-même (voir
// getStudentResultsForTeacher : `assignment: { teacherId }`) — jamais
// un filtre après-coup.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getStudentResultsForTeacher } from "@/lib/server/assessment/TeacherWorkspaceService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ studentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { studentId } = await context.params;

  try {
    const results = await getStudentResultsForTeacher(user.id, studentId);
    return Response.json({ results }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
