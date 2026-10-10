/** Moteur de compréhension de la recherche — API publique (utilisable côté client et serveur). */
export * from "./types";
export { emptyInput, validateResearchInput, providedFields, FIELD_LABELS, ESSENTIAL_FIELDS, INPUT_LIMITS, type InputError, type InputValidation } from "./input";
export { buildUnderstandingReport, emptyDecisions, inputKey, setVariableDecision, resetVariableDecision, addVariable, setHypothesisDecision, setRelationDecision } from "./engine";
export { requestAiEnrichment, aiEnrichmentSchema, buildAiRequest, sanitizeError, UNDERSTANDING_AI_MODEL, type AiProvider, type AiEnrichment, type AiEnrichmentResult } from "./ai";
export { ROLE_LABELS, NATURE_LABELS, RELATION_LABELS, DATA_KIND_LABELS, CONFIDENCE_LABELS, DIAGNOSTIC_LABELS, elementLabel } from "./labels";
export { splitLines } from "./text";
