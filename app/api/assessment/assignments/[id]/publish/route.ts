// ============================================================
// ACADIA — PUBLICATION D'UN ASSIGNMENT (mission Academic Assessment Core)
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { publishAssignment } from "@/lib/server/assessment/AssignmentService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const assignment = await publishAssignment(user.id, id);
    return Response.json({ assignment }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
