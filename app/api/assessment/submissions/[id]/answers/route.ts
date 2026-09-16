// ============================================================
// ACADIA — ÉCRITURE D'UNE RÉPONSE (mission Academic Assessment Core,
// renforcé par la mission Student Submission Engine)
//
// answerData est désormais un OBJET JSON structuré (mission §11-§16 :
// {kind:"MULTIPLE_CHOICE", selectedOptionId} / {kind:"TRUE_FALSE",
// value} / {kind:"NUMERIC", value} / {kind:"CALCULATION", ...}) —
// validé en profondeur par SubmissionService.upsertAnswer selon le type
// réel de la question, jamais ici. Avant cette mission, ce champ était
// une simple chaîne libre non validée.
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { upsertAnswer, listAnswersForSubmission } from "@/lib/server/assessment/SubmissionService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// ------------------------------------------------------------
// GET — mission Student Enrollment : recharge les réponses déjà
// enregistrées d'un brouillon (gap non comblé par la Mission Student
// Submission Engine, qui n'avait construit que le moteur serveur).
// ------------------------------------------------------------

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  try {
    const answers = await listAnswersForSubmission(user.id, id);
    return Response.json({ answers }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}

const bodySchema = z.object({
  questionId: z.string().min(1),
  answerText: z.string().max(20000).optional(),
  answerData: z.unknown().optional(),
  attachmentRef: z.string().max(2000).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const answer = await upsertAnswer(user.id, id, parsed.data.questionId, {
      answerText: parsed.data.answerText,
      answerData: parsed.data.answerData,
      attachmentRef: parsed.data.attachmentRef,
    });
    return Response.json({ answer }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
