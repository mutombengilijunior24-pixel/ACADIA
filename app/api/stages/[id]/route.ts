// ============================================================
// MNJ STAGE CONNECT — un dossier : lecture (avec l'état du paiement
// rafraîchi) et annulation par l'étudiant (tant qu'il n'est pas réglé).
// ============================================================

import { z } from "zod";

import { cancelMine, getMine, stageErrorResponse } from "@/lib/server/stages/StageService";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  try {
    return Response.json({ application: await getMine(user.id, id) }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return stageErrorResponse(error);
  }
}

const patchSchema = z.object({ action: z.literal("cancel") });

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  if (!patchSchema.safeParse(await request.json().catch(() => null)).success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  try {
    return Response.json({ application: await cancelMine(user.id, id) }, { status: 200 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
