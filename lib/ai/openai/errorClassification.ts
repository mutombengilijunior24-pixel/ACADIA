// ============================================================
// ACADIA — CLASSIFICATION DES ERREURS IA (partagée A1/A2 + Survey)
//
// Extrait du contrat d'erreur déjà utilisé par
// app/api/ai/research-intelligence/route.ts — centralisé ici pour
// être réutilisé par le moteur Survey sans dupliquer la logique.
// Les erreurs internes (OpenAI, parsing) ne sont jamais renvoyées
// brutes : classées dans un code stable, assainies (aucun fragment
// de clé API ne doit fuiter dans une réponse ou un log).
// ============================================================

export type AIErrorCode = "AI_VALIDATION_ERROR" | "AI_CONFIGURATION_ERROR" | "AI_PROVIDER_ERROR" | "AI_INVALID_RESPONSE" | "AI_UNKNOWN_ERROR";

export function sanitizeMessage(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_-]{6,}/g, "[REDACTED]");
}

export function classifyAIError(rawMessage: string): { code: AIErrorCode; message: string } {
  const message = sanitizeMessage(rawMessage);
  const lower = message.toLowerCase();

  if (lower.includes("obligatoire") || lower.includes("requis")) {
    return { code: "AI_VALIDATION_ERROR", message };
  }
  if (lower.includes("openai_api_key") || lower.includes("credentials") || lower.includes("clé") || lower.includes("401")) {
    return { code: "AI_CONFIGURATION_ERROR", message };
  }
  if (lower.includes("json valide") || lower.includes("contrat") || lower.includes("ne respecte pas")) {
    return { code: "AI_INVALID_RESPONSE", message };
  }
  if (lower.includes("aucun résultat") || lower.includes("openai")) {
    return { code: "AI_PROVIDER_ERROR", message };
  }
  return { code: "AI_UNKNOWN_ERROR", message };
}

/** Message affiché au chercheur — toujours le même texte simple, jamais un détail technique interne. */
export const AI_USER_FACING_ERROR = "ACADIA n'a pas pu terminer la génération. Veuillez réessayer.";
