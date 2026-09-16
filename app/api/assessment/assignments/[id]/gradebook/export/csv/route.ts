// ============================================================
// ACADIA — EXPORT CSV DU GRADEBOOK (mission Teacher Workspace + Gradebook §27)
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getGradebook } from "@/lib/server/assessment/GradebookService";
import { buildGradebookCsv, gradebookExportFileBaseName } from "@/lib/server/assessment/GradebookExport";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  try {
    const gradebook = await getGradebook(user.id, id);
    const csv = buildGradebookCsv(gradebook);

    await logAudit({ actorId: user.id, action: "GRADE_EXPORT_REQUESTED", entityType: "Assignment", entityId: id, metadata: { format: "csv", rows: gradebook.rows.length } });
    void trackProductEvent({ userId: user.id, eventType: "GRADE_EXPORT_REQUESTED", metadata: { assignmentId: id, format: "csv" } });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${gradebookExportFileBaseName(gradebook.assignmentTitle)}-notes.csv"`,
      },
    });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
