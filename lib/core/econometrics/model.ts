/**
 * Spécification et estimation d'un modèle économétrique par les moindres carrés ordinaires (MCO) :
 * Y_t = β0 + β1·X1_t + … + βk·Xk_t + ε_t, sur les variables transformées (niveau, logarithme, différence
 * première, taux de croissance). Les MCO et leurs diagnostics réutilisent le moteur statistique d'ACADIA.
 */
import { breuschPaganTest, calculateOLS, calculateVIF, jarqueBeraTest } from "@/lib/core/analysis/EconometricStatistics";

import { computeAggregates } from "./aggregates";
import { ROLE_BY_ID } from "./roles";
import { isNum, transform, type Values } from "./series";
import { breuschGodfrey, durbinWatson, type LmTest } from "./timeseries";
import { TRANSFORM_LABELS, type MacroDataset, type Transform, type VariableRef } from "./types";

export interface ModelSpec {
  dependent: VariableRef | null;
  regressors: VariableRef[];
  /** Transformation commune : niveau (modèle linéaire), log (log-log : élasticités), différence, croissance. */
  transform: Transform;
}

export const emptySpec = (): ModelSpec => ({ dependent: null, regressors: [], transform: "niveau" });

export interface ResolvedVariable {
  ref: VariableRef;
  label: string;
  unit: string;
  values: Values;
  /** Formule de l'agrégat, si c'en est un. */
  formula: string | null;
}

export const refKey = (ref: VariableRef) => `${ref.kind}:${ref.id}`;

/** Variables utilisables : séries saisies et agrégats calculés. */
export function availableVariables(dataset: MacroDataset): ResolvedVariable[] {
  const series = dataset.series.map((s) => ({ ref: { kind: "series" as const, id: s.id }, label: s.name || ROLE_BY_ID[s.role]?.label || "Série", unit: s.unit, values: s.values, formula: null }));
  const aggregates = computeAggregates(dataset).map((a) => ({ ref: { kind: "aggregate" as const, id: a.def.id }, label: a.def.label, unit: a.def.unit, values: a.values, formula: a.def.formula }));
  return [...series, ...aggregates];
}

export function resolveVariable(dataset: MacroDataset, ref: VariableRef, all = availableVariables(dataset)): ResolvedVariable | null {
  return all.find((v) => v.ref.kind === ref.kind && v.ref.id === ref.id) ?? null;
}

/** Nom de la variable telle qu'elle entre dans le modèle. */
export function transformedName(label: string, t: Transform): string {
  if (t === "log") return `ln(${label})`;
  if (t === "diff") return `Δ ${label}`;
  if (t === "croissance") return `Croissance de ${label.charAt(0).toLowerCase()}${label.slice(1)} (%)`;
  return label;
}

export interface CoefficientRow {
  name: string;
  ref: VariableRef | null;
  beta: number;
  se: number | null;
  t: number | null;
  p: number | null;
  ci: [number, number] | null;
  stars: string;
}

export const starsOf = (p: number | null) => (p === null ? "" : p < 0.01 ? "***" : p < 0.05 ? "**" : p < 0.1 ? "*" : "");

export interface Estimation {
  /** Périodes effectivement utilisées. */
  periods: string[];
  periodIndexes: number[];
  n: number;
  k: number;
  dependentName: string;
  rows: CoefficientRow[];
  r2: number | null;
  adjR2: number | null;
  f: number | null;
  fP: number | null;
  dw: number | null;
  bg: LmTest;
  bp: { statistic: number | null; degreesOfFreedom: number; pValue: number | null };
  jb: { statistic: number | null; pValue: number | null; skewness: number | null; kurtosis: number | null };
  vif: Array<{ name: string; value: number | null }>;
  observed: number[];
  fitted: number[];
  residuals: number[];
  /** Équation estimée lisible : Y = 1,23 + 0,45·X1 − 0,07·X2. */
  equation: string;
}

export interface Assembled {
  periods: string[];
  periodIndexes: number[];
  y: number[];
  X: number[][];
  dependentName: string;
  regressorNames: string[];
  /** Séries transformées complètes (une valeur par période du jeu de données), pour les tests. */
  dependentSeries: Values;
  regressorSeries: Values[];
  issues: string[];
}

