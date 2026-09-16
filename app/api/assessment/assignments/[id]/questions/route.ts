// ============================================================
// ACADIA — QUESTIONS D'UN ASSIGNMENT (mission Assignment Builder + TP
// Intelligence — POST enseignant ; mission Student Submission Engine —
// GET étudiant, assaini)
//
// GET : vue étudiante (jamais expectedAnswer/rubric/réponse correcte,
// mission Student Submission Engine §13) — accessible uniquement si
// l'assignment est visible (published/closed, voir
// AssignmentService.getAssignmentForStudent). Le propriétaire
// enseignant obtient la même vue assainie ici — la vue complète avec
// barème/réponse attendue reste sur GET /api/assessment/questions/[id]
// (déjà réservée à l'enseignant, mission Assignment Builder).
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { addQuestion, getQuestionsForStudent } from "@/lib/server/assessment/QuestionService";
import { getAssignmentForStudent } from "@/lib/server/assessment/AssignmentService";
import { QUESTION_TYPES } from "@/lib/core/assessment/AssessmentTypes";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    await getAssignmentForStudent(id); // lève 404 si non published/closed — jamais un 403 qui confirmerait l'existence d'un brouillon
    const questions = await getQuestionsForStudent(id);
    return Response.json({ questions }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}

const bodySchema = z.object({
  statement: z.string().min(1).max(5000),
  type: z.enum(QUESTION_TYPES),
  maxScore: z.number().positive(),
  order: z.number().int().min(0).optional(),
  expectedAnswer: z.string().max(5000).optional(),
  instructions: z.string().max(5000).optional(),
  metadata: z.string().max(10000).optional(),
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
    const question = await addQuestion({
      teacherId: user.id,
      assignmentId: id,
      statement: parsed.data.statement,
      type: parsed.data.type,
      maxScore: parsed.data.maxScore,
      order: parsed.data.order,
      expectedAnswer: parsed.data.expectedAnswer,
      instructions: parsed.data.instructions,
      metadata: parsed.data.metadata,
    });
    return Response.json({ question }, { status: 201 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
