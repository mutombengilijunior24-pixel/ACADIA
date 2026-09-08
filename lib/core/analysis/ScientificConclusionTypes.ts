// ============================================================
// ACADIA — SCIENTIFIC CONCLUSION TYPES (Mission 7, bloc 1)
//
// Couche supérieure à Mission 6 : Mission 6 répond à "comment
// interpréter les résultats ?", Mission 7 répond à "que peut-on
// scientifiquement conclure au regard des hypothèses, des objectifs
// et de la question de recherche ?". Ne recalcule AUCUNE statistique
// et ne redécide JAMAIS une HypothesisAssessment (Mission 6) — cette
// couche ne fait que composer et mettre en perspective des décisions
// déjà tranchées.
//
// La prose ci-dessous (HypothesisConclusion.conclusion,
// ObjectiveConclusion.conclusion, etc.) est 100% déterministe/
// template dans ce bloc — la formulation IA (bloc 2) vient
// uniquement reformuler ce texte en langage académique, jamais le
// décider (voir ScientificConclusionAI.ts).
// ============================================================

import type { HypothesisAssessmentDecision } from "./ScientificInterpretationTypes";
import type { ConfidenceLevel } from "@/lib/core/research/ResearchTypes";

export type ObjectiveCoverageStatus = "FULL" | "PARTIAL" | "NONE";

export interface ObjectiveCoverage {
  objectiveId: string;

  status: ObjectiveCoverageStatus;

  /** Nombre d'indicateurs réellement reliés à cet objectif — jamais un pourcentage inventé. */
  linkedIndicatorCount: number;

  linkedHypothesisIds: string[];

  /** Sous-ensemble de linkedHypothesisIds ayant reçu une HypothesisAssessment fondée sur au moins un résultat (basis non vide). */
  evaluatedHypothesisIds: string[];

  /** Justification factuelle de `status` — jamais un score arbitraire. */
  reason: string;
}

export interface HypothesisConclusion {
  hypothesisId: string;

  /** Copié tel quel depuis HypothesisAssessment (Mission 6) — jamais recalculé ni réévalué ici. */
  decision: HypothesisAssessmentDecision;

  /** Prose déterministe (template) — voir HypothesisConclusionEngine.ts. */
  conclusion: string;

  confidence: ConfidenceLevel;

  /** Ce que ce résultat ne permet PAS d'affirmer (ex. corrélation ≠ causalité) — jamais vide si la méthode le justifie. */
  limitations: string[];

  sourceResultIds: string[];

  sourceAnalysisRunId: string;
}

export interface ObjectiveConclusion {
  objectiveId: string;

  coverage: ObjectiveCoverage;

  /** Prose déterministe (template) — voir ObjectiveConclusionEngine.ts. */
  conclusion: string;

  hypothesisIds: string[];

  generatedAt: string;
}

export interface ResearchQuestionConclusion {
  /** Absent si aucune question de recherche n'est marquée type="main" dans le projet — jamais une question inventée. */
  researchQuestionId?: string;

  /** Texte exact de la question de recherche principale. */
  statement: string;

  /** Prose déterministe (template) — voir ResearchQuestionConclusionEngine.ts. */
  conclusion: string;

  objectiveIds: string[];

  generatedAt: string;
}

export interface ScientificConclusion {
  id: string;

  projectId: string;

  statisticalRunId: string;

  /** Lien optionnel vers la ScientificInterpretation (Mission 6) utilisée, si le chercheur en a fourni une — purement traçabilité, jamais une dépendance obligatoire. */
  interpretationId?: string;

  hypothesisConclusions: HypothesisConclusion[];

  objectiveConclusions: ObjectiveConclusion[];

  /** Absent si aucune question de recherche principale n'est enregistrée pour ce projet. */
  researchQuestionConclusion?: ResearchQuestionConclusion;

  /** Synthèse déterministe (bloc 1) — jamais d'information nouvelle, uniquement une composition de ce qui précède. */
  generalConclusion: string;

  limitations: string[];

  warnings: string[];

  /** Horodatages capturés à la génération — jamais recalculés après coup (voir isInterpretationOutdated, réutilisé tel quel). */
  datasetUpdatedAt: string;

  analysisPlanUpdatedAt: string;

  createdAt: string;
}
