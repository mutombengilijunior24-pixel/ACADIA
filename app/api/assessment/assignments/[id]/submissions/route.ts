// ============================================================
// ACADIA — SOUMISSION D'UN ÉTUDIANT (mission Academic Assessment Core)
//
// POST : récupère le brouillon courant ou en crée un (mission §6 :
// jamais pour un assignment "draft").
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getOrCreateDraftSubmission } from "@/lib/server/assessment/SubmissionService";
import { listSubmissionsForAssignment } from "@/lib/server/assessment/TeacherWorkspaceService";
import { ASSESSMENT_SUBMISSION_STATUSES, type AssessmentSubmissionStatus } from "@/lib/core/assessment/AssessmentTypes";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// ------------------------------------------------------------
// GET — mission Teacher Workspace + Gradebook §9/§11 : boîte de
// réception des copies pour l'enseignant propriétaire de ce TP,
// paginée côté serveur (jamais toute la base côté navigateur).
// ------------------------------------------------------------

export async function GET(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam && (ASSESSMENT_SUBMISSION_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as AssessmentSubmissionStatus) : undefined;
  const page = Number(url.searchParams.get("page")) || undefined;
  const pageSize = Number(url.searchParams.get("pageSize")) || undefined;

  try {
    const result = await listSubmissionsForAssignment(user.id, id, { status, page, pageSize });
    return Response.json(result, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const submission = await getOrCreateDraftSubmission(user.id, id);
    return Response.json({ submission }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
