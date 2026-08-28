// ============================================================
// ACADIA — ECONOMIC INTERPRETATION TYPES (P9)
//
// P9 répond à : "Que montrent les données ?" — jamais "pourquoi"
// (P10) ni "est-ce prouvé" (jamais). Vue calculée à la volée à
// partir des résultats P6/P7/P8 déjà produits — aucune donnée
// dupliquée, uniquement les statuts de validation humaine sont
// persistés (voir ResearchContext.annotations).
// ============================================================

export type ValidationStatus = "generated" | "needs_review" | "accepted" | "edited";

/**
 * Bloc de texte interprétatif éditable — l'unité de base réutilisée
 * par P9 et P10. `statements` est le texte généré (jamais perdu,
 * même après édition) ; `editedContent`, quand présent, est ce qui
 * doit être affiché à la place (voir ResearchContext.annotations —
 * jamais écrasé par un recalcul automatique).
 */
export interface InterpretationBlock {
  id: string;
  title: string;
  statements: string[];
}

// ============================================================
// P9.1 — INTERPRÉTATION DESCRIPTIVE
// ============================================================

export interface DescriptiveInterpretationResult {
  columnId: string;
  label: string;
  block: InterpretationBlock;
}

// ============================================================
// P9.2 — INTERPRÉTATION BIVARIÉE
// ============================================================

export interface BivariateInterpretationResult {
  analysisId: string;
  available: boolean;
  unavailableReason?: string;
  block: InterpretationBlock;
  hypothesisNote?: string;
}

// ============================================================
// P9.3 — INTERPRÉTATION ÉCONOMÉTRIQUE (structure A-F par coefficient)
// ============================================================

export interface CoefficientInterpretation {
  id: string;
  regressorName: string;
  label: string;
  role: "principal" | "control";

  /** A. Résultat statistique — ex. "β = 0,48, p = 0,032". */
  statisticalResult: string;

  /** B. Interprétation — lecture en unités de la variable. */
  interpretation: string;

  /** C. Significativité. */
  significance: string;

  /** D. Sens économique dans le contexte du projet. */
  economicMeaning: string;

  /** E. Distinction significativité statistique / importance économique. */
  economicImportanceNote: string;

  /** F. Soutien empirique à l'hypothèse liée, lorsqu'applicable — jamais "prouvée". */
  hypothesisNote?: string;
}

export interface DiagnosticsInterpretation {
  vif: string[];
  heteroscedasticity: string;
  normality: string;
  influentialObservations: string[];
}

export interface EconometricInterpretationResult {
  modelId: string;
  available: boolean;
  unavailableReason?: string;

  /** P9.5 — "Ce que montre le modèle". */
  modelSummary: InterpretationBlock;

  /** P9.5 — "Ce que le modèle ne permet pas encore d'affirmer". */
  modelLimitations: InterpretationBlock;

  coefficients: CoefficientInterpretation[];
  diagnostics: DiagnosticsInterpretation;

  /** P9.6 — vocabulaire SEG contextuel, jamais forcé si le domaine ne le justifie pas. */
  domainVocabulary: string[];
}
