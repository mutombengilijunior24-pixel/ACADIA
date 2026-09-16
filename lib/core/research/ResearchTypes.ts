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
import type { ScientificInterpretation } from "@/lib/core/analysis/ScientificInterpretationTypes";
import type { ScientificConclusion } from "@/lib/core/analysis/ScientificConclusionTypes";
import type { WritingSection } from "@/lib/core/writing/WritingTypes";


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
// MODES DE RECHERCHE (Research Intelligence V2)
//
// Classification MULTI-LABEL produite par A1 (jamais une catégorie
// unique forcée) : un sujet peut relever à la fois de FINANCIAL_ANALYSIS,
// CASE_STUDY et SECONDARY_DATA. CASE_STUDY n'est jamais synonyme de
// MIXED_METHOD — le premier est un cadre/contexte d'étude, le second
// une combinaison de méthodes quanti/quali. Voir
// lib/core/research/ResearchModeTaxonomy.ts pour les libellés.
// ============================================================

export type ResearchModeTag =
  | "QUANTITATIVE_SURVEY"
  | "QUALITATIVE"
  | "FINANCIAL_ANALYSIS"
  | "SECONDARY_DATA"
  | "MIXED_METHOD"
  | "CASE_STUDY"
  | "DESCRIPTIVE"
  | "CORRELATIONAL"
  | "EXPLANATORY"
  | "COMPARATIVE";


// ============================================================
// FIABILITÉ PAR CHAMP (Research Intelligence V2)
//
// Remplace/complète la seule confiance globale (ConfidenceLevel)
// lorsqu'une réponse champ par champ est nécessaire — distingue
// explicitement ce que le chercheur a écrit (KNOWN), ce qu'A1 en
// déduit (INFERRED), ce qu'A1 propose au-delà du texte (PROPOSED),
// ce qui manque (MISSING) et ce qui doit être vérifié par le
// chercheur (TO_VERIFY). Jamais une invention présentée comme KNOWN.
// ============================================================

export type FieldConfidenceStatus =
  | "KNOWN"
  | "INFERRED"
  | "PROPOSED"
  | "MISSING"
  | "TO_VERIFY"
  | "SOURCED";

export interface ResearchModeTagConfidence {
  tag: ResearchModeTag;
  confidence: FieldConfidenceStatus;
}

export interface FieldConfidenceMap {
  phenomenon: FieldConfidenceStatus;
  problem: FieldConfidenceStatus;
  population: FieldConfidenceStatus;
  location: FieldConfidenceStatus;
  mainConcepts: FieldConfidenceStatus;
  proposedRelationship: FieldConfidenceStatus;
  /**
   * Research Intelligence V3 — ferme la chaîne phénomène → problème →
   * question → objectifs (voir section 1 de la mission V3). SOURCED
   * n'est jamais assigné par A1 lui-même (il n'a accès à aucune
   * recherche documentaire) — réservé à un enrichissement ultérieur.
   */
  researchQuestion: FieldConfidenceStatus;
  generalObjective: FieldConfidenceStatus;
  specificObjectives: FieldConfidenceStatus;
  /**
   * Une entrée par tag présent dans researchModeTags — jamais la
   * taxonomie entière, seulement les tags réellement assignés.
   */
  researchModeTags: ResearchModeTagConfidence[];
}


// ============================================================
// TABLEAU PHÉNOMÈNE → INDICATEUR → DONNÉE (Research Intelligence V2,
// enrichi V3)
//
// ATTENTION : ceci est un tableau de STRUCTURATION du phénomène,
// PAS un tableau de chiffres réels. `status` décrit l'état de LA
// RECHERCHE de la donnée (KNOWN/INFERRED/PROPOSED/MISSING/TO_VERIFY/
// SOURCED) — même vocabulaire que FieldConfidenceStatus, jamais une
// valeur observée. SOURCED n'est légitime que si `source` cite
// réellement une provenance vérifiable (voir SubjectUnderstandingAI.ts
// et ResearchConsistencyEngine.ts, qui vérifie cette règle).
// ============================================================

export interface PhenomenonTableRow {
  /**
   * L'aspect/élément du phénomène concerné (ex. "Dépenses publiques"),
   * distinct de l'indicateur précis qui le mesure.
   */
  phenomenonElement: string;
  indicator: string;
  requiredData: string;
  /**
   * Nom/nature de la source envisagée (ex. "comptes de résultat de
   * l'entreprise", "rapports budgétaires municipaux") — jamais une
   * URL ou un organisme précis inventé. Chaîne vide si non déterminé.
   */
  source: string;
  period: string;
  geographicScope: string;
  status: FieldConfidenceStatus;
  /**
   * Courte justification du statut retenu (ex. "proposé par ACADIA,
   * jamais confirmé" / "cité par une source réelle trouvée en ligne").
   */
  provenance: string;
  collectionProposal: string;
}


