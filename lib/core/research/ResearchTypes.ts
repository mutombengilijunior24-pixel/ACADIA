// ============================================================
// ACADIA — RESEARCH TYPES
// Contrat central du moteur de recherche
//
// Ce fichier définit les structures partagées par :
// - ResearchCore
// - ResearchIntelligenceEngine
// - AIResearchAdapter
// - SubjectUnderstanding
// - VariableIntelligence
// - ResearchContext
// - ResearchTab
//
// IMPORTANT :
// Une structure scientifique = une seule définition.
// ============================================================

import type { AnalysisPlan } from "@/lib/core/analysis/AnalysisPlanTypes";
import type { StatisticalAnalysisRun } from "@/lib/core/statistics/StatisticalTypes";


// ============================================================
// STATUT D'UNE RECHERCHE
// ============================================================

export type ResearchStatus =
  | "draft"
  | "completed"
  | "archived";


// ============================================================
// MODE / TYPE DE RECHERCHE
// ============================================================

export type ResearchType =
  | "quantitative"
  | "qualitative"
  | "mixed";


// ============================================================
// DONNÉES INITIALES FOURNIES PAR L'UTILISATEUR
// ============================================================


// ============================================================
// DONNÉES INITIALES PAR DÉFAUT
// ============================================================


// ============================================================
// RÔLE D'UNE VARIABLE
// ============================================================

export type VariableRole =
  | "independent"
  | "dependent"
  | "mediating"
  | "moderating"
  | "control"
  | "descriptive";

// ============================================================
// STATUT D'UNE PROPOSITION SCIENTIFIQUE
// ============================================================

export type ProposalStatus =
  | "draft"
  | "proposed"
  | "accepted"
  | "rejected";


// ============================================================
// NIVEAU DE CONFIANCE
// ============================================================

export type ConfidenceLevel =
  | "low"
  | "medium"
  | "high";


// ============================================================
// STATUT D'UNE COMPRÉHENSION
// ============================================================

export type UnderstandingStatus =
  | "proposed"
  | "accepted"
  | "needs_review";


// ============================================================
// STATUT D'UNE MÉTHODOLOGIE
// ============================================================

export type MethodologyStatus =
  | "draft"
  | "to_review"
  | "accepted";


// ============================================================
// TYPE DE RELATION ENTRE VARIABLES
// ============================================================

export type ResearchRelationType =
  | "influence"
  | "impact"
  | "effect"
  | "relationship"
  | "association"
  | "correlation"
  | "mediation"
  | "moderation";


// ============================================================
// QUESTION DE RECHERCHE
// ============================================================

export interface ResearchQuestion {
  id: string;

  text: string;

  type?: "main" | "secondary";

  status: ProposalStatus;

  confidence: ConfidenceLevel;
}


// ============================================================
// OBJECTIF DE RECHERCHE
// ============================================================

export interface ResearchObjective {
  id: string;

  /**
   * Formulation de l'objectif.
   * Utilisé par ResearchCore.
   */
  text: string;

  /**
   * Alias facultatif permettant de conserver
   * une éventuelle compatibilité avec l'interface.
   */
  title?: string;

  description?: string;

  role:
    | "general"
    | "specific";

  /**
   * Alias facultatif.
   */
  type?: "general" | "specific";

  /**
   * Position de l'objectif spécifique.
   */
  index?: number;

  /**
   * Alias facultatif.
   */
  order?: number;

  indicators?: string[];

  status: ProposalStatus;

  confidence: ConfidenceLevel;
}


// ============================================================
// TYPE DE MESURE D'UN INDICATEUR
//
// Structure préparée pour une future couche économétrique.
// AUCUNE valeur n'est attribuée automatiquement : un indicateur
// n'a de measurementType que si le protocole du chercheur le
// justifie explicitement. Tant que ce n'est pas le cas, le
// champ reste undefined (jamais une valeur inventée).
// ============================================================

