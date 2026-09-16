// ============================================================
// ACADIA — EXPORT CSV DES RÉFÉRENCES (mission Bibliography & Reference
// Intelligence §34)
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { listAllReferences } from "@/lib/server/research/ReferenceService";
import { toReferenceErrorResponse } from "@/lib/server/research/referenceHttpErrors";
import { buildReferencesCsv, exportFileBaseName } from "@/lib/server/research/BibliographyExport";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import { prisma } from "@/lib/server/db/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  try {
    const references = await listAllReferences(user.id, id);
    const project = await prisma.researchProject.findUnique({ where: { id }, select: { title: true } });
    const csv = buildReferencesCsv(references);

    await logAudit({ actorId: user.id, action: "BIBLIOGRAPHY_EXPORTED", entityType: "ResearchProject", entityId: id, metadata: { format: "csv", count: references.length } });
    await trackProductEvent({ userId: user.id, projectId: id, eventType: "BIBLIOGRAPHY_EXPORTED", metadata: { format: "csv" } });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileBaseName(project?.title ?? "bibliographie")}-references.csv"`,
      },
    });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}
