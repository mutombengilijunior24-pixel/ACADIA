/**
 * Moteur « Économétrie et macroéconomie » : séries temporelles (PIB, inflation, masse monétaire, taux de
 * change…) observées sur plusieurs périodes. Tous les calculs sont déterministes et faits dans le
 * navigateur ; l'IA ne calcule jamais une statistique.
 */

export type Frequency = "annuelle" | "trimestrielle" | "mensuelle";

export const FREQUENCY_LABELS: Record<Frequency, string> = { annuelle: "Annuelle", trimestrielle: "Trimestrielle", mensuelle: "Mensuelle" };

/** Rôle macroéconomique d'une série (sert aux agrégats et à la lecture du sujet). */
export type MacroRole =
  | "pib_nominal"
  | "pib_reel"
  | "ipc"
  | "inflation"
  | "deflateur"
  | "m2"
  | "m1"
  | "base_monetaire"
  | "credit_prive"
  | "taux_change"
  | "taux_directeur"
  | "taux_interet"
  | "exportations"
  | "importations"
  | "recettes_publiques"
  | "depenses_publiques"
  | "dette_publique"
  | "reserves_change"
  | "ide"
  | "fbcf"
  | "epargne"
  | "consommation"
  | "population"
  | "va_agricole"
  | "production_agricole"
  | "superficie_cultivee"
  | "prix_agricole"
  | "transferts"
  | "aide_exterieure"
  | "autre";

export interface MacroSeries {
  id: string;
  name: string;
  /** Unité telle que saisie (ex. « milliards de CDF », « % », « CDF pour 1 USD »). */
  unit: string;
  role: MacroRole;
  /** Une valeur par période (null = donnée manquante). */
  values: Array<number | null>;
}

export interface MacroDataset {
  title: string;
  /** Pays, province ou économie étudiée. */
  economy: string;
  frequency: Frequency;
  /** Libellés des périodes, dans l'ordre chronologique (ex. « 2005 », « 2005T1 », « 2005-01 »). */
  periods: string[];
  series: MacroSeries[];
  /** Source déclarée des données (BCC, INS, Banque mondiale…). */
  source: string;
  /** Données fictives de démonstration : signalé partout (écran, exports, noms de fichiers). */
  fictitious: boolean;
}

/** Référence à une variable utilisable dans un modèle : une série saisie ou un agrégat calculé. */
export interface VariableRef {
  kind: "series" | "aggregate";
  id: string;
}

/** Transformation appliquée avant estimation. */
export type Transform = "niveau" | "log" | "diff" | "croissance";

export const TRANSFORM_LABELS: Record<Transform, string> = {
  niveau: "En niveau",
  log: "En logarithme (ln)",
  diff: "En différence première (Δ)",
  croissance: "En taux de croissance (%)",
};

export const MAX_PERIODS = 400;
export const MAX_SERIES = 40;
