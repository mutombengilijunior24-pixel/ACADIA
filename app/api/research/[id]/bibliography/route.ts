// ============================================================
// ACADIA — GÉNÉRATION DE BIBLIOGRAPHIE FORMATÉE (mission Bibliography
// & Reference Intelligence §19/§24/§25)
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { listAllReferences } from "@/lib/server/research/ReferenceService";
import { toReferenceErrorResponse } from "@/lib/server/research/referenceHttpErrors";
import { buildFormattedBibliography } from "@/lib/server/research/BibliographyExport";
import { CITATION_STYLES, type CitationStyle } from "@/lib/core/research/reference/ReferenceTypes";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const url = new URL(request.url);
  const styleParam = url.searchParams.get("style");
  const style: CitationStyle = styleParam && (CITATION_STYLES as readonly string[]).includes(styleParam) ? (styleParam as CitationStyle) : "DEFAULT";

  try {
    const references = await listAllReferences(user.id, id);
    const bibliography = buildFormattedBibliography(references, style);
    void trackProductEvent({ userId: user.id, projectId: id, eventType: "BIBLIOGRAPHY_VIEWED", metadata: { style } });
    return Response.json({ bibliography }, { status: 200 });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}
