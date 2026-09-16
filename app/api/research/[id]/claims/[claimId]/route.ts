// ============================================================
// ACADIA — LIER/DÉLIER UN CLAIM À UNE RÉFÉRENCE (mission Bibliography
// & Reference Intelligence §21)
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { linkClaimToReference } from "@/lib/server/research/ClaimService";
import { toReferenceErrorResponse } from "@/lib/server/research/referenceHttpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; claimId: string }> };

const bodySchema = z.object({ referenceId: z.string().min(1).nullable() });

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, claimId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Le champ referenceId est requis (ou null pour délier)." }, { status: 400 });
  }

  try {
    const claim = await linkClaimToReference(user.id, id, claimId, parsed.data.referenceId);
    return Response.json({ claim }, { status: 200 });
  } catch (error) {
    return toReferenceErrorResponse(error);
  }
}
