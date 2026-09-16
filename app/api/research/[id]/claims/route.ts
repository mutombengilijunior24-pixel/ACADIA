// ============================================================
// ACADIA — LISTE / CRÉATION DE CLAIMS (mission Bibliography &
// Reference Intelligence §21, préparatoire)
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { createClaim, listClaims } from "@/lib/server/research/ClaimService";
import { toReferenceErrorResponse } from "@/lib/server/research/referenceHttpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || undefined;
  const pageSize = Number(url.searchParams.get("pageSize")) || undefined;

  try {
    const result = await listClaims(user.id, id, { page, pageSize });
    return Response.json(result, { status: 200 });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}

const bodySchema = z.object({ text: z.string().min(1).max(2000), referenceId: z.string().min(1).nullable().optional() });

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Le champ text est requis." }, { status: 400 });
  }

  try {
    const claim = await createClaim(user.id, id, parsed.data.text, parsed.data.referenceId);
    return Response.json({ claim }, { status: 201 });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}
