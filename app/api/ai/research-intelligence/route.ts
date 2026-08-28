import { NextResponse } from "next/server";

import type { ResearchData } from "@/types/Research";

import {
  analyzeResearch,
} from "@/lib/core/research/ResearchIntelligenceEngine";


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
