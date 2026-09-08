// ============================================================
// ACADIA — SCIENTIFIC INTERPRETATION TYPES (Mission 6)
//
// Incrément 1 : décision d'hypothèse, dérivée de façon purement
// arithmétique des StatisticalResult déjà calculés (voir
// StatisticalTypes.ts) — jamais recalculée ici.
//
// Incrément 2 : prose IA (summary/findings/recommendations/
// limitations) — voir ScientificInterpretationContent ci-dessous.
// L'IA ne reçoit jamais le dataset brut ni les HypothesisAssessment
// eux-mêmes comme une vérité à confirmer : elle formule à partir des
// résultats agrégés déjà calculés et des décisions déjà tranchées
// (rules-first, AI-second — jamais l'inverse). `relatedResultIds`/
// `relatedHypothesisId` sont systématiquement filtrés côté serveur
// après réception (voir ScientificInterpretationAI.ts) pour ne
// jamais persister une référence à un résultat/une hypothèse
// inexistante — un contrôle de traçabilité basique, pas encore le
// NumericConsistencyGuard complet prévu à l'incrément 3.
// ============================================================

import type { ConfidenceLevel } from "@/lib/core/research/ResearchTypes";
import type { ValidationStatus } from "./ScientificDiscussionTypes";

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

export type ScientificFindingCategory =
  | "descriptive"
  | "hypothesis"
  | "sample_quality"
  | "methodological_limitation";

export interface ScientificFinding {
  id: string;

  category: ScientificFindingCategory;

  /** Constat rédigé par l'IA — jamais un chiffre non vérifiable dans `results`/`hypotheses` du contexte transmis. */
  statement: string;

  /** StatisticalResult.id sur lesquels ce constat s'appuie — vide si non applicable (ex. limite méthodologique générale). */
  relatedResultIds: string[];

  relatedHypothesisId?: string;
}

export interface ScientificInterpretationContent {
  summary: string;

  findings: ScientificFinding[];

  recommendations: string[];

  /** Ce que les résultats ne permettent PAS d'affirmer (taille d'échantillon, absence de causalité établie, etc.). */
  limitations: string[];

  validationStatus: ValidationStatus;

  generatedAt: string;
}

export interface ScientificInterpretation {
  id: string;

  projectId: string;

  statisticalRunId: string;

  hypothesisAssessments: HypothesisAssessment[];

  /** Absent tant que l'incrément 2 (formulation IA) n'a pas encore été exécuté pour cette interprétation. */
  content?: ScientificInterpretationContent;

  createdAt: string;
}
