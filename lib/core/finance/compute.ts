/**
 * Calcul de tous les indicateurs, pour chaque exercice : valeur, zone (favorable / à surveiller /
 * défavorable) selon les repères du secteur, tendance. Un indicateur non calculable l'est avec sa
 * raison (postes manquants, division par zéro, exercice précédent absent, indicateur sans objet).
 */
import { AGGREGATES, DEFAULT_PARAMS, type FinanceParams } from "./indicators/aggregates";
import { INDICATORS } from "./indicators/catalogue";
import type { Bands, IndicatorDef } from "./indicators/types";
import { evaluate, parseFormula, type Evaluation, type Node } from "./formula";
import { exerciseMonths, providedStatements, resolveExercise, sortedExercises, type ExerciseValues } from "./statements";
import { POSTE_BY_CODE } from "./syscohada/chart";
import type { Exercise, FinanceDossier } from "./types";

export type Zone = "favorable" | "vigilance" | "defavorable";

export interface IndicatorValue {
  value: number | null;
  status: "ok" | "missing" | "zero_division" | "no_previous" | "not_significant" | "statement_missing";
  /** Postes manquants (statut « missing »). */
  missing?: string[];
  /** Raison lisible quand la valeur n'est pas calculée. */
  reason?: string;
  zone: Zone | null;
}

export interface IndicatorSeries {
  def: IndicatorDef;
  bands: Bands | null;
  values: IndicatorValue[];
}

export interface FinanceComputation {
  exercises: Exercise[];
  values: ExerciseValues[];
  series: Record<string, IndicatorSeries>;
  params: FinanceParams;
}

const parsed = new Map<string, Node>();
export const nodeOf = (formula: string) => {
  let node = parsed.get(formula);
  if (!node) {
    node = parseFormula(formula);
    parsed.set(formula, node);
  }
  return node;
};

export const bandsFor = (def: IndicatorDef, sector: FinanceDossier["company"]["sector"]): Bands | null => (def.norms ? (def.norms.bySector?.[sector] ?? def.norms.default) : null);

export function zoneOf(def: IndicatorDef, value: number, bands: Bands | null): Zone | null {
  if (!bands || def.direction === "neutral") return null;
  if (def.direction === "higher") return value >= bands.good ? "favorable" : value < bands.bad ? "defavorable" : "vigilance";
  return value <= bands.good ? "favorable" : value > bands.bad ? "defavorable" : "vigilance";
}

const MESSAGES = {
  zero_division: "division par zéro (dénominateur nul)",
  no_previous: "il faut l'exercice précédent",
} as const;

export function computeFinance(dossier: FinanceDossier, params: FinanceParams = DEFAULT_PARAMS): FinanceComputation {
  const exercises = sortedExercises(dossier.exercises);
  const values = exercises.map((e) => resolveExercise(dossier, e.id));
  const provided = exercises.map((e) => providedStatements(dossier, e.id));
  const aggregateCache = new Map<string, Evaluation>();
  const resolve = (name: string, index: number): Evaluation => {
    if (index < 0 || index >= exercises.length) return { ok: false, reason: "no_previous" };
    if (POSTE_BY_CODE[name]) {
      const v = values[index][name].value;
      return v === null ? { ok: false, reason: "missing", codes: [name] } : { ok: true, value: v };
    }
    if (name === "tva") return { ok: true, value: params.tva };
    if (name === "taux_is") return { ok: true, value: params.taux_is };
    if (name === "jours") return { ok: true, value: (exerciseMonths(exercises[index]) ?? 12) * 30 };
    const aggregate = AGGREGATES[name];
    if (!aggregate) throw new Error(`Identifiant inconnu dans une formule : ${name}`);
    const key = `${name}@${index}`;
    if (!aggregateCache.has(key)) aggregateCache.set(key, evaluate(nodeOf(aggregate.formula), index, resolve));
    return aggregateCache.get(key)!;
  };

  const series: Record<string, IndicatorSeries> = {};
  for (const def of INDICATORS) {
    const bands = bandsFor(def, dossier.company.sector);
    const out: IndicatorValue[] = exercises.map((_, index) => {
      const absent = def.requires.filter((s) => !provided[index].has(s));
      if (absent.length) return { value: null, status: "statement_missing", reason: `état non fourni pour cet exercice (${absent.map((s) => ({ bilan: "bilan", cr: "compte de résultat", tft: "tableau des flux de trésorerie" })[s]).join(", ")})`, zone: null };
      if (def.minExercises && index + 1 < def.minExercises) return { value: null, status: "no_previous", reason: MESSAGES.no_previous, zone: null };
      if (def.guard) {
        const g = evaluate(nodeOf(def.guard.formula), index, resolve);
        if (g.ok && g.value <= 0) return { value: null, status: "not_significant", reason: def.guard.reason, zone: null };
      }
      const r = evaluate(nodeOf(def.formula), index, resolve);
      if (r.ok) return Number.isFinite(r.value) ? { value: r.value, status: "ok", zone: zoneOf(def, r.value, bands) } : { value: null, status: "zero_division", reason: MESSAGES.zero_division, zone: null };
      if (r.reason === "missing") return { value: null, status: "missing", missing: r.codes, reason: `postes manquants : ${r.codes.join(", ")}`, zone: null };
      return { value: null, status: r.reason, reason: MESSAGES[r.reason], zone: null };
    });
    series[def.id] = { def, bands, values: out };
  }
  return { exercises, values, series, params };
}

/** Sens de l'évolution entre le premier et le dernier exercice calculés (seuil : 2 % relatif ou 0,5 point). */
export function trendOf(series: IndicatorSeries): "hausse" | "baisse" | "stable" | null {
  const points = series.values.filter((v) => v.value !== null).map((v) => v.value!);
  if (points.length < 2) return null;
  const first = points[0];
  const last = points.at(-1)!;
  const unit = series.def.unit;
  const threshold = unit === "pct" || unit === "points" ? 0.005 : unit === "jours" ? 2 : Math.max(Math.abs(first) * 0.02, 1e-9);
  if (last - first > threshold) return "hausse";
  if (first - last > threshold) return "baisse";
  return "stable";
}

/** Défavorable = va dans le mauvais sens selon le sens de l'indicateur. */
export function isDeterioration(series: IndicatorSeries, from: number, to: number): boolean {
  const a = series.values[from]?.value;
  const b = series.values[to]?.value;
  if (a === null || a === undefined || b === null || b === undefined || series.def.direction === "neutral") return false;
  return series.def.direction === "higher" ? b < a : b > a;
}
