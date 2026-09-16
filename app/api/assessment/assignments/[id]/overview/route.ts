// ============================================================
// ACADIA — VUE D'ENSEMBLE D'UN TP POUR L'ENSEIGNANT (mission Teacher
// Workspace + Gradebook §8) — barème, rubrique agrégée, progression.
// Réutilise buildAssignmentDiagnostic (mission Assignment Builder),
// jamais recalculé ici.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getAssignmentOverview } from "@/lib/server/assessment/TeacherWorkspaceService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const overview = await getAssignmentOverview(user.id, id);
    void trackProductEvent({ userId: user.id, eventType: "ASSIGNMENT_OPENED", metadata: { assignmentId: id } });
    return Response.json({ overview }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
