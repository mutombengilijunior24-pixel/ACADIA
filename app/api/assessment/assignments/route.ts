// ============================================================
// ACADIA — CRÉATION D'ASSIGNMENT (mission Academic Assessment Core)
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { createAssignment } from "@/lib/server/assessment/AssignmentService";
import { listAssignmentsForTeacher } from "@/lib/server/assessment/TeacherWorkspaceService";
import { ASSIGNMENT_TYPES, ASSIGNMENT_STATUSES, type AssignmentStatus } from "@/lib/core/assessment/AssessmentTypes";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

// ------------------------------------------------------------
// GET — mission Teacher Workspace + Gradebook §6/§7 : liste paginée
// des TP de l'enseignant courant (jamais un id envoyé par le client),
// filtrable par statut. Ownership implicite : listAssignmentsForTeacher
// ne peut structurellement retourner que les assignments de user.id.
// ------------------------------------------------------------

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam && (ASSIGNMENT_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as AssignmentStatus) : undefined;
  const page = Number(url.searchParams.get("page")) || undefined;
  const pageSize = Number(url.searchParams.get("pageSize")) || undefined;

  try {
    const result = await listAssignmentsForTeacher(user.id, { status, page, pageSize });
    return Response.json(result, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}

const bodySchema = z.object({
  courseId: z.string().min(1),
  cohortId: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  instructions: z.string().max(10000).optional(),
  type: z.enum(ASSIGNMENT_TYPES),
  availableFrom: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const assignment = await createAssignment({
      teacherId: user.id,
      courseId: parsed.data.courseId,
      cohortId: parsed.data.cohortId,
      title: parsed.data.title,
      description: parsed.data.description,
      instructions: parsed.data.instructions,
      type: parsed.data.type,
      availableFrom: parsed.data.availableFrom ? new Date(parsed.data.availableFrom) : undefined,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
    });
    return Response.json({ assignment }, { status: 201 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
