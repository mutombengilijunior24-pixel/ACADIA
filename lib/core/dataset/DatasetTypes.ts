// ============================================================
// ACADIA — DATASET TYPES (P5)
//
// Structure de données préparant l'analyse quantitative future.
// AUCUN calcul statistique n'a lieu ici (P5 l'interdit
// explicitement) — uniquement structure, traçabilité et
// contrôles de qualité déterministes non statistiques.
// ============================================================

import type { VariableRole } from "@/lib/core/research/ResearchTypes";


// ============================================================
// TYPE DE RÉPONSE (distinct du niveau de mesure — B5)
// ============================================================

export type DatasetColumnDataType =
  | "text"
  | "integer"
  | "decimal"
  | "boolean"
  | "single_choice"
  | "multiple_choice"
  | "likert"
  | "date";


// ============================================================
// NIVEAU DE MESURE (B6) — jamais confondu avec le type ci-dessus
// ============================================================

export type MeasurementLevel =
  | "nominal"
  | "ordinal"
  | "interval"
  | "ratio";


// ============================================================
// COLONNE DU DATASET — traçable jusqu'à la question source
// ============================================================

export interface DatasetColumn {
  id: string;

  /** Identifiant stable de la variable dataset (ex. MOT_01). */
  name: string;

  /** Libellé lisible, dérivé de l'indicateur/texte de la question. */
  label: string;

  dataType: DatasetColumnDataType;

  measurementLevel: MeasurementLevel;

  /* --------------------------------------------------------
     TRAÇABILITÉ — Colonne → Question → Indicateur → Dimension
     → Variable. Jamais inventée : absente si la question
     source n'a elle-même aucun lien scientifique établi.
  -------------------------------------------------------- */

  sourceQuestionId?: string;

  variableId?: string;

  dimensionId?: string;

  indicatorId?: string;

  /** Rôle copié tel quel depuis la variable de recherche (B9) — jamais réinterprété. */
  role?: VariableRole;

  required: boolean;

  options?: { value: string; label: string }[];
}


// ============================================================
// LIGNE DU DATASET — UNE OBSERVATION
// ============================================================

export interface DatasetRow {
  id: string;

  respondentId?: string;

  submittedAt: string;

  /** Valeur par colonne, indexée par DatasetColumn.id. */
  values: Record<string, string | number | boolean | string[] | null>;
}


// ============================================================
// DATASET
// ============================================================

export type DatasetStatus = "draft";

export interface Dataset {
  id: string;

  projectId: string;

  instrumentId: string;

  name: string;

  status: DatasetStatus;

  columns: DatasetColumn[];

  rows: DatasetRow[];

  createdAt: string;

  updatedAt: string;
}


// ============================================================
// QUALITÉ DU DATASET (B14) — jamais une mesure statistique
// ============================================================

export type DatasetQualitySeverity =
  | "pass"
  | "warning"
  | "needs_review"
  | "error";

export interface DatasetQualityItem {
  id: string;

  label: string;

  severity: DatasetQualitySeverity;

  detail?: string;
}

export interface DatasetQualityResult {
  items: DatasetQualityItem[];

  errorCount: number;

  warningCount: number;
}


// ============================================================
// READINESS DU DATASET (B15)
// ============================================================

export interface DatasetReadiness {
  variablesStructured: boolean;

  questionsLinked: boolean;

  dictionaryAvailable: boolean;

  hasObservations: boolean;

  analyzable: boolean;

  /** "Prêt à recevoir les données" ou "Prêt pour l'analyse" — jamais les deux à tort. */
  label: string;
}
