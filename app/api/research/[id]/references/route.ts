// ============================================================
// ACADIA — LISTE / CRÉATION DE RÉFÉRENCES (mission Bibliography &
// Reference Intelligence)
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { createReference, listReferences } from "@/lib/server/research/ReferenceService";
import { toReferenceErrorResponse } from "@/lib/server/research/referenceHttpErrors";
import { REFERENCE_SOURCE_TYPES, REFERENCE_PROVENANCES, REFERENCE_VERIFICATION_STATUSES } from "@/lib/core/research/reference/ReferenceTypes";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? undefined;
  const sourceTypeParam = url.searchParams.get("sourceType");
  const verificationStatusParam = url.searchParams.get("verificationStatus");
  const sourceType = sourceTypeParam && (REFERENCE_SOURCE_TYPES as readonly string[]).includes(sourceTypeParam) ? (sourceTypeParam as (typeof REFERENCE_SOURCE_TYPES)[number]) : undefined;
  const verificationStatus =
    verificationStatusParam && (REFERENCE_VERIFICATION_STATUSES as readonly string[]).includes(verificationStatusParam)
      ? (verificationStatusParam as (typeof REFERENCE_VERIFICATION_STATUSES)[number])
      : undefined;
  const page = Number(url.searchParams.get("page")) || undefined;
  const pageSize = Number(url.searchParams.get("pageSize")) || undefined;

  try {
    const result = await listReferences(user.id, id, { search, sourceType, verificationStatus, page, pageSize });
    void trackProductEvent({ userId: user.id, projectId: id, eventType: "BIBLIOGRAPHY_VIEWED" });
    return Response.json(result, { status: 200 });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}

const bodySchema = z.object({
  title: z.string().min(1).max(1000),
  authors: z.array(z.string().min(1)).default([]),
  year: z.number().int().nullable().optional(),
  sourceType: z.enum(REFERENCE_SOURCE_TYPES),
  journal: z.string().max(500).nullable().optional(),
  publisher: z.string().max(500).nullable().optional(),
  volume: z.string().max(100).nullable().optional(),
  issue: z.string().max(100).nullable().optional(),
  pages: z.string().max(100).nullable().optional(),
  doi: z.string().max(300).nullable().optional(),
  isbn: z.string().max(100).nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  language: z.string().max(50).nullable().optional(),
  provenance: z.enum(REFERENCE_PROVENANCES).default("USER_ENTERED"),
  aiConfidence: z.number().min(0).max(1).nullable().optional(),
  rawImportData: z.string().nullable().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Requête invalide.", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await createReference(user.id, id, parsed.data);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}
