// ============================================================
// ACADIA — DIAGNOSTIC PÉDAGOGIQUE D'UN TP (mission Assignment Builder +
// TP Intelligence, §12)
//
// Rapport déterministe (JAMAIS d'appel OpenAI) — préparatoire au futur
// Teacher Copilot. Réservé à l'enseignant propriétaire : révèle la
// structure interne des questions/rubriques, jamais accessible à un
// étudiant.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getAssignmentForTeacher } from "@/lib/server/assessment/AssignmentService";
import { buildAssignmentDiagnostic } from "@/lib/server/assessment/AssignmentValidation";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    await getAssignmentForTeacher(user.id, id); // ownership — lève 403/404
    const diagnostic = await buildAssignmentDiagnostic(id);
    return Response.json({ diagnostic }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
