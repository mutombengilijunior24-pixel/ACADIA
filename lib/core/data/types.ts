/**
 * ACADIA — Contrats de données du moteur de préparation (chantier A).
 *
 * Chaîne : fichier source → lecture (A1) → profilage (A2) → classification et
 * compréhension méthodologique (A3) → données préparées pour les futurs moteurs.
 *
 * Principe : les observations importées ne sont JAMAIS modifiées. Toute décision
 * (code de valeur manquante, exclusion, type confirmé, correspondance…) est une
 * opération journalisée et réversible, appliquée à la lecture.
 */

/* =========================================================
   A1 — IMPORTATION
========================================================= */

export type SourceFormat = "csv" | "xlsx";

/** Date lue dans un classeur XLSX (le format XLSX stocke les dates comme des nombres formatés). */
export interface SpreadsheetDate {
  t: "date";
  /** Date ISO 8601 (AAAA-MM-JJ, avec l'heure si elle est non nulle). */
  iso: string;
}

/**
 * Valeur brute telle que lue dans le fichier, sans conversion destructive.
 * - `null`   : cellule absente (ligne plus courte que l'en-tête, cellule XLSX vide).
 * - `string` : texte tel quel, espaces compris (CSV : toujours du texte).
 * - `number` : nombre stocké comme tel dans un XLSX.
 * - `boolean`: booléen XLSX.
 */
export type RawValue = string | number | boolean | null | SpreadsheetDate;

export type IssueSeverity = "error" | "warning" | "info";

export interface ImportIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  /** Numéro de ligne dans le fichier source (1 = première ligne). */
  sourceRow?: number;
  /** Index de colonne (0 = première colonne). */
  column?: number;
}

export interface ImportedColumn {
  index: number;
  /** En-tête exactement tel qu'il figure dans le fichier (peut être vide ou dupliqué). */
  originalHeader: string;
  /** Nom technique unique, dérivé de l'en-tête, distinct de l'original. */
  technicalName: string;
  headerFlags: Array<"empty" | "duplicate" | "generated" | "extra">;
}

export type ImportStatus = "ok" | "ok_with_warnings";

export interface CsvReadInfo {
  delimiter: string;
  delimiterSource: "detected" | "user";
  encoding: "utf-8" | "windows-1252";
  encodingSource: "detected" | "user";
  hadBom: boolean;
}

export interface XlsxReadInfo {
  sheetName: string;
  sheetIndex: number;
  availableSheets: Array<{ name: string; rowCount: number }>;
}

export interface ImportedDataset {
  importId: string;
  fileName: string;
  format: SourceFormat;
  fileSize: number;
  importedAt: string;
  csv?: CsvReadInfo;
  xlsx?: XlsxReadInfo;
  /** Ligne d'en-tête (numéro source) ; null si l'utilisateur a indiqué « pas d'en-tête ». */
  headerRow: number | null;
  columns: ImportedColumn[];
  /** Observations : une ligne par observation, alignée sur `columns` (cellules absentes = null). */
  rows: RawValue[][];
  /** Numéro de ligne source de chaque observation (même index que `rows`). */
  sourceRows: number[];
  rowCount: number;
  columnCount: number;
  issues: ImportIssue[];
  status: ImportStatus;
}

export type ImportResult =
  | { ok: true; dataset: ImportedDataset }
  | { ok: false; issues: ImportIssue[]; sheets?: Array<{ name: string; rowCount: number }> };

export interface ImportOptions {
  /** CSV : séparateur imposé ; sinon détection automatique. */
  delimiter?: string;
  /** CSV : encodage imposé ; sinon UTF-8, puis Windows-1252 si le fichier n'est pas de l'UTF-8 valide. */
  encoding?: "utf-8" | "windows-1252";
  /** XLSX : nom de la feuille à importer (par défaut la première non vide). */
  sheet?: string;
  /** Numéro de la ligne d'en-tête (1 = première ligne). Par défaut : première ligne non vide. */
  headerRow?: number;
  /** true : le fichier n'a pas de ligne d'en-tête ; des noms de colonnes sont générés. */
  noHeader?: boolean;
}

/* =========================================================
   INTERPRÉTATION D'UNE CELLULE (non destructive)
========================================================= */

