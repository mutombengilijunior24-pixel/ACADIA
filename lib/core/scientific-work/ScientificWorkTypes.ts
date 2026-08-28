// ============================================================
// ACADIA — SCIENTIFIC WORK TYPES (P11)
//
// Structure inspirée du référentiel "Méthodes de recherche en
// sciences économiques et de gestion" (Pascal Sem Mbimbi & Annie
// Cornet, chapitre 4 — schéma IRMRD). Cette structure est une
// PROPOSITION ACADIA inspirée du référentiel — jamais présentée
// comme une citation littérale de l'ouvrage, et jamais imposée
// comme l'unique structure valide.
//
// P11 est un COMPILATEUR DE DOCUMENT : il ne recalcule pas les
// statistiques (P6/P7/P8 s'en chargent déjà), il assemble les
// contenus déjà générés/validés en une structure scientifique
// cohérente. Le contenu descriptif (P6) est recalculé à la volée
// (aucune sélection requise) ; le contenu bivarié/économétrique
// (P7/P8) n'est intégré QUE lorsqu'il a été explicitement validé
// ou édité par le chercheur (voir ResearchContext.annotations) —
// jamais un résultat non relu silencieusement présenté comme
// définitif dans un document scientifique.
// ============================================================

import type { ValidationStatus } from "@/lib/core/analysis/EconomicInterpretationTypes";

export type { ValidationStatus };

// ============================================================
// TYPE DE TRAVAIL (P11.3) — jamais déduit automatiquement
// ============================================================

export type ScientificWorkType = "TFC" | "MEMOIRE" | "DEA" | "THESE" | "ARTICLE" | "CUSTOM";

export const SCIENTIFIC_WORK_TYPE_LABELS: Record<ScientificWorkType, string> = {
  TFC: "Travail de fin de cycle (TFC)",
  MEMOIRE: "Mémoire",
  DEA: "DEA",
  THESE: "Thèse",
  ARTICLE: "Article scientifique",
  CUSTOM: "Personnalisé",
};

// ============================================================
// BLOC DE CONTENU ÉDITABLE — même logique que P9/P10
// (InterpretationBlock / DiscussionSection) : jamais dupliquée,
// réutilisée à l'identique.
// ============================================================

export interface WorkContentBlock {
  id: string;
  label: string;
  statements: string[];
  /** true si le contenu contient au moins une mention "à compléter/définir/préciser". */
  hasPlaceholder: boolean;
}

// ============================================================
// SECTION DE LA STRUCTURE IRMRD (P11.4)
// ============================================================

export type ScientificWorkChapterId =
  | "introduction"
  | "literature"
  | "methodology"
  | "results"
  | "discussion"
  | "conclusion"
  | "annexes"
  | "bibliography";

export interface ScientificWorkSectionNode {
  id: string;
  number: string;
  title: string;
  chapterId: ScientificWorkChapterId;
  children?: ScientificWorkSectionNode[];
}

// ============================================================
// P11.10-11 — RÉSULTATS DESCRIPTIFS / TRI À PLAT
// ============================================================

export interface FlatSortRow {
  modality: string;
  count: number;
  percentage: number;
}

export interface DescriptiveResultEntry {
  columnId: string;
  variableId?: string;
  dimensionId?: string;
  indicatorId?: string;
  label: string;
  block: WorkContentBlock;
  flatSort?: FlatSortRow[];
  validN: number;
}

// ============================================================
// P11.12/13 — RÉSULTATS BIVARIÉS / ÉCONOMÉTRIQUES
// (pulled from validated annotations only — voir engine)
// ============================================================

export interface ValidatedResultEntry {
  blockId: string;
  label: string;
  block: WorkContentBlock;
  status: ValidationStatus;
  sourceType: "bivariate" | "econometric_summary" | "econometric_coefficient" | "econometric_diagnostics";
}

// ============================================================
// P11.14 — RÉSULTATS QUALITATIFS
// ============================================================

export interface QualitativeThemeResult {
  themeId: string;
  theme: string;
  responseCount: number;
  block: WorkContentBlock;
}

// ============================================================
// P11.17 — CONFRONTATION DES HYPOTHÈSES
// ============================================================

export type HypothesisConfrontationStatus =
  | "to_examine"
  | "compatible"
  | "not_compatible"
  | "inconclusive"
  | "not_applicable";

export interface HypothesisConfrontationRow {
  hypothesisId: string;
  statement: string;
  variableLabels: string[];
  empiricalResult: string;
  testUsed: string;
  statisticalResult: string;
  interpretation: string;
  status: HypothesisConfrontationStatus;
}

// ============================================================
// P11.19 — ANNEXES (jamais une annexe inexistante)
// ============================================================

