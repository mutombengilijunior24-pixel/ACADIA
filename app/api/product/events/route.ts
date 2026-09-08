// ============================================================
// ACADIA — ÉVÉNEMENTS PRODUIT DÉCLENCHÉS CÔTÉ CLIENT (Bloc 2, 08/09/2026)
//
// Réservée aux moments qui n'ont PAS déjà un aller-retour serveur
// naturel à réutiliser (la plupart des événements de parcours sont
// journalisés directement dans leur route existante — voir
// lib/server/analytics/ProductEvents.ts). N'accepte qu'un eventType
// de la liste contrôlée PRODUCT_EVENT_TYPES — jamais une valeur libre
// envoyée par le client. userId dérivé de la session serveur, jamais
// du corps de la requête. Les événements PUBLIC_* restent accessibles
// sans authentification (répondant anonyme) ; tout le reste exige une
// session.
// ============================================================

import { z } from "zod";
import { getSessionUser } from "@/lib/supervision/apiAuth";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { trackProductEvent, PRODUCT_EVENT_TYPES, PUBLIC_PRODUCT_EVENT_TYPES, type ProductEventType } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

const bodySchema = z.object({
  eventType: z.enum(PRODUCT_EVENT_TYPES as unknown as [ProductEventType, ...ProductEventType[]]),
  projectId: z.string().max(120).optional(),
  metadata: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const limit = rateLimiter.check(rateLimitKey("product-events", ip), 60, 60 * 1000);
  if (!limit.allowed) {
    // Le tracking ne doit jamais bloquer le parcours utilisateur — un
    // 204 silencieux plutôt qu'une erreur visible côté client.
    return new Response(null, { status: 204 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response(null, { status: 204 });
  }

  const user = await getSessionUser();

  if (!user && !PUBLIC_PRODUCT_EVENT_TYPES.includes(parsed.data.eventType)) {
    // Événement réservé aux utilisateurs connectés, appelé sans
    // session — ignoré silencieusement (jamais un blocage visible pour
    // un mécanisme secondaire).
    return new Response(null, { status: 204 });
  }

  await trackProductEvent({
    userId: user?.id,
    projectId: parsed.data.projectId,
    eventType: parsed.data.eventType,
    metadata: parsed.data.metadata,
  });

  return new Response(null, { status: 204 });
}
