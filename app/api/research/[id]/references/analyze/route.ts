// ============================================================
// ACADIA — ANALYSE IA D'UN TEXTE POUR EXTRAIRE DES RÉFÉRENCES
// (mission Bibliography & Reference Intelligence §22/§23)
//
// N'écrit RIEN automatiquement : retourne des candidats
// (provenance="AI_PROPOSED", verificationStatus="AI_PROPOSED") que le
// chercheur doit explicitement créer via POST /references — jamais une
// insertion silencieuse d'une proposition IA en base.
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { requireOwnedProject } from "@/lib/server/research/ReferenceService";
import { toReferenceErrorResponse } from "@/lib/server/research/referenceHttpErrors";
import { extractReferencesFromText } from "@/lib/ai/openai/ReferenceAnalysisAI";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { classifyAIError, AI_USER_FACING_ERROR } from "@/lib/ai/openai/errorClassification";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ text: z.string().min(1).max(200_000) });

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const limit = rateLimiter.check(rateLimitKey("ai-reference-analysis", user.id), 15, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop d'analyses IA récentes. Réessayez plus tard." }, { status: 429 });
  }

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Le champ text est requis." }, { status: 400 });
  }

  try {
    await requireOwnedProject(user.id, id);
  } catch (error) {
    return toReferenceErrorResponse(error);
  }

  try {
    const result = await extractReferencesFromText(parsed.data.text, { userId: user.id, projectId: id });
    return Response.json(result, { status: 200 });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Erreur inconnue.";
    const classified = classifyAIError(rawMessage);
    console.error("[ACADIA] Erreur analyse IA de référence :", classified.message);
    return Response.json({ error: AI_USER_FACING_ERROR, code: classified.code }, { status: 502 });
  }
}