const fmt = (v: number, d = 3) => v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Variables transformées et périodes communes (où toutes les variables du modèle sont disponibles). */
export function assemble(dataset: MacroDataset, spec: ModelSpec): Assembled | null {
  if (!spec.dependent || !spec.regressors.length) return null;
  const all = availableVariables(dataset);
  const dep = resolveVariable(dataset, spec.dependent, all);
  const regs = spec.regressors.map((r) => resolveVariable(dataset, r, all));
  if (!dep || regs.some((r) => !r)) return null;
  const issues: string[] = [];
  const tdep = transform(dep.values, spec.transform);
  if (tdep.issue) issues.push(`${dep.label} : ${tdep.issue}`);
  const tregs = (regs as ResolvedVariable[]).map((r) => {
    const t = transform(r.values, spec.transform);
    if (t.issue) issues.push(`${r.label} : ${t.issue}`);
    return t.values;
  });
  const periods: string[] = [];
  const periodIndexes: number[] = [];
  const y: number[] = [];
  const X: number[][] = [];
  dataset.periods.forEach((p, i) => {
    const yi = tdep.values[i];
    const xi = tregs.map((v) => v[i]);
    if (isNum(yi) && xi.every(isNum)) {
      periods.push(p);
      periodIndexes.push(i);
      y.push(yi);
      X.push(xi as number[]);
    }
  });
  return { periods, periodIndexes, y, X, dependentName: transformedName(dep.label, spec.transform), regressorNames: (regs as ResolvedVariable[]).map((r) => transformedName(r.label, spec.transform)), dependentSeries: tdep.values, regressorSeries: tregs, issues };
}

/** Estimation MCO et diagnostics ; null si le modèle n'est pas estimable (raison dans `assemble` / readiness). */
export function estimate(data: Assembled, refs: VariableRef[]): Estimation | null {
  const ols = calculateOLS(data.X, data.y);
  if (!ols) return null;
  const names = ["Constante", ...data.regressorNames];
  const rows: CoefficientRow[] = ols.coefficients.map((beta, i) => ({ name: names[i], ref: i === 0 ? null : refs[i - 1] ?? null, beta, se: ols.standardErrors[i], t: ols.tStatistics[i], p: ols.pValues[i], ci: ols.confidenceIntervals[i], stars: starsOf(ols.pValues[i]) }));
  const design = data.X.map((row) => [1, ...row]);
  const vif = calculateVIF(data.X).map((value, j) => ({ name: data.regressorNames[j], value }));
  const terms = rows.slice(1).map((r) => `${r.beta < 0 ? "−" : "+"} ${fmt(Math.abs(r.beta))}·${r.name}`);
  const equation = `${data.dependentName} = ${fmt(rows[0].beta)} ${terms.join(" ")}`;
  return {
    periods: data.periods,
    periodIndexes: data.periodIndexes,
    n: ols.n,
    k: ols.k,
    dependentName: data.dependentName,
    rows,
    r2: ols.r2,
    adjR2: ols.adjustedR2,
    f: ols.fStatistic,
    fP: ols.fPValue,
    dw: durbinWatson(ols.residuals),
    bg: breuschGodfrey(design, ols.residuals, 1),
    bp: breuschPaganTest(data.X, ols.residuals),
    jb: jarqueBeraTest(ols.residuals),
    vif,
    observed: data.y,
    fitted: ols.fitted,
    residuals: ols.residuals,
    equation,
  };
}

/** Lecture d'un coefficient selon la forme du modèle (toujours « associé à », jamais « cause »). */
export function coefficientReading(row: CoefficientRow, dependentLabel: string, regressorLabel: string, t: Transform, unitY: string, unitX: string): string {
  const b = row.beta;
  const sens = b >= 0 ? "hausse" : "baisse";
  const abs = Math.abs(b);
  if (t === "log") return `Une hausse de 1 % de ${regressorLabel} est associée à une ${sens} de ${fmt(abs, 2)} % de ${dependentLabel}, toutes choses égales par ailleurs (élasticité).`;
  if (t === "croissance") return `Une hausse d'un point du taux de croissance de ${regressorLabel} est associée à une ${sens} de ${fmt(abs, 2)} point(s) du taux de croissance de ${dependentLabel}, toutes choses égales par ailleurs.`;
  if (t === "diff") return `Une augmentation d'une unité de la variation de ${regressorLabel} (${unitX || "unité"}) d'une période à l'autre est associée à une ${sens} de ${fmt(abs, 3)} ${unitY || "unité(s)"} de la variation de ${dependentLabel}, toutes choses égales par ailleurs.`;
  // Deux taux (en %) : lecture en points de pourcentage.
  if (unitX === "%" && unitY === "%") return `Une hausse d'un point de ${regressorLabel} est associée à une ${sens} de ${fmt(abs, 2)} point de pourcentage de ${dependentLabel}, toutes choses égales par ailleurs.`;
  return `Une hausse d'une unité de ${regressorLabel} (${unitX || "unité"}) est associée à une ${sens} de ${fmt(abs, 3)} ${unitY || "unité(s)"} de ${dependentLabel}, toutes choses égales par ailleurs.`;
}

/** Minuscule initiale, sauf pour un sigle (« IPC », « M2 », « PIB »). */
export const lowerFirst = (s: string) => (/^[A-Z0-9]{2,}\b/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

export const specLabel = (t: Transform) => (t === "log" ? "modèle log-log (coefficients = élasticités)" : t === "niveau" ? "modèle linéaire en niveau" : t === "diff" ? "modèle en différences premières" : "modèle en taux de croissance");

export { TRANSFORM_LABELS };
