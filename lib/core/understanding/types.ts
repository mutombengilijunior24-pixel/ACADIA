/**
 * Moteur de compréhension de la recherche — contrats.
 *
 * Le moteur est déterministe : mêmes entrées + mêmes décisions ⇒ même rapport.
 * L'IA (facultative) n'ajoute que des suggestions marquées « ai », jamais des faits confirmés.
 */

export const UNDERSTANDING_ENGINE_VERSION = "1.0.0";

/** Provenance d'un élément affiché : ce que l'utilisateur a écrit, ce que le moteur en déduit, ce que l'IA suggère. */
export type Origin = "user" | "engine" | "ai";

export type Approach = "unspecified" | "quantitative" | "qualitative" | "mixed";

export interface ResearchUnderstandingInput {
  title: string;
  context: string;
  problem: string;
  mainQuestion: string;
  specificQuestions: string[];
  generalObjective: string;
  specificObjectives: string[];
  hypotheses: string[];
  field: string;
  period: string;
  population: string;
  /** Une entrée par concept ; « Concept : définition » fournit une définition. */
  concepts: string[];
  notes: string;
  approach: Approach;
}

export type FieldKey = Exclude<keyof ResearchUnderstandingInput, "approach">;

/** Élément de la recherche auquel un résultat se rapporte (pour citer la source). */
export type ElementRef =
  | "title"
  | "context"
  | "problem"
  | "mainQuestion"
  | `specificQuestion:${number}`
  | "generalObjective"
  | `specificObjective:${number}`
  | `hypothesis:${number}`
  | "field"
  | "period"
  | "population"
  | `concept:${number}`
  | "notes"
  | "specificQuestions"
  | "specificObjectives"
  | "hypotheses"
  | "concepts"
  | `variable:${string}`;

export interface SourceRef {
  element: ElementRef;
  excerpt: string;
}

export type StudyNature = "explanatory" | "associative" | "comparative" | "descriptive" | "exploratory" | "undetermined";

export interface StudyNatureResult {
  nature: StudyNature;
  /** Une formulation causale (« impact », « effet »…) a été repérée. */
  causalLanguage: boolean;
  evidence: SourceRef[];
  explanation: string;
}

export type DataKind = "quantitative" | "ordinal" | "nominal" | "binary" | "qualitative";

export interface IndicatorProposal {
  label: string;
  dataType: DataKind;
  measure: string;
  example?: string;
}

export interface DimensionProposal {
  name: string;
  indicators: IndicatorProposal[];
}

export type VariableRole =
  | "explanatory"
  | "dependent"
  | "control"
  | "mediator"
  | "moderator"
  | "descriptive"
  | "qualitative_category"
  | "undetermined";

export type Confidence = "low" | "medium" | "high";

export type ProposalStatus = "proposed" | "confirmed" | "rejected";

export interface AiConceptSuggestion {
  definition: string;
  dimensions: DimensionProposal[];
  ambiguities: string[];
  evidence: string;
}

export interface VariableCard {
  key: string;
  name: string;
  /** Qui a introduit ce concept. */
  origin: Origin;
  group: "central" | "contextual" | "secondary";
  definition: { text: string; origin: Origin } | null;
  role: VariableRole;
  candidateRoles: VariableRole[];
  roleOrigin: Origin;
  justification: string[];
  /** Phrases décrivant les relations avec les autres variables. */
  relationNotes: string[];
  dimensions: DimensionProposal[];
  /** Mise en garde contre une réduction abusive du concept. */
  pitfall?: string;
  ambiguity?: string;
  toClarify: string[];
  confidence: Confidence;
  confidenceReason: string;
  status: ProposalStatus;
  sources: SourceRef[];
  /** Concept de la base méthodologique d'où proviennent les dimensions suggérées. */
  matchedAlias?: string;
  ai?: AiConceptSuggestion;
}

export type RelationNature = "association" | "causal_claim" | "difference";

export interface RelationProposal {
  id: string;
  from: string;
  to: string;
  /** false : l'ordre from/to n'indique aucun sens (association non orientée). */
  directed: boolean;
  nature: RelationNature;
  direction: "positive" | "negative" | "unspecified";
  sources: SourceRef[];
  /** Toujours « supposée » : le moteur ne démontre aucune relation. */
  evidenceStatus: "assumed";
  note: string;
  status: ProposalStatus;
}

export type HypothesisStatus = "provided_untested" | "candidate" | "retained" | "rejected";

export interface HypothesisAnalysis {
  id: string;
  index: number;
  text: string;
  origin: Origin;
  status: HypothesisStatus;
  concepts: string[];
  relationNature: RelationNature | "unknown";
  direction: "positive" | "negative" | "unspecified";
  examines: string;
  /** null : impossible à vérifier (ni question ni objectif fournis). */
  alignment: { aligned: boolean | null; detail: string };
  vagueTerms: string[];
  issues: string[];
  reformulation?: string;
  operationalNeeds: string[];
  /** Aucune donnée n'a été analysée : une hypothèse n'est jamais déclarée confirmée par ce moteur. */
  empiricalStatus: "untested";
}

export type DiagnosticKind = "contradiction" | "missing" | "improvement";
export type Severity = "high" | "medium" | "low";

export interface Diagnostic {
  id: string;
  kind: DiagnosticKind;
  severity: Severity;
  origin: Origin;
  elements: ElementRef[];
  title: string;
  problem: string;
  whyItMatters: string;
  proposal?: string;
  needed?: string;
}

export type ClarificationPriority = 1 | 2 | 3;

export interface ClarificationQuestion {
  id: string;
  priority: ClarificationPriority;
  origin: Origin;
  target: ElementRef | "study";
  question: string;
  why: string;
}

export interface Improvement {
  id: string;
  origin: Origin;
  target: ElementRef | "study";
  proposal: string;
  justification: string;
}

export interface AiSection {
  status: "not_requested" | "pending" | "ok" | "error" | "disabled";
  message?: string;
  model?: string;
}

export interface UnderstandingReport {
  engineVersion: string;
  inputKey: string;
  nature: StudyNatureResult;
  synthesis: string;
  provided: { field: FieldKey; label: string }[];
  missingEssential: { field: FieldKey; label: string }[];
  mainQuestion: { text: string; origin: Origin } | null;
  specificQuestions: string[];
  generalObjective: string | null;
  specificObjectives: string[];
  hypotheses: HypothesisAnalysis[];
  candidateHypotheses: HypothesisAnalysis[];
  hypothesesNote: string;
  variables: VariableCard[];
  rejectedVariables: VariableCard[];
  relations: RelationProposal[];
  diagnostics: Diagnostic[];
  clarifications: ClarificationQuestion[];
  improvements: Improvement[];
  /** Décisions qui ne correspondent plus à aucun élément après modification des textes. */
  orphanDecisions: string[];
  ai: AiSection;
}

export interface VariableDecision {
  name?: string;
  definition?: string;
  role?: VariableRole;
  status?: "confirmed" | "rejected";
}

export interface UnderstandingDecisions {
  variables: Record<string, VariableDecision>;
  added: { key: string; name: string; definition?: string; role: VariableRole }[];
  hypotheses: Record<string, "retained" | "rejected">;
  relations: Record<string, "confirmed" | "rejected">;
}
