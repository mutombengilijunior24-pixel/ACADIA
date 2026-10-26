/**
 * Valeurs d'un exercice : montants saisis, totaux calculés à partir de leurs composantes,
 * postes vides d'un état fourni (comptés à zéro, confirmé par l'étudiant à la validation),
 * états absents (valeurs inconnues : jamais remplacées par zéro).
 */
import { hashKey } from "@/lib/core/understanding/text";

import { POSTE_BY_CODE, POSTES, STATEMENT_OF, type StatementId } from "./syscohada/chart";
import { MAX_CORRECTIONS, type Company, type Correction, type Exercise, type FinanceDossier, type ValueOrigin } from "./types";

export interface Resolved {
  /** Montant retenu (saisi, sinon calculé, sinon 0 si l'état est fourni) ; null si l'état n'est pas fourni. */
  value: number | null;
  origin: "saisi" | "calcule" | "vide" | "absent";
  /** Totaux : somme des composantes (null si l'état n'est pas fourni). */
  computed: number | null;
  /** Totaux : au moins une composante a été saisie (la comparaison saisi / calculé a un sens). */
  fromDetail: boolean;
}

export type ExerciseValues = Record<string, Resolved>;

/** États fournis pour un exercice : au moins un montant saisi dans l'état. */
export function providedStatements(dossier: FinanceDossier, exerciseId: string): Set<StatementId> {
  const provided = new Set<StatementId>();
  for (const code of Object.keys(dossier.values[exerciseId] ?? {})) {
    const poste = POSTE_BY_CODE[code];
    if (poste) provided.add(STATEMENT_OF[poste.section]);
  }
  return provided;
}

/** Contribution d'un poste à un total. */
export const contribution = (code: string, value: number) => (POSTE_BY_CODE[code].kind === "total" ? value : POSTE_BY_CODE[code].sign * value);

export function resolveExercise(dossier: FinanceDossier, exerciseId: string): ExerciseValues {
  const entered = dossier.values[exerciseId] ?? {};
  const provided = providedStatements(dossier, exerciseId);
  const out: ExerciseValues = {};
  const resolve = (code: string): Resolved => {
    if (out[code]) return out[code];
    const poste = POSTE_BY_CODE[code];
    const isProvided = provided.has(STATEMENT_OF[poste.section]);
    let result: Resolved;
    if (poste.kind === "poste") {
      result = code in entered ? { value: entered[code], origin: "saisi", computed: null, fromDetail: false } : isProvided ? { value: 0, origin: "vide", computed: null, fromDetail: false } : { value: null, origin: "absent", computed: null, fromDetail: false };
    } else {
      const children = (poste.sum ?? []).map((c) => [c, resolve(c)] as const);
      const fromDetail = children.some(([, r]) => r.origin === "saisi" || r.fromDetail);
      const computed = isProvided ? children.reduce((acc, [c, r]) => acc + contribution(c, r.value ?? 0), 0) : null;
      if (code in entered) result = { value: entered[code], origin: "saisi", computed, fromDetail };
      else if (computed !== null) result = { value: computed, origin: fromDetail ? "calcule" : "vide", computed, fromDetail };
      else result = { value: null, origin: "absent", computed: null, fromDetail: false };
    }
    out[code] = result;
    return result;
  };
  for (const poste of POSTES) resolve(poste.code);
  return out;
}

export function resolveAll(dossier: FinanceDossier): Record<string, ExerciseValues> {
  return Object.fromEntries(dossier.exercises.map((e) => [e.id, resolveExercise(dossier, e.id)]));
}

/** Nombre de mois d'un exercice (arrondi), ou null si les dates sont invalides. */
export function exerciseMonths(exercise: Pick<Exercise, "start" | "end">): number | null {
  const start = Date.parse(exercise.start);
  const end = Date.parse(exercise.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.max(1, Math.round((end - start + 86_400_000) / (86_400_000 * 30.4375)));
}

/** Empreinte des chiffres (la validation devient « à revoir » si elle change). */
export const statementsKey = (dossier: FinanceDossier) => hashKey({ company: dossier.company, exercises: dossier.exercises, values: dossier.values });

export function emptyCompany(): Company {
  return { name: "", sector: "commerce", currency: "CDF", currencyOther: "", unit: 1000, city: "" };
}

export function newExercise(year: number, id = `ex-${year}`): Exercise {
  return { id, label: String(year), start: `${year}-01-01`, end: `${year}-12-31` };
}

export function emptyDossier(): FinanceDossier {
  const year = new Date().getFullYear() - 1;
  return { company: emptyCompany(), exercises: [newExercise(year)], values: {}, origins: {}, corrections: [] };
}

/** Saisie ou effacement d'un montant (journalisé si le montant existait déjà). */
export function setValue(dossier: FinanceDossier, exerciseId: string, code: string, value: number | null, origin: ValueOrigin = "saisie"): FinanceDossier {
  const current = dossier.values[exerciseId] ?? {};
  const before = code in current ? current[code] : null;
  if (before === value) return dossier;
  const nextValues = { ...current };
  const nextOrigins = { ...(dossier.origins[exerciseId] ?? {}) };
  if (value === null) {
    delete nextValues[code];
    delete nextOrigins[code];
  } else {
    nextValues[code] = value;
    nextOrigins[code] = origin;
  }
  const corrections: Correction[] = before !== null ? [...dossier.corrections, { at: new Date().toISOString(), exerciseId, code, before, after: value }].slice(-MAX_CORRECTIONS) : dossier.corrections;
  return { ...dossier, values: { ...dossier.values, [exerciseId]: nextValues }, origins: { ...dossier.origins, [exerciseId]: nextOrigins }, corrections };
}

/** Exercices triés par date de clôture. */
export const sortedExercises = (exercises: Exercise[]) => [...exercises].sort((a, b) => a.end.localeCompare(b.end));