export type MeasurementType =
  | "frequence"
  | "montant"
  | "pourcentage"
  | "score"
  | "echelle_likert"
  | "ratio"
  | "binaire"
  | "categorielle"
  | "continue";


// ============================================================
// INDICATEUR DE RECHERCHE
// ============================================================

export interface ResearchIndicator {
  id: string;

  name: string;

  description?: string;

  /**
   * Variable à laquelle l'indicateur est rattaché
   * lorsque cette information est disponible.
   */
  variableId?: string;

  /**
   * Dimension à laquelle l'indicateur appartient.
   */
  dimensionId?: string;

  /**
   * Nature de la mesure associée, lorsqu'elle est justifiée
   * (voir MeasurementType). Préparatoire à l'économétrie.
   */
  measurementType?: MeasurementType;

  status?: ProposalStatus;

  confidence?: ConfidenceLevel;
}


// ============================================================
// DIMENSION D'UNE VARIABLE
// ============================================================

export interface ResearchDimension {
  id: string;

  name: string;

  description?: string;

  /**
   * Variable mère.
   */
  variableId: string;

  /**
   * Indicateurs appartenant à cette dimension.
   */
  indicators: ResearchIndicator[];

  status: ProposalStatus;

  confidence: ConfidenceLevel;
}


// ============================================================
// TYPE DE DONNÉE D'UNE VARIABLE
//
// Structure préparée pour une future couche économétrique.
// Comme MeasurementType, jamais attribuée automatiquement.
// ============================================================

export type VariableDataType =
  | "quantitative"
  | "qualitative"
  | "binaire"
  | "nominale"
  | "ordinale"
  | "discrete"
  | "continue";


// ============================================================
// VARIABLE DE RECHERCHE
// ============================================================

export interface ResearchVariable {
  id: string;

  name: string;

  role: VariableRole;

  /**
   * Définition scientifique de la variable (conservée telle
   * quelle pour compatibilité — historiquement alimentée par
   * la définition opérationnelle produite par A2).
   */
  definition: string;

  /**
   * Définition conceptuelle (théorique) de la variable,
   * distincte de sa définition opérationnelle. N'est renseignée
   * que lorsque l'information est réellement disponible —
   * jamais déduite ou inventée.
   */
  conceptualDefinition?: string;

  /**
   * Définition opérationnelle explicite (comment la variable
   * est concrètement mesurée/observée).
   */
  operationalDefinition?: string;

  /**
   * Nature statistique de la variable, lorsqu'elle est
   * justifiée par les informations disponibles.
   */
  dataType?: VariableDataType;

  description?: string;

  /**
   * Dimensions de la variable.
   */
  dimensions: ResearchDimension[];

  /**
   * Indicateurs de la variable.
   */
  indicators: ResearchIndicator[];

  /**
   * Objectifs auxquels la variable est liée.
   */
  linkedObjectiveIds: string[];

  status: ProposalStatus;

  confidence: ConfidenceLevel;
}


// ============================================================
// RELATION ENTRE VARIABLES
// ============================================================

export interface ResearchRelation {
  id: string;

  /**
   * Variable source.
   */
  from: string;

  /**
   * Variable cible.
   */
  to: string;

  /**
   * Nature de la relation.
   */
  relation: ResearchRelationType | string;

  /**
   * Description ou justification de la relation.
   */
  description?: string;

  /**
   * Statut de la proposition. "needs_review" signale une
   * relation dont la résolution vers des variables réelles est
   * incertaine (voir AIResearchAdapter.resolveVariableMatch) —
   * distinct de "draft", qui signale une relation qu'A1 lui-même
   * n'a pas su qualifier (relation "unknown").
   */
  status?: ProposalStatus | "needs_review";

  /**
   * Niveau de confiance.
   */
  confidence?: ConfidenceLevel;
}


// ============================================================
// COMPATIBILITÉ — ANCIEN NOM UTILISÉ PAR A2
// ============================================================

export type ResearchVariableRelation =
  ResearchRelation;

