// ============================================================
// ACADIA — ÉDITION D'UNE QUESTION (mission Assignment Builder + TP Intelligence)
//
// Peut créer une NOUVELLE VERSION (voir QuestionService.updateQuestion)
// si l'assignment n'est plus "draft" — la route reste inchangée, toute
// la logique de versioning/conflit (409) vit dans le service.
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { updateQuestion } from "@/lib/server/assessment/QuestionService";
import { QUESTION_TYPES } from "@/lib/core/assessment/AssessmentTypes";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  statement: z.string().min(1).max(5000).optional(),
  type: z.enum(QUESTION_TYPES).optional(),
  maxScore: z.number().positive().optional(),
  order: z.number().int().min(0).optional(),
  expectedAnswer: z.string().max(5000).optional(),
  instructions: z.string().max(5000).optional(),
  metadata: z.string().max(10000).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const question = await updateQuestion(user.id, id, parsed.data);
    return Response.json({ question }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
