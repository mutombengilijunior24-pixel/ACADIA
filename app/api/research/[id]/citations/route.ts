// ============================================================
// ACADIA — LISTE / CRÉATION DE CITATIONS (mission Bibliography &
// Reference Intelligence §17)
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { createCitation, listCitations } from "@/lib/server/research/CitationService";
import { toReferenceErrorResponse } from "@/lib/server/research/referenceHttpErrors";
import { CITATION_RESOLUTION_STATUSES } from "@/lib/core/research/reference/ReferenceTypes";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("resolutionStatus");
  const resolutionStatus = statusParam && (CITATION_RESOLUTION_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as (typeof CITATION_RESOLUTION_STATUSES)[number]) : undefined;
  const page = Number(url.searchParams.get("page")) || undefined;
  const pageSize = Number(url.searchParams.get("pageSize")) || undefined;

  try {
    const result = await listCitations(user.id, id, { resolutionStatus, page, pageSize });
    return Response.json(result, { status: 200 });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}

const bodySchema = z.object({
  rawText: z.string().min(1).max(500),
  citedAuthor: z.string().max(200).nullable().optional(),
  citedYear: z.number().int().nullable().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const citation = await createCitation(user.id, id, parsed.data);
    return Response.json({ citation }, { status: 201 });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}
