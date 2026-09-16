// ============================================================
// ACADIA — APPEL OPENAI INSTRUMENTÉ (mission Security + AI Cost Foundation)
//
// Point de passage UNIQUE pour tout appel à openai.responses.create
// dans ce projet. Chaque moteur IA (SubjectUnderstandingAI,
// VariableIntelligenceAI, PreviewNarrativeAI, ...) remplace son appel
// direct par createTrackedResponse(params, tracking) — même
// signature de retour, même comportement d'erreur (l'exception
// d'origine est toujours relancée telle quelle, jamais avalée ici),
// donc AUCUN changement de logique métier dans les moteurs appelants.
//
// Écrit une ligne AIUsageLedger par appel (succès ou échec), jamais
// bloquant : si l'écriture du ledger échoue, l'appel IA lui-même
// n'est jamais affecté (voir recordAIUsage, qui avale déjà ses
// propres erreurs).
// ============================================================

import { randomUUID } from "node:crypto";
import type {
  ResponseCreateParamsNonStreaming,
  Response as OpenAIResponseObject,
} from "openai/resources/responses/responses";
import { openai } from "./client";
import { recordAIUsage, type AIOperation } from "@/lib/server/ai/AIUsageLedger";
import { estimateCostUsd } from "@/lib/server/ai/ModelPricing";

export interface AITrackingContext {
  operation: AIOperation;
  userId?: string | null;
  projectId?: string | null;
  anonymousSessionId?: string | null;
  correlationId?: string | null;
}

/**
 * Sous-ensemble minimal des options de requête du SDK OpenAI utile ici
 * (timeout/annulation) — le type complet `RequestOptions` du SDK vit
 * sous un sous-chemin non exporté publiquement par le package
 * (`openai/internal/*`, absent de son `package.json#exports`), donc non
 * importable proprement ; cette interface locale suffit et reste
 * structurellement compatible avec ce que `openai.responses.create`
 * accepte en second argument.
 */
export interface TrackedRequestOptions {
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * `requestOptions` (mission AI Grading Engine §34) — optionnel, transmis
 * tel quel au SDK OpenAI (ex. `{ timeout: 60000 }`). Absent par défaut :
 * AUCUN changement de comportement pour les appelants existants (A1/A2/
 * etc.), qui n'en avaient jamais besoin jusqu'ici. Ajouté ici plutôt que
 * dans un second wrapper — ce fichier reste le seul point de passage
 * vers `openai.responses.create`.
 */
export async function createTrackedResponse(
  params: ResponseCreateParamsNonStreaming,
  tracking: AITrackingContext,
  requestOptions?: TrackedRequestOptions
): Promise<OpenAIResponseObject> {
  const start = Date.now();

  try {
    const response = await openai.responses.create(params, requestOptions);
    const latencyMs = Date.now() - start;

    const inputTokens = response.usage?.input_tokens ?? null;
    const cachedInputTokens = response.usage?.input_tokens_details?.cached_tokens ?? null;
    const outputTokens = response.usage?.output_tokens ?? null;

    void recordAIUsage({
      userId: tracking.userId,
      projectId: tracking.projectId,
      anonymousSessionId: tracking.anonymousSessionId,
      operation: tracking.operation,
      model: response.model || String(params.model),
      inputTokens,
      cachedInputTokens,
      outputTokens,
      estimatedCostUsd: estimateCostUsd(response.model || String(params.model), {
        inputTokens,
        cachedInputTokens,
        outputTokens,
      }),
      latencyMs,
      success: true,
      requestId: response.id,
      correlationId: tracking.correlationId ?? randomUUID(),
    });

    return response;
  } catch (error) {
    const latencyMs = Date.now() - start;

    void recordAIUsage({
      userId: tracking.userId,
      projectId: tracking.projectId,
      anonymousSessionId: tracking.anonymousSessionId,
      operation: tracking.operation,
      model: String(params.model),
      latencyMs,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Erreur inconnue",
      correlationId: tracking.correlationId ?? randomUUID(),
    });

    // Toujours relancer telle quelle : les moteurs appelants gèrent
    // déjà leurs propres messages d'erreur utilisateur (voir chaque
    // catch existant dans lib/ai/openai/*).
    throw error;
  }
}