// ============================================================
// HYPOTHÈSE DE RECHERCHE
// ============================================================

export interface ResearchHypothesis {
  id: string;

  statement: string;

  role?:
    | "general"
    | "specific";

  variableIds?: string[];

  objectiveId?: string;

  status: ProposalStatus;

  confidence: ConfidenceLevel;
}


// ============================================================
// COMPRÉHENSION / ANALYSE DE LA RECHERCHE
// ============================================================

export interface ResearchUnderstanding {
  /**
   * Problématique comprise par le moteur.
   */
  problem?: string;

  /**
   * Objectif général compris.
   */
  objective?: string;

  /**
   * Objectifs spécifiques compris.
   */
  objectives?: string[];

  /**
   * Variables identifiées.
   */
  variables?: ResearchVariable[];

  /**
   * Population étudiée.
   */
  population?: string;

  /**
   * Localisation.
   */
  location?: string;

  /**
   * Type de recherche.
   */
  researchType?: ResearchType | string;

  /**
   * Orientation méthodologique.
   */
  methodology?: string;

  /**
   * Résumé global.
   */
  summary?: string;

  // ----------------------------------------------------------
  // DONNÉES PRODUITES PAR A1
  // ----------------------------------------------------------

  researchFocus?: string;

  mainConcepts?: string[];

  proposedRelationship?: {
    from: string;

    to: string;

    relation: ResearchRelationType | string;

    description?: string;
  };

  assumptions?: string[];

  pointsToConfirm?: string[];

  confidence?: ConfidenceLevel;

  status?: UnderstandingStatus;
}


// ============================================================
// TYPE DE DEVIS DE RECHERCHE (P3)
//
// Catégories usuelles génériques (issues du prompt produit, pas
// d'un référentiel académique déposé — voir ACADIA_SEG_METHODOLOGY.md
// §0 : le document de Sem Mbimbi & Cornet n'est pas encore présent
// dans docs/reference/). À réviser dès que le référentiel réel
// est disponible.
// ============================================================

export type ResearchDesignType =
  | "descriptive"
  | "explicative"
  | "analytique"
  | "correlationnelle"
  | "causale"
  | "comparative"
  | "exploratoire";


// ============================================================
// NATURE DES DONNÉES (P3.6)
// ============================================================

export type DataSourceType =
  | "primaire"
  | "secondaire"
  | "mixte";


// ============================================================
// MÉTHODOLOGIE DE RECHERCHE
// ============================================================

export interface ResearchMethodology {
  /**
   * Approche : quantitative, qualitative ou mixte.
   */
  approach?: ResearchType | string;

  approachExplanation?: string;

  /**
   * Devis de recherche (descriptive, explicative, ...).
   * Reste une PROPOSITION tant que le chercheur ne l'a pas
   * validée — voir MethodologyRecommendationEngine.
   */
  researchDesignType?: ResearchDesignType;

  /**
   * Unité d'analyse (ex. "entreprise", "agent", "ménage").
   * Non déduite automatiquement — renseignée uniquement si
   * explicitement disponible.
   */
  analysisUnit?: string;

  /**
   * Méthode scientifique utilisée.
   */
  method?: string;

  methodExplanation?: string;

  /**
   * Techniques de collecte.
   */
  techniques: string[];

  /**
   * Instruments de collecte.
   */
  instruments: string[];

  /**
   * Population étudiée.
   */
  population?: string;

  /**
   * Taille de la population.
   */
  populationSize?: number;

  /**
   * Méthode d'échantillonnage.
   */
  samplingMethod?: string;

  /**
   * Taille de l'échantillon.
   */
  sampleSize?: number;

  /**
   * Justification de la technique d'échantillonnage retenue.
   * Jamais générée automatiquement si l'information manque.
   */
  samplingJustification?: string;

  /**
   * Données primaires, secondaires, ou mixte.
   */
  dataSourceType?: DataSourceType;

  /**
   * Sources de données.
   */
  dataSources: string[];

