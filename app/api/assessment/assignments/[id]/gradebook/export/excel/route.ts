// ============================================================
// ACADIA — EXPORT EXCEL DU GRADEBOOK (mission Teacher Workspace + Gradebook §27)
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getGradebook } from "@/lib/server/assessment/GradebookService";
import { buildGradebookExcelBuffer, gradebookExportFileBaseName } from "@/lib/server/assessment/GradebookExport";
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
    const buffer = await buildGradebookExcelBuffer(gradebook);

    await logAudit({ actorId: user.id, action: "GRADE_EXPORT_REQUESTED", entityType: "Assignment", entityId: id, metadata: { format: "excel", rows: gradebook.rows.length } });
    void trackProductEvent({ userId: user.id, eventType: "GRADE_EXPORT_REQUESTED", metadata: { assignmentId: id, format: "excel" } });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${gradebookExportFileBaseName(gradebook.assignmentTitle)}-notes.xlsx"`,
      },
    });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