// ============================================================
// CONTEXTE RÉELLEMENT SOURCÉ (recherche documentaire, Bloc B ; V3 —
// équivalent du "phenomenonEvidence[]" de la mission : même concept,
// même nom conservé pour ne pas dupliquer un champ existant)
//
// Distinct du raisonnement d'A1 : chaque élément provient d'une
// vraie recherche web (voir lib/ai/openai/PhenomenonContextAI.ts),
// jamais une déduction ou une proposition d'ACADIA — d'où la
// provenance figée à "PROVENANT_D_UNE_SOURCE".
// ============================================================

export interface SourcedContextItem {
  text: string;
  sourceUrl: string;
  sourceTitle: string;
  provenance: "PROVENANT_D_UNE_SOURCE";
}


// ============================================================
// PROVENANCE (mission Server Contracts & Research Persistence)
//
// Taxonomie GÉNÉRALE de "d'où vient cette information", utilisée au
// niveau d'une VERSION d'analyse entière (ResearchAnalysisVersion,
// voir plus bas) — distincte de FieldConfidenceStatus (qui répond à
// "quelle est la fiabilité de CE champ", pas "quel type de source
// l'a produit"). SourcedContextItem.provenance ("PROVENANT_D_UNE_SOURCE",
// ci-dessus) reste inchangé pour compatibilité — il correspond
// sémantiquement à WEB_SOURCE dans cette taxonomie plus large.
// ============================================================

export type ProvenanceTag =
  | "SUBJECT"
  | "USER_INPUT"
  | "AI_INFERENCE"
  | "AI_PROPOSAL"
  | "DOCUMENT"
  | "WEB_SOURCE"
  | "DATABASE"
  | "SYSTEM_RULE"
  | "USER_VALIDATION";


// ============================================================
// VALIDATION D'UNE ANALYSE (mission Server Contracts & Research Persistence)
//
// Cycle de vie d'UNE VERSION d'analyse — distinct de ProposalStatus
// (draft/proposed/accepted/rejected, utilisé pour chaque objet
// scientifique individuel : variable, hypothèse, orientation
// théorique...). "edited" n'est PAS déclenché automatiquement par les
// éditeurs existants (setResearchQuestion, updateVariableStatus...) —
// seule la génération d'une nouvelle version (deep-analysis) et la
// validation/le rejet explicites (voir /api/research/[id]/understanding/validate)
// font évoluer cet état dans cette mission ; le déclenchement fin par
// champ reste une évolution future documentée dans le rapport.
// ============================================================

export type AnalysisValidationState =
  | "generated"
  | "edited"
  | "validated"
  | "rejected";


// ============================================================
// VERSION D'ANALYSE (mission Server Contracts & Research Persistence)
//
// Enveloppe versionnée de ce que produit une analyse en profondeur
// (A1 + A2) — jamais écrasée : chaque exécution ajoute une nouvelle
// entrée à ResearchProject.analysisHistory (même discipline que
// statisticalRuns/scientificInterpretations/scientificConclusions,
// déjà éprouvée dans ce projet — voir ResearchStateService.ts).
// methodologyRecommendation et consistency ne sont JAMAIS stockés ici
// : ce sont des fonctions pures de (project, understanding), toujours
// recalculées à la lecture (voir ResearchAnalysisResponse.ts) — les
// persister serait une duplication inutile de données dérivables.
// ============================================================

