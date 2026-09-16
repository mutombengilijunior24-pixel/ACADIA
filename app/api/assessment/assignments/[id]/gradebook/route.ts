// ============================================================
// ACADIA — GRADEBOOK D'UN TP (mission Teacher Workspace + Gradebook §22-26)
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getGradebook } from "@/lib/server/assessment/GradebookService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const gradebook = await getGradebook(user.id, id);
    void trackProductEvent({ userId: user.id, eventType: "GRADEBOOK_VIEWED", metadata: { assignmentId: id } });
    return Response.json({ gradebook }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
