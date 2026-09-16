// ============================================================
// ACADIA — LECTURE / ÉDITION D'UN ASSIGNMENT (mission Academic
// Assessment Core, étendu par Assignment Builder + TP Intelligence)
//
// Ownership à double sens (mission §19) : l'enseignant propriétaire
// voit tout, y compris en "draft" ; tout autre utilisateur authentifié
// ne voit l'assignment que s'il est "published"/"closed" (vue étudiant).
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getAssignmentForTeacher, getAssignmentForStudent, updateAssignment } from "@/lib/server/assessment/AssignmentService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";
import { AssessmentForbiddenError, AssessmentNotFoundError } from "@/lib/core/assessment/AssessmentTypes";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const assignment = await getAssignmentForTeacher(user.id, id);
    return Response.json({ assignment, viewAs: "teacher" }, { status: 200 });
  } catch (error) {
    if (!(error instanceof AssessmentForbiddenError) && !(error instanceof AssessmentNotFoundError)) {
      return toAssessmentErrorResponse(error);
    }
    try {
      const assignment = await getAssignmentForStudent(id);
      return Response.json({ assignment, viewAs: "student" }, { status: 200 });
    } catch (studentError) {
      return toAssessmentErrorResponse(studentError);
    }
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  instructions: z.string().max(10000).optional(),
  availableFrom: z.string().datetime().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
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
    const assignment = await updateAssignment(user.id, id, {
      title: parsed.data.title,
      description: parsed.data.description,
      instructions: parsed.data.instructions,
      availableFrom: parsed.data.availableFrom === undefined ? undefined : parsed.data.availableFrom ? new Date(parsed.data.availableFrom) : null,
      dueAt: parsed.data.dueAt === undefined ? undefined : parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
    });
    return Response.json({ assignment }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
