// ============================================================
// ACADIA — MES CLASSES (mission Student Enrollment)
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { listMyCohorts } from "@/lib/server/assessment/EnrollmentService";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const cohorts = await listMyCohorts(user.id);
  return Response.json({ cohorts }, { status: 200 });
}
