import type { StatementId } from "../syscohada/chart";
import type { Sector } from "../types";

export type FamilyId = "equilibre" | "liquidite" | "solvabilite" | "rentabilite" | "activite" | "sig" | "caf" | "flux" | "croissance" | "scores";

export const FAMILY_LABELS: Record<FamilyId, string> = {
  equilibre: "Équilibre financier et structure",
  liquidite: "Liquidité",
  solvabilite: "Solvabilité et endettement",
  rentabilite: "Rentabilité et marges",
  activite: "Activité et cycle d'exploitation",
  sig: "Soldes intermédiaires de gestion",
  caf: "Capacité d'autofinancement",
  flux: "Flux de trésorerie",
  croissance: "Croissance",
  scores: "Scores de risque (indicatifs)",
};

/** Dimensions du verdict « L'état de l'entreprise ». */
export type DimensionId = "liquidite" | "solvabilite" | "rentabilite" | "activite" | "equilibre";

export const DIMENSION_LABELS: Record<DimensionId, string> = {
  liquidite: "Liquidité",
  solvabilite: "Solvabilité et endettement",
  rentabilite: "Rentabilité",
  activite: "Activité et cycle d'exploitation",
  equilibre: "Équilibre financier et trésorerie",
};

export const DIMENSION_ORDER: DimensionId[] = ["liquidite", "solvabilite", "rentabilite", "activite", "equilibre"];

export type IndicatorUnit = "pct" | "ratio" | "jours" | "annees" | "montant" | "points";

/** Repères : `good` = seuil favorable, `bad` = seuil défavorable (entre les deux : à surveiller). */
export interface Bands {
  good: number;
  bad: number;
}

export interface Norms {
  default: Bands;
  bySector?: Partial<Record<Sector, Bands>>;
  /** Nature du repère (convention usuelle, à valider par l'encadreur). */
  note: string;
}

export interface IndicatorDef {
  id: string;
  label: string;
  family: FamilyId;
  /** Formule évaluée (codes REF, agrégats, paramètres). */
  formula: string;
  /** Formule lisible par l'étudiant. */
  formulaLabel: string;
  unit: IndicatorUnit;
  /** Sens favorable : plus haut, plus bas, ou sans jugement. */
  direction: "higher" | "lower" | "neutral";
  requires: StatementId[];
  /** Nombre minimal d'exercices (variations). */
  minExercises?: number;
  /** Participe au verdict de cette dimension, avec ce poids. */
  dimension?: DimensionId;
  weight?: number;
  norms?: Norms;
  /** L'indicateur n'a pas de sens si cette expression n'est pas strictement positive. */
  guard?: { formula: string; reason: string };
  definition: string;
  why: string;
  reading: { favorable: string; vigilance: string; defavorable: string };
  limits?: string[];
  reflexes?: string[];
  /** Expressions du sujet de recherche qui renvoient à cet indicateur. */
  aliases: string[];
  /** Mise en garde affichée avec la valeur (scores calibrés ailleurs…). */
  caveat?: string;
}
