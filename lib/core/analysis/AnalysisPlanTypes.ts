// ============================================================
// ACADIA — ANALYSIS PLAN TYPES (Module 4, incrément 1)
//
// Ce module décide QUOI analyser, jamais COMMENT le calculer — les
// moteurs de calcul existent déjà (StatisticsMath.ts,
// BivariateStatistics.ts/BivariateAnalysisEngine.ts,
// EconometricModelEngine.ts) et ne sont pas dupliqués ici. Un
// AnalysisItem référence toujours les mêmes identifiants déjà
// établis par les modules précédents (variableId/hypothesisId/...),
// jamais une nouvelle représentation parallèle des mêmes concepts.
//
// AnalysisPlan ne contient AUCUN résultat statistique calculé —
// seulement des propositions à valider. L'exécution réelle
// (Module 5) reste une étape distincte et volontaire.
// ============================================================

export type AnalysisItemType =
  | "DESCRIPTIVE"
  | "CROSS_TABULATION"
  | "CHI_SQUARE"
  | "CORRELATION"
  | "GROUP_COMPARISON"
  | "REGRESSION"
  | "OPEN_TEXT_SUMMARY";

/** Ce que le futur Statistical Engine pourra réellement produire pour cet item — jamais calculé ici. */
export type PlannedStatistic =
  | "frequency"
  | "percentage"
  | "valid_percentage"
  | "cumulative_percentage"
  | "mean"
  | "median"
  | "mode"
  | "min"
  | "max"
  | "variance"
  | "standard_deviation"
  | "quartiles";

export type AnalysisAvailability = "available" | "future";

export type AnalysisPriority = "essential" | "recommended" | "optional" | "not_recommended";

export type AnalysisItemStatus = "proposed" | "accepted" | "modified" | "rejected";

export type PrerequisiteStatus = "pass" | "warning" | "fail" | "unknown";

export interface AnalysisPrerequisite {
  label: string;
  status: PrerequisiteStatus;
  detail?: string;
}

export interface AnalysisItem {
  id: string;

  analysisType: AnalysisItemType;

  availability: AnalysisAvailability;

  /* --------------------------------------------------------
     TRAÇABILITÉ — jamais une nouvelle relation inventée, toujours
     les mêmes ID déjà établis par les modules précédents.
  -------------------------------------------------------- */

  objectiveId?: string;

  hypothesisId?: string;

  variableIds: string[];

  columnIds: string[];

  plannedStatistics?: PlannedStatistic[];

  rationale: string;

  prerequisites: AnalysisPrerequisite[];

  priority: AnalysisPriority;

  status: AnalysisItemStatus;

  /** Renseigné uniquement lorsque le chercheur modifie manuellement une proposition. */
  userNote?: string;
}

export type AnalysisPlanStatus = "draft" | "proposed" | "needs_review" | "validated";

export interface AnalysisPlan {
  id: string;

  projectId: string;

  datasetId: string;

  status: AnalysisPlanStatus;

  items: AnalysisItem[];

  createdAt: string;

  updatedAt: string;

  validatedAt?: string;
}
