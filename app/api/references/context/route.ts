// ============================================================
// ACADIA — VÉRIFICATEUR DE RÉFÉRENCES : CONTRÔLE DU CONTEXTE
//
// À la demande, pour UNE citation : la référence est retrouvée dans les
// bases (cache partagé), et seul le résumé RÉEL de la base est donné à
// l'IA avec la phrase de l'étudiant. Le résumé ne vient jamais du
// navigateur. Sans résumé, aucun appel IA : « impossible à juger ».
// ============================================================

import { z } from "zod";

import { checkCitationContext } from "@/lib/ai/openai/ReferenceContextAI";
import { decideExistence, NO_ABSTRACT, validateContextAnswer } from "@/lib/core/references";
import { lookupReference } from "@/lib/server/references/lookup";
import { referenceSchema, toParsedReference } from "@/lib/server/references/schema";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ sentence: z.string().trim().min(10).max(1500), reference: referenceSchema });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!rateLimiter.check(rateLimitKey("references-context", user.id), 60, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop de contrôles en peu de temps : réessayez dans quelques minutes." }, { status: 429 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  const ref = toParsedReference(parsed.data.reference);

  const verdict = decideExistence(ref, await lookupReference(ref), "apa_fr");
  if (!verdict.match) return Response.json({ error: "Le contexte ne peut être contrôlé que pour une référence retrouvée dans les bases bibliographiques." }, { status: 409 });
  const abstract = verdict.match.abstract;
  if (!abstract || abstract.length < 80) return Response.json({ context: NO_ABSTRACT, source: verdict.match.source }, { status: 200 });

  try {
    const answer = await checkCitationContext({ sentence: parsed.data.sentence, title: verdict.match.title, authors: verdict.match.authors.map((a) => a.family).join(", ") || "Auteur inconnu", year: verdict.match.year, abstract }, { userId: user.id });
    return Response.json({ context: validateContextAnswer(answer, abstract), source: verdict.match.source, abstract }, { status: 200 });
  } catch {
    return Response.json({ error: "Le service d'analyse est momentanément indisponible : réessayez plus tard." }, { status: 502 });
  }
}
