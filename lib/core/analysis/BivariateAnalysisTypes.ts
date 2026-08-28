// ============================================================
// ACADIA — BIVARIATE ANALYSIS TYPES (P7.1)
//
// Comme DescriptiveAnalysis (P6), c'est une VUE calculée à la
// volée à partir du Dataset — jamais persistée séparément,
// jamais une duplication des données (P7.1/P7.28).
// ============================================================

import type { ContingencyTable } from "./BivariateStatistics";

export type BivariateMethod =
  | "chi_square"
  | "pearson_spearman"
  | "spearman"
  | "group_comparison"
  | "unsupported";

export type BivariateStatus = "ready" | "insufficient_data" | "unsupported" | "invalid_data";

export interface BivariateVariableRef {
  columnId: string;
  label: string;
  role?: string;
}

export interface GroupStat {
  groupLabel: string;
  n: number;
  mean: number | null;
  median: number | null;
  standardDeviation: number | null;
  min: number | null;
  max: number | null;
}

export interface GroupComparisonResult {
  groups: GroupStat[];
}

export interface ChiSquareBlock {
  table: ContingencyTable;
  rowPercentages: number[][];
  columnPercentages: number[][];
  chiSquare: number | null;
  degreesOfFreedom: number;
  pValue: number | null;
  assumptionsMet: boolean;
  expectedCellsBelow5Count: number;
  totalCells: number;
  cramersV: number | null;
}

export interface CorrelationBlock {
  coefficient: number | null;
  n: number;
  pValue: number | null;
  warnings: string[];
}

export type HypothesisCompatibility = "compatible" | "incompatible" | "inconclusive";

export interface HypothesisLink {
  hypothesisId: string;
  statement: string;
  compatibility: HypothesisCompatibility;
  note: string;
}

export interface BivariateReadiness {
  datasetValid: boolean;
  variableXDefined: boolean;
  variableYDefined: boolean;
  sufficientN: boolean;
  missingDataOk: boolean;
  methodCompatible: boolean;
  analyzable: boolean;
  label: string;
}

export interface BivariateAnalysis {
  id: string;

  projectId: string;

  datasetId: string;

  variableX: BivariateVariableRef;

  variableY: BivariateVariableRef;

  method: BivariateMethod;

  methodLabel: string;

  sampleSize: number;

  validPairCount: number;

  missingPairCount: number;

  status: BivariateStatus;

  chiSquare?: ChiSquareBlock;

  pearson?: CorrelationBlock;

  spearman?: CorrelationBlock;

  /** Paires numériques utilisées pour le calcul — réutilisées pour le nuage de points (évite de dupliquer l'extraction). */
  scatterPairs?: [number, number][];

  groupComparison?: GroupComparisonResult;

  /** Ligne du modèle scientifique reliant X/Y (P7.24), lorsqu'applicable. */
  scientificModelNote?: string;

  hypothesisLink?: HypothesisLink;

  interpretation: string[];

  warnings: string[];

  createdAt: string;
}