  /**
   * Méthodes d'analyse.
   */
  analysisMethods: string[];

  /**
   * Compatibilité avec certaines anciennes
   * structures du moteur.
   */
  analyses?: string[];

  /**
   * Compatibilité avec certaines anciennes
   * structures du moteur.
   */
  analysisMethod?: string;

  collectionMethod?: string;

  description?: string;

  status: MethodologyStatus;

  confidence: ConfidenceLevel;

  warnings: string[];
}


// ============================================================
// MATRICE DE RECHERCHE
// ============================================================

export interface ResearchMatrix {
  variables: ResearchVariable[];

  objectives: ResearchObjective[];

  hypotheses: ResearchHypothesis[];

  indicators: ResearchIndicator[];
}


// ============================================================
// INSTRUMENT DE RECHERCHE
// ============================================================

export interface ResearchInstrument {
  id: string;

  name: string;

  type: string;

  description?: string;
}


// ============================================================
// MÉTADONNÉES DU PROJET
// ============================================================

export interface ResearchMetadata {
  createdAt: string;

  updatedAt: string;

  version: number;

  source: string;

  language: string;
}


// ============================================================
// PROJET DE RECHERCHE
//
// C'EST LA STRUCTURE CENTRALE DU RESEARCH CORE.
// ============================================================

export interface ResearchProject {
  id: string;

  title: string;

  description?: string;

  status: ResearchStatus;

  // ----------------------------------------------------------
  // INFORMATIONS GÉNÉRALES
  // ----------------------------------------------------------

  domain?: string;

  level?: string;

  university?: string;

  location?: string;

  researchType: ResearchType;

  // ----------------------------------------------------------
  // DATES
  // ----------------------------------------------------------

  createdAt: Date;

  updatedAt: Date;

  // ----------------------------------------------------------
  // COMPRÉHENSION
  // ----------------------------------------------------------

  understanding?: ResearchUnderstanding;

  // ----------------------------------------------------------
  // PROBLÉMATIQUE
  // ----------------------------------------------------------

  problem?: {
    statement: string;

    status: ProposalStatus;

    confidence: ConfidenceLevel;
  };

  // ----------------------------------------------------------
  // QUESTIONS DE RECHERCHE
  // ----------------------------------------------------------

  researchQuestions: ResearchQuestion[];

  // ----------------------------------------------------------
  // OBJECTIFS
  // ----------------------------------------------------------

  objectives: ResearchObjective[];

  // ----------------------------------------------------------
  // VARIABLES
  // ----------------------------------------------------------

  variables: ResearchVariable[];

  // ----------------------------------------------------------
  // RELATIONS
  // ----------------------------------------------------------

  relations: ResearchRelation[];

  // ----------------------------------------------------------
  // HYPOTHÈSES
  // ----------------------------------------------------------

  hypotheses: ResearchHypothesis[];

  // ----------------------------------------------------------
  // MÉTHODOLOGIE
  // ----------------------------------------------------------

  methodology: ResearchMethodology;

  // ----------------------------------------------------------
  // MATRICE
  // ----------------------------------------------------------

  matrix?: ResearchMatrix;

  // ----------------------------------------------------------
  // INSTRUMENTS
  // ----------------------------------------------------------

  instruments: ResearchInstrument[];

  // ----------------------------------------------------------
  // PLAN D'ANALYSE (Module 4) — additif, absent tant qu'aucun
  // plan n'a été généré. Voir lib/core/analysis/AnalysisPlanTypes.ts.
  // ----------------------------------------------------------

  analysisPlan?: AnalysisPlan;

  // ----------------------------------------------------------
  // EXÉCUTIONS STATISTIQUES (Mission 5) — additif, historique
  // complet conservé (jamais écrasé — voir mission §21, §30).
  // ----------------------------------------------------------

  statisticalRuns?: StatisticalAnalysisRun[];

  // ----------------------------------------------------------
  // MÉTADONNÉES
  // ----------------------------------------------------------

  metadata: ResearchMetadata;
}
