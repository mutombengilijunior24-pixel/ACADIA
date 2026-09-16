// ============================================================
// ACADIA — RESOUMISSION APRÈS RETOUR (mission Student Submission
// Engine §22) — crée une NOUVELLE version, ne modifie jamais l'ancienne.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { resubmitAfterReturn } from "@/lib/server/assessment/SubmissionService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const submission = await resubmitAfterReturn(user.id, id);
    return Response.json({ submission }, { status: 201 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
