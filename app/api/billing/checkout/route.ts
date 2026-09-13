// ============================================================
// ACADIA — CHECKOUT D'UN ENTITLEMENT (mission Conversion + Pay-as-you-progress)
//
// Toujours le même flux CHECKOUT → PAIEMENT → ENTITLEMENT (voir
// EntitlementService.checkout), bêta ou non. idempotencyKey fourni
// par le client (ex. un id généré une seule fois par ouverture du
// panneau de déblocage) — un double clic renvoie la MÊME transaction,
// jamais deux paiements distincts (mission §7, "double paiement").
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord } from "@/lib/server/research/ResearchStateService";
import { checkout } from "@/lib/server/billing/EntitlementService";
import { ENTITLEMENT_KEYS } from "@/lib/server/billing/PricingConfig";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";

export const runtime = "nodejs";

const bodySchema = z.object({
  projectId: z.string().min(1),
  entitlementKey: z.enum(ENTITLEMENT_KEYS),
  idempotencyKey: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Anti-rafale : un chercheur ne débloque pas 20 étapes à la seconde
  // — protège surtout contre un bouton "Débloquer" cassé en boucle.
  const limit = rateLimiter.check(rateLimitKey("billing-checkout", user.id), 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de tentatives de déblocage récentes. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const { projectId, entitlementKey, idempotencyKey } = parsed.data;

  const record = await getResearchProjectRecord(projectId);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: projectId });
  }

  try {
    const result = await checkout({ userId: user.id, projectId, key: entitlementKey, idempotencyKey });
    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error("[ACADIA] Erreur checkout :", error);
    return Response.json(
      { error: "Le déblocage n'a pas pu être finalisé pour le moment. Réessayez dans un instant." },
      { status: 502 }
    );
  }
}
