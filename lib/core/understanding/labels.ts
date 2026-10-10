import { FIELD_LABELS } from "./input";
import type { Confidence, DataKind, DiagnosticKind, ElementRef, RelationNature, StudyNature, VariableRole } from "./types";

export const ROLE_LABELS: Record<VariableRole, string> = {
  explanatory: "Variable explicative (indépendante)",
  dependent: "Variable à expliquer (dépendante)",
  control: "Variable de contrôle",
  mediator: "Variable médiatrice",
  moderator: "Variable modératrice",
  descriptive: "Variable descriptive",
  qualitative_category: "Concept qualitatif / catégorie d'analyse",
  undetermined: "Rôle à préciser",
};

export const NATURE_LABELS: Record<StudyNature, string> = {
  explanatory: "Explicative",
  associative: "Relationnelle (association)",
  comparative: "Comparative",
  descriptive: "Descriptive",
  exploratory: "Exploratoire / qualitative",
  undetermined: "Indéterminée",
};

export const RELATION_LABELS: Record<RelationNature, string> = {
  association: "Association supposée",
  causal_claim: "Effet supposé (formulation causale)",
  difference: "Différence supposée entre groupes",
};

export const DATA_KIND_LABELS: Record<DataKind, string> = {
  quantitative: "Quantitative",
  ordinal: "Ordinale",
  nominal: "Nominale",
  binary: "Binaire",
  qualitative: "Qualitative (texte)",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = { low: "faible", medium: "moyenne", high: "élevée" };

export const DIAGNOSTIC_LABELS: Record<DiagnosticKind, string> = {
  contradiction: "Incohérence",
  missing: "Information manquante",
  improvement: "Amélioration recommandée",
};

export function elementLabel(ref: ElementRef | "study"): string {
  if (ref === "study") return "Étude";
  const [kind, index] = ref.split(":");
  const n = Number(index) + 1;
  switch (kind) {
    case "specificQuestion":
      return `Question spécifique ${n}`;
    case "specificObjective":
      return `Objectif spécifique ${n}`;
    case "hypothesis":
      return `Hypothèse ${n}`;
    case "concept":
      return `Concept déclaré ${n}`;
    case "variable":
      return "Variable";
    default:
      return FIELD_LABELS[kind as keyof typeof FIELD_LABELS] ?? kind;
  }
}
