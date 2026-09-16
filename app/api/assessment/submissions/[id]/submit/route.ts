// ============================================================
// ACADIA — SOUMISSION FINALE (mission Academic Assessment Core, étendu
// par la Mission 9 — correction automatique à la soumission)
//
// La correction automatique est programmée via `after()` (next/server,
// stable depuis Next 15.1, confirmé pour cette version dans
// node_modules/next/dist/docs) : elle s'exécute APRÈS l'envoi de la
// réponse HTTP — l'étudiant reçoit sa confirmation de soumission
// instantanément, jamais retardée par l'appel IA de correction.
// ============================================================

import { after } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { submitSubmission } from "@/lib/server/assessment/SubmissionService";
import { autoGradeSubmissionAfterSubmit } from "@/lib/server/assessment/AIGradingService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";
// Plusieurs questions IA-éligibles peuvent être corrigées séquentiellement
// en arrière-plan — au-delà de la limite par défaut d'une fonction
// serverless (mission §A). Sans effet en dev ; à ajuster si besoin selon
// le plan d'hébergement réel une fois en production.
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const submission = await submitSubmission(user.id, id);
    after(() => autoGradeSubmissionAfterSubmit(submission.id));
    return Response.json({ submission }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
