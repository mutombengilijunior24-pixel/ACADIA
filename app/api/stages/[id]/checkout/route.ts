// ============================================================
// MNJ STAGE CONNECT — choix de l'accompagnement et paiement :
// recommandation 17 $, assurance 10 $, les deux 27 $ (montant calculé par le serveur).
// Passe par le moteur de paiement d'ACADIA : le dossier ne devient
// « payé » qu'après la confirmation authentifiée du fournisseur
// (webhook) ou d'un administrateur (paiement au bureau). idempotencyKey
// fournie par le client : un double clic ne crée jamais deux paiements.
// ============================================================

import { z } from "zod";

import { PAYMENT_METHODS, STAGE_OPTION_IDS, type StageOptionId } from "@/lib/core/stages/catalog";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { stageErrorResponse, startCheckout } from "@/lib/server/stages/StageService";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  method: z.enum(PAYMENT_METHODS.map((m) => m.id) as [string, ...string[]]),
  idempotencyKey: z.string().min(8).max(200),
  options: z.array(z.enum(STAGE_OPTION_IDS as [string, ...string[]])).min(1, "Choisissez au moins une option.").max(STAGE_OPTION_IDS.length),
});

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  if (!rateLimiter.check(rateLimitKey("stage-checkout", user.id), 10, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop de tentatives de paiement récentes : réessayez dans quelques minutes." }, { status: 429 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  try {
    return Response.json(await startCheckout(user.id, id, { ...parsed.data, options: parsed.data.options as StageOptionId[] }), { status: 200 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
