// ============================================================
// ACADIA — MES TP (mission Student Enrollment) — TP publiés des
// cohortes où l'étudiant est réellement inscrit, jamais tous les TP de
// la base.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { listStudentAssignments } from "@/lib/server/assessment/EnrollmentService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || undefined;
  const pageSize = Number(url.searchParams.get("pageSize")) || undefined;

  try {
    const result = await listStudentAssignments(user.id, { page, pageSize });
    return Response.json(result, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
