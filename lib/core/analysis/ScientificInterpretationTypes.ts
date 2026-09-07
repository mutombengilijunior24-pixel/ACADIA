// ============================================================
// ACADIA — SCIENTIFIC INTERPRETATION TYPES (Mission 6, incrément 1)
//
// Incrément 1 : uniquement la décision d'hypothèse, dérivée de
// façon purement arithmétique des StatisticalResult déjà calculés
// (voir StatisticalTypes.ts) — jamais recalculée ici. Aucune prose
// générée par IA à ce stade : summary/findings/recommendations sont
// hors scope de cet incrément (voir incréments 2-4 de la mission).
// ============================================================

import type { ConfidenceLevel } from "@/lib/core/research/ResearchTypes";

export type HypothesisAssessmentDecision =
  | "SUPPORTED"
  | "NOT_SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "INCONCLUSIVE";

export interface HypothesisAssessment {
  hypothesisId: string;

  statement: string;

  decision: HypothesisAssessmentDecision;

  /** Identifiants des StatisticalResult ayant servi à cette décision — jamais une déduction sans preuve traçable. */
  basis: string[];

  confidence: ConfidenceLevel;

  /** Constats factuels courts justifiant la décision (ex. "p = 0,0321 < α = 0,05") — jamais une phrase interprétative. */
  rationale: string[];

  generatedAt: string;
}

export interface ScientificInterpretation {
  id: string;

  projectId: string;

  statisticalRunId: string;

  hypothesisAssessments: HypothesisAssessment[];

  createdAt: string;
}
