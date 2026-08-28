// ============================================================
// ACADIA — ECONOMETRIC MODEL TYPES (P8)
//
// Comme BivariateAnalysis (P7) : vue calculée à la volée à
// partir du Dataset — jamais persistée séparément (P8.56).
// ============================================================

import type { VariableRole } from "@/lib/core/research/ResearchTypes";
import type {
  HeteroscedasticityResult,
  NormalityResult,
} from "./EconometricStatistics";
import type { HypothesisCompatibility } from "./BivariateAnalysisTypes";

export type EncodingType = "continuous" | "binary" | "ordinal_numeric" | "dummy";

export interface EncodedRegressor {
  /** Nom synthétique stable (ex. "MOT_01" ou "SECT_Commerce" pour une dummy). */
  name: string;
  label: string;
  sourceColumnId: string;
  encodingType: EncodingType;
  /** Modalité de référence — uniquement pour un encodage dummy. */
  referenceCategory?: string;
  role: "principal" | "control";
  variableRole?: VariableRole;
}

export interface CoefficientRow {
  name: string;
  label: string;
  coefficient: number;
  standardError: number | null;
  tStatistic: number | null;
  pValue: number | null;
  confidenceInterval: [number, number] | null;
  significant: boolean;
  role: "intercept" | "principal" | "control";
}

export interface VIFRow {
  name: string;
  label: string;
  vif: number | null;
  concern: boolean;
}

export interface InfluentialObservationRow {
  rowIndex: number;
  respondentLabel: string;
  cooksDistance: number;
  leverage: number;
}

export interface EconometricDiagnostics {
  vif: VIFRow[];
  heteroscedasticity: HeteroscedasticityResult;
  normality: NormalityResult;
  influentialObservations: InfluentialObservationRow[];
}

export interface EconometricHypothesisLink {
  hypothesisId: string;
  statement: string;
  compatibility: HypothesisCompatibility;
  note: string;
}

export type EconometricStatus =
  | "ready"
  | "insufficient_data"
  | "singular_matrix"
  | "unsupported"
  | "no_variance"
  | "not_specified";

export interface EconometricModel {
  id: string;
  projectId: string;
  datasetId: string;

  dependent: { columnId: string; label: string };
  regressors: EncodedRegressor[];

  sampleSize: number;
  validObservationCount: number;
  missingObservationCount: number;

  status: EconometricStatus;
  equation: string;

  intercept: CoefficientRow | null;
  coefficients: CoefficientRow[];

  r2: number | null;
  adjustedR2: number | null;
  sse: number | null;
  ssr: number | null;
  sst: number | null;
  fStatistic: number | null;
  fPValue: number | null;
  degreesOfFreedomResidual: number;

  diagnostics: EconometricDiagnostics | null;

  interpretation: string[];
  hypothesisLinks: EconometricHypothesisLink[];
  warnings: string[];

  createdAt: string;
}

export interface EconometricReadiness {
  yDefined: boolean;
  xDefined: boolean;
  datasetAvailable: boolean;
  sufficientObservations: boolean;
  yHasVariance: boolean;
  identifiableMatrix: boolean;
  validCategoricalEncoding: boolean;
  modelSpecified: boolean;
  level: "ready" | "to_review" | "impossible";
  label: string;
}
