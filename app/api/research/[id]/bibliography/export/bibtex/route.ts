// ============================================================
// ACADIA — EXPORT BIBTEX (mission Bibliography & Reference
// Intelligence §34)
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { listAllReferences } from "@/lib/server/research/ReferenceService";
import { toReferenceErrorResponse } from "@/lib/server/research/referenceHttpErrors";
import { buildBibtex, exportFileBaseName } from "@/lib/server/research/BibliographyExport";
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
    const bibtex = buildBibtex(references);

    await logAudit({ actorId: user.id, action: "BIBLIOGRAPHY_EXPORTED", entityType: "ResearchProject", entityId: id, metadata: { format: "bibtex", count: references.length } });
    await trackProductEvent({ userId: user.id, projectId: id, eventType: "BIBLIOGRAPHY_EXPORTED", metadata: { format: "bibtex" } });

    return new Response(bibtex, {
      status: 200,
      headers: {
        "Content-Type": "application/x-bibtex; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileBaseName(project?.title ?? "bibliographie")}.bib"`,
      },
    });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}
