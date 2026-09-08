import { NextResponse } from "next/server";

import type { ResearchData } from "@/types/Research";

import {
  analyzeResearch,
} from "@/lib/core/research/ResearchIntelligenceEngine";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";


// ============================================================
// CONTRAT D'ERREUR
//
// { success: false, error: { code, message } }
//
// Les erreurs internes (OpenAI, parsing) ne sont jamais
// renvoyées brutes : elles sont classées dans un code stable
// et assainies (aucun fragment de clé API ne doit fuiter).
// ============================================================

type AIErrorCode =
  | "AI_VALIDATION_ERROR"
  | "AI_CONFIGURATION_ERROR"
  | "AI_PROVIDER_ERROR"
  | "AI_INVALID_RESPONSE"
  | "AI_UNKNOWN_ERROR";

function sanitizeMessage(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_-]{6,}/g, "[REDACTED]");
}

function classifyError(rawMessage: string): {
  code: AIErrorCode;
  message: string;
} {
  const message = sanitizeMessage(rawMessage);
  const lower = message.toLowerCase();

  if (lower.includes("obligatoire")) {
    return { code: "AI_VALIDATION_ERROR", message };
  }

  if (
    lower.includes("openai_api_key") ||
    lower.includes("credentials") ||
    lower.includes("clé") ||
    lower.includes("401")
  ) {
    return { code: "AI_CONFIGURATION_ERROR", message };
  }

  if (
    lower.includes("json valide") ||
    lower.includes("contrat") ||
    lower.includes("ne respecte pas")
  ) {
    return { code: "AI_INVALID_RESPONSE", message };
  }

  if (
    lower.includes("aucun résultat") ||
    lower.includes("openai")
  ) {
    return { code: "AI_PROVIDER_ERROR", message };
  }

  return { code: "AI_UNKNOWN_ERROR", message };
}

function errorResponse(rawMessage: string, status: number) {
  const error = classifyError(rawMessage);

  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}


export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const limit = rateLimiter.check(rateLimitKey("ai-research-intelligence", user.id), 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return errorResponse("Trop de requêtes IA récentes. Réessayez plus tard.", 429);
  }

  let research: ResearchData;

  try {
    research = (await request.json()) as ResearchData;
  } catch {
    return errorResponse(
      "Le corps de la requête n'est pas un JSON valide.",
      400
    );
  }

  if (!research || !research.title?.trim()) {
    return errorResponse(
      "Le sujet de recherche est obligatoire.",
      400
    );
  }

  // A1 et A2 s'exécutent dans le même appel (analyzeResearch()
  // orchestre les deux séquentiellement, réponse unique) — il n'existe
  // aujourd'hui aucun moment intermédiaire visible côté client entre
  // les deux. Les tracker comme démarrant/se terminant ensemble reflète
  // fidèlement le parcours réel actuel, ce n'est jamais un événement
  // inventé (voir mission §2).
  await trackProductEvent({ userId: user.id, eventType: "A1_STARTED" });
  await trackProductEvent({ userId: user.id, eventType: "A2_STARTED" });

  try {
    const result = await analyzeResearch(research);

    // ==========================================================
    // L'ANALYSE A ÉCHOUÉ CÔTÉ MOTEUR (A1/A2/OpenAI)
    //
    // analyzeResearch() ne rejette jamais : en cas d'échec il
    // renvoie status: "failed" avec un projet de secours vide.
    // On ne doit JAMAIS transformer cela en succès HTTP.
    // ==========================================================

    if (result.status === "failed") {
      const message =
        result.warnings[0] ??
        "L'analyse IA a échoué.";

      return errorResponse(message, 502);
    }

    // status "ready" ou "needs_review" : succès exploitable.
    await trackProductEvent({ userId: user.id, eventType: "A1_COMPLETED", projectId: result.project?.id });
    await trackProductEvent({ userId: user.id, eventType: "A2_COMPLETED", projectId: result.project?.id });
    await trackProductEvent({
      userId: user.id,
      eventType: "VARIABLES_GENERATED",
      projectId: result.project?.id,
      metadata: { count: result.project?.variables?.length ?? 0 },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {

    const rawMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue pendant l'analyse.";

    console.error(
      "ACADIA — RESEARCH INTELLIGENCE API ERROR:",
      sanitizeMessage(rawMessage)
    );

    return errorResponse(rawMessage, 500);
  }
}
