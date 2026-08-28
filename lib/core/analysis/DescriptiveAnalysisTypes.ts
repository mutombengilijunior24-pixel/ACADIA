// ============================================================
// ACADIA — DESCRIPTIVE ANALYSIS TYPES (P6.1 / P6.11 / P6.12)
//
// L'analyse est une VUE calculée à partir du Dataset (P5) — elle
// ne duplique aucune donnée. Ce fichier ne définit que la forme
// du résultat produit par DescriptiveAnalysisEngine, jamais
// persisté tel quel (voir P6.25 : recalculée à chaque affichage).
// ============================================================

import type {
  DatasetColumnDataType,
  MeasurementLevel,
} from "@/lib/core/dataset/DatasetTypes";

import type { VariableRole } from "@/lib/core/research/ResearchTypes";


// ============================================================
// FRÉQUENCES (P6.12)
// ============================================================

export interface FrequencyEntry {
  value: string;

  label: string;

  count: number;

  /** % calculé sur l'ensemble des observations (N total). */
  percentage: number;

  /** % calculé sur les seules réponses valides (base explicite — P6.8). */
  validPercentage: number;

  cumulativePercentage?: number;
}


// ============================================================
// STATISTIQUES NUMÉRIQUES (P6.5)
// ============================================================

export interface NumericalStatistics {
  min: number | null;

  max: number | null;

  mean: number | null;

  median: number | null;

  mode: number[] | null;

  variance: number | null;

  standardDeviation: number | null;
}


// ============================================================
// LECTURE DESCRIPTIVE (P6.20)
// ============================================================

export interface DescriptiveReading {
  /** "Ce que ce résultat permet de dire" */
  statements: string[];

  /** "Ce que ce résultat ne permet pas encore de conclure" */
  limitation: string;
}


// ============================================================
// RÉSULTAT PAR VARIABLE (P6.11)
// ============================================================

export interface DescriptiveVariableResult {
  columnId: string;

  variableId?: string;

  dimensionId?: string;

  indicatorId?: string;

  label: string;

  role?: VariableRole;

  dataType: DatasetColumnDataType;

  measurementLevel: MeasurementLevel;

  sampleSize: number;

  validCount: number;

  missingCount: number;

  /** Absent si la variable n'a pas de traitement fréquentiel pertinent. */
  frequencyTable?: FrequencyEntry[];

  /** Absent si la variable n'a pas de traitement numérique pertinent. */
  numericalStatistics?: NumericalStatistics;

  /**
   * false si des valeurs incompatibles avec le type déclaré ont été
   * détectées pour cette colonne (P6.22/P6.24) — l'analyse n'est
   * alors pas calculée pour cette variable, jamais approximée.
   */
  analyzable: boolean;

  warnings: string[];

  reading?: DescriptiveReading;
}


// ============================================================
// PROFIL DE L'ÉCHANTILLON (P6.14)
// ============================================================

export interface SampleProfileEntry {
  columnId: string;

  label: string;

  result: DescriptiveVariableResult;
}


// ============================================================
// ANALYSE DESCRIPTIVE COMPLÈTE (P6.1)
// ============================================================

export type DescriptiveAnalysisStatus = "empty" | "partial" | "ready";

export interface DescriptiveAnalysis {
  id: string;

  datasetId: string;

  projectId: string;

  createdAt: string;

  status: DescriptiveAnalysisStatus;

  sampleSize: number;

  variableResults: DescriptiveVariableResult[];

  sampleProfile: SampleProfileEntry[];

  analyzableCount: number;

  errorCount: number;

  /** Avertissements globaux hérités du contrôle qualité du Dataset (P5). */
  qualityWarnings: string[];
}