/**
 * Nature d'une cellule, calculée à la lecture sans modifier la valeur brute.
 * - missing      : cellule absente
 * - empty_string : chaîne vide ""
 * - whitespace   : chaîne ne contenant que des espaces
 * - numeric_text : texte représentant un nombre ("3,5", "1 200", "007")
 * - number       : nombre stocké comme nombre (XLSX)
 * - date         : date reconnue (XLSX, ou texte au format AAAA-MM-JJ / JJ/MM/AAAA)
 * - boolean      : booléen XLSX
 * - text         : autre texte
 * - invalid      : valeur à la forme reconnue mais impossible (ex. « 31/02/2024 »)
 */
export type CellKind =
  | "missing"
  | "empty_string"
  | "whitespace"
  | "numeric_text"
  | "number"
  | "date"
  | "boolean"
  | "text"
  | "invalid";

export interface CellInterpretation {
  kind: CellKind;
  /** Valeur numérique, si la cellule représente un nombre. */
  number?: number;
  /** Date ISO, si la cellule représente une date. */
  dateIso?: string;
  /** Format de date ambigu (JJ/MM vs MM/JJ indiscernables). */
  ambiguousDate?: boolean;
  /** Nombre écrit avec des zéros en tête (« 007 ») : souvent un code. */
  leadingZero?: boolean;
  /** Texte normalisé pour comparer les modalités (sans modifier la donnée). */
  label: string;
}

/* =========================================================
   A2 — PROFILAGE
========================================================= */

export type StorageType = "string" | "integer" | "decimal" | "date" | "boolean" | "ambiguous" | "unknown";

export interface NumericSummary {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
}

export interface CategoryCount {
  value: string;
  count: number;
  /** count / nombre de valeurs renseignées de la colonne. */
  frequency: number;
}

export interface DateSummary {
  recognized: number;
  /** recognized / nombre de valeurs renseignées. */
  recognizedRate: number;
  min?: string;
  max?: string;
  ambiguousFormat: boolean;
}

export interface OutlierSummary {
  method: "IQR_1_5";
  lowerFence: number;
  upperFence: number;
  count: number;
  examples: number[];
}

export interface ColumnProfile {
  index: number;
  originalHeader: string;
  technicalName: string;
  storageType: StorageType;
  kindCounts: Record<CellKind, number>;
  present: number;
  missing: number;
  /** missing / nombre de lignes. */
  missingRate: number;
  distinct: number;
  examples: string[];
  numeric?: NumericSummary;
  categories?: { top: CategoryCount[]; otherCount: number; distinct: number };
  dates?: DateSummary;
  outliers?: OutlierSummary;
  /** Valeurs pouvant être des codes de non-réponse (NA, 99…) : à confirmer, jamais appliquées d'office. */
  missingCodeCandidates: Array<{ value: string; count: number }>;
  /** Codes de valeur manquante confirmés par l'utilisateur et appliqués à ce profil. */
  appliedMissingCodes: string[];
  warnings: string[];
}

export type Readiness = "ready" | "ready_with_warnings" | "not_ready";

export interface DuplicateGroup {
  /** Index (dans `rows`) de la première occurrence. */
  firstRow: number;
  /** Index des lignes identiques à la première. */
  duplicateRows: number[];
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  totalCells: number;
  missingCells: number;
  /** missingCells / totalCells (0 si aucune cellule). */
  missingCellRate: number;
  rowsWithMissing: number;
  emptyRows: number;
  emptyRowIndexes: number[];
  /** Nombre de lignes identiques à une ligne précédente (lignes vides exclues). */
  exactDuplicateRows: number;
  duplicateGroups: DuplicateGroup[];
  /** Lignes exclues par l'utilisateur, non prises en compte dans ce profil. */
  excludedRows: number;
  ambiguousColumns: number;
  anomalyCount: number;
  readiness: Readiness;
  readinessReasons: string[];
  columns: ColumnProfile[];
}

/* =========================================================
   A3 — VARIABLES ET MODÈLE DE RECHERCHE
========================================================= */

export type StatisticalType =
  | "nominal"
  | "ordinal"
  | "quantitative_discrete"
  | "quantitative_continuous"
  | "temporal"
  | "identifier"
  | "free_text"
  | "to_confirm"
  | "unclassified";

export type VariableRoleInStudy =
  | "dependent"
  | "independent"
  | "mediating"
  | "moderating"
  | "control"
  | "grouping"
  | "identifier"
  | "descriptive"
  | "context"
  | "measure"
  | "qualitative_text";

