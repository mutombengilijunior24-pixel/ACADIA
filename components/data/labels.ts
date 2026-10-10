import type { ClassificationConfidence, DataStructureFamily, Provenance, StatisticalType, StorageType, VariableRoleInStudy } from "@/lib/core/data/types";

export const STORAGE_LABELS: Record<StorageType, string> = {
  string: "Texte",
  integer: "Nombre entier",
  decimal: "Nombre décimal",
  date: "Date",
  boolean: "Booléen",
  ambiguous: "Ambigu",
  unknown: "Inconnu (vide)",
};

export const STATISTICAL_LABELS: Record<StatisticalType, string> = {
  nominal: "Qualitative nominale",
  ordinal: "Qualitative ordinale",
  quantitative_discrete: "Quantitative discrète",
  quantitative_continuous: "Quantitative continue",
  temporal: "Date / temporelle",
  identifier: "Identifiant",
  free_text: "Texte libre",
  to_confirm: "Catégorie à confirmer",
  unclassified: "Non classée",
};

export const ROLE_LABELS: Record<VariableRoleInStudy, string> = {
  dependent: "Variable dépendante",
  independent: "Variable indépendante",
  mediating: "Variable médiatrice",
  moderating: "Variable modératrice",
  control: "Variable de contrôle",
  grouping: "Variable de regroupement",
  identifier: "Identifiant",
  descriptive: "Variable descriptive",
  context: "Variable de contexte",
  measure: "Variable de mesure",
  qualitative_text: "Texte qualitatif",
};

export const CONFIDENCE_LABELS: Record<ClassificationConfidence, string> = {
  high: "Confiance élevée",
  medium: "Confiance moyenne",
  low: "Confiance faible",
};

export const STRUCTURE_LABELS: Record<DataStructureFamily, string> = {
  cross_sectional: "Données transversales",
  time_series: "Série temporelle",
  panel: "Données de panel",
  financial: "Données financières / comptables",
  questionnaire: "Données de questionnaire",
  operational: "Données opérationnelles",
  qualitative_text: "Textes (questions ouvertes, entretiens)",
  mixed: "Données mixtes",
};

export const PROVENANCE_LABELS: Record<Provenance, string> = {
  explicit: "Fourni par le chercheur",
  proposed: "Proposé, non confirmé",
  inferred: "Calculé par ACADIA",
  unknown: "Inconnu",
};

export const formatPercent = (value: number) => `${(value * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
export const formatNumber = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