export interface ResearchAnalysisVersion {
  id: string;
  version: number;
  /** Version dont celle-ci découle, absente pour la toute première. */
  parentVersion?: number;
  engineVersion?: string;
  /** Modèle IA réellement utilisé pour produire cette version (voir ModelRouter). */
  model?: string;
  provenance: ProvenanceTag;
  validation: AnalysisValidationState;
  createdAt: string;
  understanding: ResearchUnderstanding;
  variables: ResearchVariable[];
  relations: ResearchRelation[];
  /**
   * Hypothèses AJOUTÉES par cette version précisément (project.hypotheses
   * reste la liste cumulative complète, jamais dupliquée ici).
   */
  hypothesesAdded: ResearchHypothesis[];
}


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

  // ----------------------------------------------------------
  // RESEARCH INTELLIGENCE V2 — produits par A1 (SubjectUnderstandingAI)
  // ----------------------------------------------------------

  /**
   * Le phénomène observé — distinct de "problem" (l'écart/la
   * difficulté) et de "summary". Jamais une reformulation du titre.
   */
  phenomenon?: string;

  /**
   * Classification multi-label du/des mode(s) de recherche (voir
   * ResearchModeTag). Jamais une catégorie unique forcée.
   */
  researchModeTags?: ResearchModeTag[];

  /**
   * Fiabilité champ par champ (KNOWN/INFERRED/PROPOSED/MISSING/
   * TO_VERIFY) — remplace la seule confiance globale là où une
   * réponse plus fine est disponible.
   */
  fieldConfidence?: FieldConfidenceMap;

  /**
   * Tableau de structuration du phénomène (indicateur → donnée
   * nécessaire → statut de disponibilité → période → proposition
   * de collecte). Jamais des chiffres réels — voir PhenomenonTableRow.
   */
  phenomenonTable?: PhenomenonTableRow[];

  // ----------------------------------------------------------
  // RESEARCH INTELLIGENCE V3 — ferme la chaîne phénomène → problème
  // → question de recherche → objectifs (voir mission V3, section 1)
  // ----------------------------------------------------------

  /**
   * Question de recherche proposée par A1 — distincte de
   * project.researchQuestions (la/les questions VALIDÉES par le
   * chercheur, construites par ResearchCore). Toujours une
   * proposition à confirmer, jamais auto-promue en question validée.
   */
  researchQuestion?: string;

  /**
   * Version du moteur A1 ayant produit cette compréhension —
   * traçabilité lorsque le contrat évolue (voir SubjectUnderstandingAI.ts).
   */
  engineVersion?: string;
}


// ============================================================
// ORIENTATION THÉORIQUE (analyse en profondeur, 10/09/2026)
//
// Une théorie proposée comme cadre possible pour la recherche —
// jamais imposée, toujours à confronter à la littérature réelle.
// ============================================================

export interface TheoreticalOrientation {
  id: string;

  theory: string;

  reason: string;

  confidence: ConfidenceLevel;

  status: ProposalStatus;
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
  // ORIENTATIONS THÉORIQUES (analyse en profondeur, 10/09/2026)
  //
  // Théories proposées comme pertinentes pour le sujet — toujours
  // une PROPOSITION à confronter à la littérature réelle par le
  // chercheur, jamais une affirmation que la théorie s'applique.
  // ----------------------------------------------------------

  theoreticalOrientations?: TheoreticalOrientation[];

  // ----------------------------------------------------------
  // CONTEXTE SOURCÉ (Research Intelligence V2) — éléments trouvés par
  // PhenomenonContextAI lors de la preview sans compte, conservés à
  // l'inscription au lieu d'être jetés (voir createResearchFromPreview,
  // contexts/ResearchContext.tsx). Toujours distincts du raisonnement
  // d'A1 : provenance figée à "PROVENANT_D_UNE_SOURCE".
  // ----------------------------------------------------------

  sourcedContext?: SourcedContextItem[];

  // ----------------------------------------------------------
  // HISTORIQUE DES VERSIONS D'ANALYSE (mission Server Contracts &
  // Research Persistence) — additif, absent pour tout projet créé
  // avant cette mission (voir ResearchAnalysisResponse.ts, qui
  // synthétise une version 1 à partir de `understanding` pour ces
  // projets, garantissant la compatibilité ascendante). Jamais
  // écrasé : chaque analyse en profondeur AJOUTE une entrée.
  // ----------------------------------------------------------

  analysisHistory?: ResearchAnalysisVersion[];

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
  // INTERPRÉTATIONS SCIENTIFIQUES (Mission 6) — additif, historique
  // complet conservé (même discipline que statisticalRuns : jamais
  // écrasé, chaque génération reste consultable).
  // ----------------------------------------------------------

  scientificInterpretations?: ScientificInterpretation[];

  // ----------------------------------------------------------
  // CONCLUSIONS SCIENTIFIQUES (Mission 7) — additif, historique
  // complet conservé (même discipline que scientificInterpretations
  // et statisticalRuns : jamais écrasé, chaque génération reste
  // consultable).
  // ----------------------------------------------------------

  scientificConclusions?: ScientificConclusion[];

  // ----------------------------------------------------------
  // RÉDACTION SCIENTIFIQUE (Mission 9) — additif, une section par
  // WritingSectionType (pas d'historique multi-sections comme les
  // blocs ci-dessus : chaque section garde son propre historique de
  // versions en interne, voir WritingSection.versions).
  // ----------------------------------------------------------

  writingSections?: WritingSection[];

  // ----------------------------------------------------------
  // MÉTADONNÉES
  // ----------------------------------------------------------

  metadata: ResearchMetadata;
}
