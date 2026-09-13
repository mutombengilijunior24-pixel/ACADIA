// ============================================================
// ACADIA — MODEL ROUTER (mission Security + AI Cost Foundation)
//
// Point UNIQUE de décision "quel modèle pour quel appel" — ne
// remplace pas AI_MODEL (lib/ai/openai/config.ts), qui reste le
// modèle par défaut/de repli. Ce module choisit entre 3 niveaux de
// complexité configurables par variable d'environnement, pour ne
// jamais appeler le modèle le plus cher partout (mission §3).
//
// IMPORTANT — état actuel assumé : un seul modèle réel est
// aujourd'hui configuré dans cet environnement (AI_MODEL, "gpt-5.6").
// Tant que AI_MODEL_ECONOMY / AI_MODEL_STANDARD / AI_MODEL_ADVANCED
// ne sont pas définis dans l'environnement, les 3 niveaux résolvent
// au MÊME modèle (AI_MODEL) — l'architecture de routage est donc déjà
// active et centralisée, même si elle n'a pas encore d'effet
// observable en l'absence de plusieurs modèles réellement distincts
// et validés. Un changement futur se fait en un seul point (ici ou
// via l'environnement), jamais en éparpillant des choix de modèle
// dans chaque fichier lib/ai/openai/*.
// ============================================================

import { AI_MODEL } from "@/lib/ai/openai/config";
import type { AIOperation } from "@/lib/server/ai/AIUsageLedger";
import type { ResearchModeTag } from "@/lib/core/research/ResearchTypes";

export type AIComplexity = "ECONOMY" | "STANDARD" | "ADVANCED";

const MODEL_BY_COMPLEXITY: Record<AIComplexity, string> = {
  ECONOMY: process.env.AI_MODEL_ECONOMY || AI_MODEL,
  STANDARD: process.env.AI_MODEL_STANDARD || AI_MODEL,
  ADVANCED: process.env.AI_MODEL_ADVANCED || AI_MODEL,
};

// Tags de mode dont la présence justifie une escalade vers un modèle
// plus puissant pour les opérations d'analyse (A1/A2) — reflète la
// consigne "analyse financière/qualitative/mixte complexe → modèle
// plus puissant si nécessaire" (mission §3). Purement déclaratif :
// modifier cette liste ne demande de toucher aucun moteur A1/A2.
const COMPLEX_MODE_TAGS: ResearchModeTag[] = [
  "FINANCIAL_ANALYSIS",
  "QUALITATIVE",
  "MIXED_METHOD",
];

export interface ModelRoutingHints {
  /** Tags de mode déjà connus (ex. run de relance) — voir ResearchModeTag. */
  researchModeTags?: ResearchModeTag[];
  /** Force ECONOMY pour une sous-tâche de classification simple, quelle que soit l'opération. */
  simpleClassification?: boolean;
  /** Signale un besoin de raisonnement plus profond que la normale pour cette opération. */
  reasoningNeeded?: boolean;
}

// Complexité PAR DÉFAUT de chaque opération — reflète directement le
// principe de la mission : preview/classification simples → économique,
// analyse standard → intermédiaire, cas complexes → escalade via hints.
const DEFAULT_COMPLEXITY_BY_OPERATION: Record<AIOperation, AIComplexity> = {
  PREVIEW_ANALYSIS: "ECONOMY",
  DEEP_ANALYSIS: "STANDARD",
  VARIABLE_ANALYSIS: "STANDARD",
  METHODOLOGY: "STANDARD",
  QUESTIONNAIRE_GENERATION: "STANDARD",
  DOCUMENT_ANALYSIS: "STANDARD",
  INTERPRETATION: "STANDARD",
  CONCLUSION: "STANDARD",
  OTHER: "STANDARD",
};

// Opérations pour lesquelles researchModeTags peut légitimement
// déclencher une escalade (celles qui raisonnent réellement sur le
// contenu scientifique du sujet) — pas PREVIEW_ANALYSIS (volontairement
// gardée économique/rapide, voir PreviewNarrativeAI.ts).
const ESCALATABLE_OPERATIONS: AIOperation[] = [
  "DEEP_ANALYSIS",
  "VARIABLE_ANALYSIS",
  "INTERPRETATION",
];

export interface ModelRoutingDecision {
  model: string;
  complexity: AIComplexity;
  reason: string;
}

export function selectModel(
  operation: AIOperation,
  hints: ModelRoutingHints = {}
): ModelRoutingDecision {
  if (hints.simpleClassification) {
    return { model: MODEL_BY_COMPLEXITY.ECONOMY, complexity: "ECONOMY", reason: "Classification simple" };
  }

  let complexity = DEFAULT_COMPLEXITY_BY_OPERATION[operation] ?? "STANDARD";
  let reason = `Complexité par défaut de ${operation}`;

  if (ESCALATABLE_OPERATIONS.includes(operation)) {
    const tags = hints.researchModeTags ?? [];
    const hasComplexTag = tags.some((tag) => COMPLEX_MODE_TAGS.includes(tag));

    if (hasComplexTag) {
      complexity = "ADVANCED";
      reason = `Mode(s) de recherche complexe(s) détecté(s) (${tags.filter((t) => COMPLEX_MODE_TAGS.includes(t)).join(", ")})`;
    } else if (hints.reasoningNeeded) {
      complexity = complexity === "ECONOMY" ? "STANDARD" : complexity;
      reason = "Raisonnement approfondi signalé par l'appelant";
    }
  }

  return { model: MODEL_BY_COMPLEXITY[complexity], complexity, reason };
}