export interface AnnexEntry {
  id: string;
  label: string;
  type: "questionnaire" | "interview_guide" | "data_dictionary" | "table" | "figure" | "other";
  available: boolean;
}

// ============================================================
// P11.20 — BIBLIOGRAPHIE (type préparé — jamais de référence inventée)
// ============================================================

export type BibliographyReferenceType = "book" | "article" | "report" | "conference" | "website" | "thesis" | "other";

export interface BibliographyReference {
  id: string;
  author: string;
  year?: number;
  title: string;
  publisher?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  accessDate?: string;
  type: BibliographyReferenceType;
}

// ============================================================
// P11.24 — TRAÇABILITÉ
// ============================================================

export interface TraceabilityRef {
  projectId: string;
  sectionId: string;
  sourceType: string;
  sourceId?: string;
}

// ============================================================
// STRUCTURE COMPLÈTE DU DOCUMENT
// ============================================================

export interface ScientificWorkIntroduction {
  context: WorkContentBlock;
  researchProblem: WorkContentBlock;
  justification: WorkContentBlock;
  researchQuestion: WorkContentBlock;
  objectives: WorkContentBlock;
  hypotheses?: WorkContentBlock;
  methodologySummary: WorkContentBlock;
  delimitation: WorkContentBlock;
  workStructure: WorkContentBlock;
}

export interface ScientificWorkLiteratureReview {
  conceptualFramework: WorkContentBlock;
  theoreticalFramework: WorkContentBlock;
  theoreticalStudies: WorkContentBlock;
  empiricalStudies: WorkContentBlock;
  positioning: WorkContentBlock;
}

export interface ScientificWorkMethodology {
  approach: WorkContentBlock;
  methods: WorkContentBlock;
  fieldOfStudy: WorkContentBlock;
  population: WorkContentBlock;
  sampling: WorkContentBlock;
  collectionTechniques: WorkContentBlock;
  instruments: WorkContentBlock;
  dataPreparation: WorkContentBlock;
  analysisMethods: WorkContentBlock;
  validityReliability?: WorkContentBlock;
}

export interface ScientificWorkResults {
  fieldPresentation: WorkContentBlock;
  descriptive: DescriptiveResultEntry[];
  bivariate: ValidatedResultEntry[];
  econometric: ValidatedResultEntry[];
  qualitative: QualitativeThemeResult[];
  synthesis: WorkContentBlock;
  mode: "quantitative" | "qualitative" | "mixed" | "descriptive_only";
}

export interface ScientificWorkDiscussion {
  /** Réutilise directement ScientificDiscussion (P10) — jamais dupliquée. */
  available: boolean;
  unavailableReason?: string;
  hypothesisConfrontations: HypothesisConfrontationRow[];
}

export interface ScientificWorkConclusion {
  researchObjectRecall: WorkContentBlock;
  problemRecall: WorkContentBlock;
  mainQuestions: WorkContentBlock;
  methodologySynthesis: WorkContentBlock;
  mainResults: WorkContentBlock;
  theoreticalContribution: WorkContentBlock;
  methodologicalContribution: WorkContentBlock;
  practicalContribution: WorkContentBlock;
  limitations: WorkContentBlock;
  perspectives: WorkContentBlock;
}

export interface ScientificWork {
  id: string;
  projectId: string;
  title: string;
  type: ScientificWorkType;
  structure: ScientificWorkSectionNode[];
  introduction: ScientificWorkIntroduction;
  literatureReview: ScientificWorkLiteratureReview;
  methodology: ScientificWorkMethodology;
  results: ScientificWorkResults;
  discussion: ScientificWorkDiscussion;
  conclusion: ScientificWorkConclusion;
  annexes: AnnexEntry[];
  bibliography: BibliographyReference[];
  updatedAt: string;
}

// ============================================================
// P11.21 — VALIDATION SCIENTIFIQUE
// ============================================================

export type ScientificWorkCheckSeverity = "pass" | "warning" | "needs_review" | "error";

export interface ScientificWorkCheckItem {
  id: string;
  label: string;
  severity: ScientificWorkCheckSeverity;
  detail: string;
}

export interface ScientificWorkValidationResult {
  items: ScientificWorkCheckItem[];
  errorCount: number;
  warningCount: number;
  needsReviewCount: number;
  passCount: number;
}

// ============================================================
// P11.22 — READINESS
// ============================================================

export type ScientificWorkReadinessLevel = "incomplete" | "in_preparation" | "almost_ready" | "ready_for_review";

export interface ScientificWorkReadiness {
  score: number;
  level: ScientificWorkReadinessLevel;
  label: string;
}
