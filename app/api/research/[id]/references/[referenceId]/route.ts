// ============================================================
// ACADIA — LECTURE / MODIFICATION / SUPPRESSION D'UNE RÉFÉRENCE
// (mission Bibliography & Reference Intelligence)
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getReference, updateReference, deleteReference } from "@/lib/server/research/ReferenceService";
import { toReferenceErrorResponse } from "@/lib/server/research/referenceHttpErrors";
import { REFERENCE_SOURCE_TYPES, REFERENCE_PROVENANCES, REFERENCE_VERIFICATION_STATUSES } from "@/lib/core/research/reference/ReferenceTypes";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; referenceId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, referenceId } = await context.params;
  try {
    const reference = await getReference(user.id, id, referenceId);
    return Response.json({ reference }, { status: 200 });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(1000).optional(),
  authors: z.array(z.string().min(1)).optional(),
  year: z.number().int().nullable().optional(),
  sourceType: z.enum(REFERENCE_SOURCE_TYPES).optional(),
  journal: z.string().max(500).nullable().optional(),
  publisher: z.string().max(500).nullable().optional(),
  volume: z.string().max(100).nullable().optional(),
  issue: z.string().max(100).nullable().optional(),
  pages: z.string().max(100).nullable().optional(),
  doi: z.string().max(300).nullable().optional(),
  isbn: z.string().max(100).nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  language: z.string().max(50).nullable().optional(),
  provenance: z.enum(REFERENCE_PROVENANCES).optional(),
  aiConfidence: z.number().min(0).max(1).nullable().optional(),
  verificationStatus: z.enum(REFERENCE_VERIFICATION_STATUSES).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, referenceId } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Requête invalide.", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const reference = await updateReference(user.id, id, referenceId, parsed.data);
    return Response.json({ reference }, { status: 200 });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, referenceId } = await context.params;
  try {
    await deleteReference(user.id, id, referenceId);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}