export type ClassificationConfidence = "high" | "medium" | "low";

export interface DetectedClassification {
  storageType: StorageType;
  statisticalType: StatisticalType;
  confidence: ClassificationConfidence;
  /** Règle déterministe ayant produit la classification. */
  rule: string;
  reasons: string[];
  /** Variable binaire (exactement deux modalités observées). */
  binary: boolean;
  /** Échelle ordonnée détectée (ex. Likert 1–5). */
  scale?: { min: number; max: number; labels?: string[] };
}

export interface VariableMetadata {
  column: number;
  technicalName: string;
  originalHeader: string;
  detected: DetectedClassification;
  /** Type statistique confirmé ou corrigé par l'utilisateur, avec sa provenance. */
  confirmed?: { statisticalType: StatisticalType; by: "user"; at: string; operationId: string };
  /** Type retenu : confirmé s'il existe, sinon détecté. */
  effectiveType: StatisticalType;
  /** Provenance du type retenu. */
  typeSource: "auto" | "questionnaire" | "user";
  /** true tant que le type n'est ni confirmé ni détecté avec une confiance élevée. */
  needsConfirmation: boolean;
  role?: { value: VariableRoleInStudy; source: "user" | "research_variable" | "classification"; detail?: string };
  mapping?: ColumnMapping;
  /** Une analyse future ne peut s'appuyer sur la colonne que si true. */
  analysisReady: boolean;
}

export type MappingSource = "auto_exact_text" | "auto_question_code" | "auto_similar_text" | "user";

export interface ColumnMapping {
  column: number;
  questionId?: string;
  questionNumber?: number;
  questionText?: string;
  questionType?: string;
  variable?: string;
  /** Identifiant d'une variable du projet de recherche (ResearchVariable.id). */
  researchVariableId?: string;
  dimension?: string;
  indicator?: string;
  /** Modalités attendues (ex. échelle Likert du questionnaire). */
  expectedValues?: Array<{ value: string; label: string }>;
  source: MappingSource;
  confidence: ClassificationConfidence;
  confirmed: boolean;
  reasons: string[];
}

export type DataStructureFamily =
  | "cross_sectional"
  | "time_series"
  | "panel"
  | "financial"
  | "questionnaire"
  | "operational"
  | "qualitative_text"
  | "mixed";

export interface StructureCandidate {
  family: DataStructureFamily;
  confidence: ClassificationConfidence;
  evidence: string[];
  /** Toujours "proposed" tant que l'utilisateur n'a pas confirmé. */
  status: "proposed" | "confirmed";
}

export type Provenance = "explicit" | "proposed" | "inferred" | "unknown";

export interface ResearchFact {
  key: string;
  label: string;
  value?: string;
  provenance: Provenance;
  note?: string;
}

export interface UnderstandingState {
  facts: ResearchFact[];
  variables: VariableMetadata[];
  structure: StructureCandidate[];
  confirmedStructure?: DataStructureFamily;
  mappings: ColumnMapping[];
  ambiguities: string[];
  missingInformation: string[];
  questionsForUser: string[];
  /** Les données sont lues et profilées (même si des décisions restent ouvertes). */
  dataPrepared: boolean;
  /** Colonnes utilisables par un futur moteur d'analyse (type non ambigu). */
  analysisReadyColumns: number;
  /** Les décisions méthodologiques bloquantes pour une analyse sont toutes résolues. */
  readyForAnalysisSelection: boolean;
}

/* =========================================================
   JOURNAL DE PRÉPARATION (réversible)
========================================================= */

interface OperationBase {
  id: string;
  at: string;
}

export type PreparationOperation =
  | (OperationBase & { type: "declare_missing_codes"; column: number; values: string[] })
  | (OperationBase & { type: "exclude_rows"; rows: number[]; reason: string })
  | (OperationBase & { type: "set_statistical_type"; column: number; statisticalType: StatisticalType })
  | (OperationBase & { type: "set_role"; column: number; role: VariableRoleInStudy | null })
  | (OperationBase & { type: "set_mapping"; column: number; mapping: ColumnMapping | null })
  | (OperationBase & { type: "confirm_structure"; family: DataStructureFamily | null });

export interface PreparationState {
  datasetId: string;
  operations: PreparationOperation[];
}
