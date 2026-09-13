// ============================================================
// ACADIA — CONTEXTE RÉEL DU PHÉNOMÈNE (Bloc B, aperçu, 11/09/2026)
//
// Second appel, déclenché par le client une fois l'aperçu principal
// déjà affiché (affichage différé — décision produit) : ne bloque
// jamais l'aperçu principal (~26-27s), dont la latence reste
// inchangée. Sans session, comme /api/preview — même logique de
// rate-limit par IP.
// ============================================================

import { z } from "zod";
import { searchPhenomenonContext } from "@/lib/ai/openai/PhenomenonContextAI";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { getOrCreateAnonymousSessionId } from "@/lib/server/security/AnonymousSession";

export const runtime = "nodejs";

const bodySchema = z.object({
  phenomenon: z.string().trim().min(4).max(600),
  domain: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  // Signal d'identité anonyme (voir AnonymousSession.ts) plutôt que
  // l'IP brute — même raisonnement que /api/preview : une IP de
  // campus ne doit jamais borner ce quota à la place d'un visiteur.
  const { id: anonymousSessionId } = await getOrCreateAnonymousSessionId();
  const limit = rateLimiter.check(rateLimitKey("subject-preview-context", anonymousSessionId), 15, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de tentatives depuis cette connexion." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ context: null }, { status: 200 });
  }

  try {
    const items = await searchPhenomenonContext(parsed.data, { anonymousSessionId });
    return Response.json({ context: items ? { items } : null }, { status: 200 });
  } catch (error) {
    console.error("[ACADIA] Erreur contexte du phénomène :", error);
    // Best-effort : l'aperçu principal reste complet et utile sans
    // cette section — jamais une erreur bloquante pour l'utilisateur.
    return Response.json({ context: null }, { status: 200 });
  }
}
