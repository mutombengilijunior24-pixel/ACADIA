// ============================================================
// ACADIA — TEACHER DASHBOARD (mission Teacher Workspace + Gradebook §5)
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getTeacherDashboard } from "@/lib/server/assessment/TeacherWorkspaceService";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const summary = await getTeacherDashboard(user.id);
  void trackProductEvent({ userId: user.id, eventType: "TEACHER_DASHBOARD_VIEWED" });
  return Response.json({ summary }, { status: 200 });
}
