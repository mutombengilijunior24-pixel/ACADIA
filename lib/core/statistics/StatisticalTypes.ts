// ============================================================
// ACADIA — STATISTICAL EXECUTION TYPES (Mission 5, incrément 1)
//
// Ce module ne redéfinit AUCUN calcul — il enveloppe les résultats
// déjà produits par DescriptiveAnalysisEngine.buildDescriptiveAnalysis
// et BivariateAnalysisEngine.buildBivariateAnalysis (P6/P7, jamais
// modifiés) dans une structure traçable et persistable, exécutée à
// partir d'un AnalysisPlan validé (Module 4).
//
// Aucune interprétation ici (voir mission §46) : les champs
// `descriptive`/`bivariate` contiennent exactement ce que les
// moteurs existants produisent déjà — chiffres et avertissements
// méthodologiques, jamais une conclusion causale.
// ============================================================

import type { AnalysisItemType } from "@/lib/core/analysis/AnalysisPlanTypes";
import type { DescriptiveVariableResult } from "@/lib/core/analysis/DescriptiveAnalysisTypes";
import type { BivariateAnalysis } from "@/lib/core/analysis/BivariateAnalysisTypes";

export type StatisticalResultStatus = "completed" | "skipped" | "failed";

export interface StatisticalResult {
  id: string;

  analysisItemId: string;

  analysisType: AnalysisItemType;

  variableIds: string[];

  columnIds: string[];

  status: StatisticalResultStatus;

  /** Effectif réellement utilisé pour ce calcul précis (N valide, pas N total du dataset). */
  n: number;

  /** Présent uniquement pour analysisType === "DESCRIPTIVE" — résultat exact de DescriptiveAnalysisEngine, non recalculé. */
  descriptive?: DescriptiveVariableResult;

  /** Présent pour les analyses à deux variables — résultat exact de BivariateAnalysisEngine, non recalculé. */
  bivariate?: BivariateAnalysis;

  warnings: string[];

  /** Renseigné uniquement si status === "skipped" (donnée insuffisante — pas une erreur système) ou "failed" (erreur système). */
  reason?: string;

  createdAt: string;
}

export type StatisticalRunStatus = "completed" | "partial" | "failed";

export interface StatisticalAnalysisRun {
  id: string;

  projectId: string;

  datasetId: string;

  analysisPlanId: string;

  /** Version du moteur d'exécution — permet de savoir avec quelle logique un run a été produit (mission §21). */
  executionVersion: string;

  /** Seuil de significativité utilisé pour ce run (mission §14) — conservé, jamais implicite. */
  alpha: number;

  status: StatisticalRunStatus;

  results: StatisticalResult[];

  startedAt: string;

  completedAt: string;
}
