// ============================================================
// ACADIA — VÉRIFICATEUR DE RÉFÉRENCES : EXISTENCE EN LIGNE
//
// Reçoit au plus 3 références (déjà découpées dans le navigateur), les
// cherche dans les bases bibliographiques ouvertes (Crossref, OpenAlex,
// HAL, Open Library, Google Books) et rend un statut par référence.
// Aucune IA, aucun document : seulement les métadonnées publiques de
// références publiées. Le navigateur envoie les lots les uns après les
// autres et affiche la progression.
// ============================================================

import { z } from "zod";

import { decideExistence, VERIFY_BATCH } from "@/lib/core/references";
import { lookupReference } from "@/lib/server/references/lookup";
import { referenceSchema, toParsedReference } from "@/lib/server/references/schema";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  convention: z.enum(["apa_fr", "apa_en"]),
  references: z.array(referenceSchema).min(1).max(VERIFY_BATCH),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!rateLimiter.check(rateLimitKey("references-verify", user.id), 150, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop de vérifications en peu de temps : réessayez dans quelques minutes." }, { status: 429 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  const { convention, references } = parsed.data;
  const results = await Promise.all(
    references.map(async (r, index) => {
      const ref = toParsedReference(r, index);
      return decideExistence(ref, await lookupReference(ref), convention);
    }),
  );
  return Response.json({ results }, { status: 200 });
}
