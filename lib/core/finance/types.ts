/**
 * Dossier financier de l'étudiant : l'entreprise, ses exercices et les montants SAISIS (ou importés)
 * de ses états financiers. Les totaux absents sont calculés ; rien d'autre n'est inventé.
 */

export type Currency = "CDF" | "USD" | "AUTRE";
export type AmountUnit = 1 | 1000 | 1_000_000;
export type Sector = "commerce" | "industrie" | "services" | "btp" | "agriculture" | "autre";

export const SECTOR_LABELS: Record<Sector, string> = {
  commerce: "Commerce (négoce, distribution)",
  industrie: "Industrie (production, transformation)",
  services: "Services",
  btp: "Bâtiment et travaux publics",
  agriculture: "Agriculture, élevage, pêche",
  autre: "Autre secteur",
};

export const CURRENCY_LABELS: Record<Currency, string> = { CDF: "Francs congolais (CDF)", USD: "Dollars américains (USD)", AUTRE: "Autre monnaie" };

export const UNIT_LABELS: Record<AmountUnit, string> = { 1: "Unités", 1000: "Milliers", 1_000_000: "Millions" };

export interface Company {
  name: string;
  sector: Sector;
  currency: Currency;
  /** Libellé de la monnaie si « AUTRE ». */
  currencyOther: string;
  unit: AmountUnit;
  city: string;
}

export interface Exercise {
  id: string;
  /** Libellé affiché (ex. « 2023 »). */
  label: string;
  /** Dates ISO AAAA-MM-JJ. */
  start: string;
  end: string;
}

/** D'où vient un montant (affiché dans la grille et dans le rapport). */
export type ValueOrigin = "saisie" | "import" | "ia" | "demo";

export interface Correction {
  at: string;
  exerciseId: string;
  code: string;
  before: number | null;
  after: number | null;
}

export interface FinanceDossier {
  company: Company;
  /** Ordre chronologique. */
  exercises: Exercise[];
  /** exerciceId → code REF → montant saisi (tel qu'il figure dans l'état, voir la convention de signe). */
  values: Record<string, Record<string, number>>;
  /** exerciceId → code REF → origine du montant. */
  origins: Record<string, Record<string, ValueOrigin>>;
  /** Journal des modifications après la première saisie ou l'import (borné). */
  corrections: Correction[];
}

export type FinanceProvenanceKind = "officiels" | "internes" | "reconstitues" | "pedagogiques" | "fictifs";

export const FINANCE_PROVENANCE_LABELS: Record<FinanceProvenanceKind, string> = {
  officiels: "États officiels (déposés ou certifiés)",
  internes: "États internes de l'entreprise, non audités",
  reconstitues: "États reconstitués par moi-même",
  pedagogiques: "Données pédagogiques (manuel, cours, exercice)",
  fictifs: "Données fictives de démonstration",
};

export const MAX_EXERCISES = 10;
export const MAX_CORRECTIONS = 2000;
