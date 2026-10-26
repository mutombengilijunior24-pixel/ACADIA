// ============================================================
// MNJ STAGE CONNECT — validation du pack et paiement (30 $).
// Passe par le moteur de paiement d'ACADIA : le dossier ne devient
// « payé » qu'après la confirmation authentifiée du fournisseur
// (webhook) ou d'un administrateur (paiement au bureau). idempotencyKey
// fournie par le client : un double clic ne crée jamais deux paiements.
// ============================================================

import { z } from "zod";

import { PAYMENT_METHODS } from "@/lib/core/stages/catalog";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { stageErrorResponse, startCheckout } from "@/lib/server/stages/StageService";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  method: z.enum(PAYMENT_METHODS.map((m) => m.id) as [string, ...string[]]),
  idempotencyKey: z.string().min(8).max(200),
});

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  if (!rateLimiter.check(rateLimitKey("stage-checkout", user.id), 10, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop de tentatives de paiement récentes : réessayez dans quelques minutes." }, { status: 429 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  try {
    return Response.json(await startCheckout(user.id, id, parsed.data), { status: 200 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
