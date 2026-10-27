// ============================================================
// MNJ STAGE CONNECT — déclaration d'un paiement Mobile Money :
// l'étudiant indique le numéro de MNJ crédité, son numéro d'envoi et
// le numéro de transaction du SMS. Le dossier passe « à vérifier » ;
// seul un administrateur peut ensuite le confirmer. Montant calculé par
// le serveur à partir des options, jamais reçu du navigateur.
// ============================================================

import { declarationSchema } from "@/lib/core/stages/momo";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { declarePayment, stageErrorResponse } from "@/lib/server/stages/StageService";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!rateLimiter.check(rateLimitKey("stage-declare", user.id), 10, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop de tentatives : réessayez dans quelques minutes." }, { status: 429 });
  const { id } = await context.params;
  const parsed = declarationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Déclaration incomplète." }, { status: 400 });
  try {
    return Response.json({ application: await declarePayment(user.id, id, parsed.data) }, { status: 200 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
