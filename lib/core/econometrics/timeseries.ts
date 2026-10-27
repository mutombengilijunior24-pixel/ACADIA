/**
 * Tests économétriques des séries temporelles, calculés de façon déterministe :
 * - stationnarité : Dickey-Fuller augmenté (ADF), retards choisis par le critère d'Akaike, valeurs
 *   critiques de MacKinnon (2010) ajustées à la taille de l'échantillon ;
 * - cointégration : méthode en deux étapes d'Engle et Granger (ADF sur les résidus, valeurs critiques de
 *   MacKinnon pour la cointégration) ;
 * - autocorrélation des erreurs : Durbin-Watson et test LM de Breusch-Godfrey ;
 * - causalité au sens de Granger (précédence temporelle, jamais une causalité économique prouvée).
 * Toute statistique non calculable (trop peu d'observations, matrice singulière) vaut null avec sa raison.
 */
import { chiSquarePValue, fStatisticPValue, studentTTwoTailedPValue } from "@/lib/core/analysis/BivariateStatistics";
import { invert, multiply, multiplyVector, transpose } from "@/lib/core/analysis/Matrix";

import { isNum, type Values } from "./series";

/* ----------------------------------- MCO de base ----------------------------------- */

export interface Fit {
  beta: number[];
  se: Array<number | null>;
  t: Array<number | null>;
  p: Array<number | null>;
  residuals: number[];
  sse: number;
  n: number;
  /** Nombre de paramètres estimés (constante comprise si présente). */
  params: number;
  df: number;
  r2: number | null;
}

/** MCO sur une matrice de régresseurs déjà construite (la constante, si voulue, est une colonne de 1). */
export function fitDesign(design: number[][], y: number[]): Fit | null {
  const n = y.length;
  const params = design[0]?.length ?? 0;
  if (!params || n !== design.length || n <= params) return null;
  const xt = transpose(design);
  const inv = invert(multiply(xt, design));
  if (!inv) return null;
  const beta = multiplyVector(inv, multiplyVector(xt, y));
  const fitted = design.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  const residuals = y.map((v, i) => v - fitted[i]);
  const sse = residuals.reduce((s, e) => s + e * e, 0);
  const df = n - params;
  const mse = sse / df;
  const se = inv.map((row, i) => (row[i] * mse >= 0 ? Math.sqrt(row[i] * mse) : null));
  const t = beta.map((b, i) => (se[i] ? b / (se[i] as number) : null));
  const p = t.map((v) => (v === null ? null : studentTTwoTailedPValue(v, df)));
  const mean = y.reduce((a, b) => a + b, 0) / n;
  const sst = y.reduce((s, v) => s + (v - mean) ** 2, 0);
  // R² centré seulement si la régression contient une constante (une colonne entièrement égale à 1).
  const hasConstant = Array.from({ length: params }, (_, j) => j).some((j) => design.every((row) => row[j] === 1));
  const r2 = sst > 0 ? (hasConstant ? 1 - sse / sst : null) : null;
  return { beta, se, t, p, residuals, sse, n, params, df, r2 };
}

/* -------------------------------- Valeurs critiques -------------------------------- */

export type Deterministic = "n" | "c" | "ct";

export const DETERMINISTIC_LABELS: Record<Deterministic, string> = { n: "sans constante", c: "avec constante", ct: "avec constante et tendance" };

/** MacKinnon (2010), tableau 2 : coefficients β∞, β1, β2, β3 pour 1 %, 5 % et 10 %, selon le nombre N de variables. */
const MACKINNON: Record<number, Partial<Record<Deterministic, number[][]>>> = {
  1: {
    n: [[-2.56574, -2.2358, -3.627, 0], [-1.941, -0.2686, -3.365, 31.223], [-1.61682, 0.2656, -2.714, 25.364]],
    c: [[-3.43035, -6.5393, -16.786, -79.433], [-2.86154, -2.8903, -4.234, -40.04], [-2.56677, -1.5384, -2.809, 0]],
    ct: [[-3.95877, -9.0531, -28.428, -134.155], [-3.41049, -4.3904, -9.036, -45.374], [-3.12705, -2.5856, -3.925, -22.38]],
  },
  2: { c: [[-3.89644, -10.9519, -22.527, 0], [-3.33613, -6.1101, -6.823, 0], [-3.04445, -4.2412, -2.72, 0]] },
  3: { c: [[-4.29374, -14.4354, -33.195, 47.433], [-3.74066, -8.5631, -10.852, 27.982], [-3.45218, -6.2143, -3.718, 0]] },
};

/** Valeurs critiques (1 %, 5 %, 10 %) pour T observations ; null si non disponibles. */
export function criticalValues(T: number, det: Deterministic, N = 1): { p1: number; p5: number; p10: number } | null {
  const table = MACKINNON[N]?.[det];
  if (!table || T <= 0) return null;
  const at = ([b0, b1, b2, b3]: number[]) => b0 + b1 / T + b2 / T ** 2 + b3 / T ** 3;
  return { p1: at(table[0]), p5: at(table[1]), p10: at(table[2]) };
}

/* ------------------------------------- ADF ------------------------------------- */

export const ADF_MIN_OBS = 10;

export interface AdfResult {
  deterministic: Deterministic;
  lags: number;
  /** Observations effectivement utilisées dans la régression. */
  nobs: number;
  stat: number | null;
  critical: { p1: number; p5: number; p10: number } | null;
  /** Rejet de la racine unitaire au seuil de 5 % : série stationnaire. */
  stationary: boolean | null;
  /** Seuil le plus exigeant auquel la racine unitaire est rejetée. */
  level: "1 %" | "5 %" | "10 %" | null;
  reason: string | null;
}

/** Observations consécutives (sans trou) : l'ADF exige une série continue. */
const contiguous = (values: Values): number[] => {
  let best: number[] = [];
  let cur: number[] = [];
  for (const v of values) {
    if (isNum(v)) cur.push(v);
    else {
      if (cur.length > best.length) best = cur;
      cur = [];
    }
  }
  return cur.length > best.length ? cur : best;
};

function adfRegression(y: number[], lags: number, det: Deterministic, start: number) {
  const dy = y.slice(1).map((v, i) => v - y[i]);
  const rows: number[][] = [];
  const target: number[] = [];
  // t indexe dy (dy[t] = y[t+1] − y[t]) ; on commence à `start` pour un échantillon commun.
  for (let t = start; t < dy.length; t += 1) {
    const row: number[] = [y[t]];
    for (let i = 1; i <= lags; i += 1) row.push(dy[t - i]);
    if (det !== "n") row.push(1);
    if (det === "ct") row.push(t + 1);
    rows.push(row);
    target.push(dy[t]);
  }
  return fitDesign(rows, target);
}

/** Test ADF : Δy_t = α + βt + γ·y_{t−1} + Σ δ_i·Δy_{t−i} + ε_t ; H0 : γ = 0 (racine unitaire). */
export function adf(values: Values, det: Deterministic = "c", maxLags?: number): AdfResult {
  const y = contiguous(values);
  const empty = (reason: string): AdfResult => ({ deterministic: det, lags: 0, nobs: Math.max(0, y.length - 1), stat: null, critical: null, stationary: null, level: null, reason });
  if (y.length < ADF_MIN_OBS) return empty(`Test non réalisable : ${y.length} observation(s) consécutive(s), il en faut au moins ${ADF_MIN_OBS}.`);
  const T = y.length;
  // Retards maximaux : règle courte de Schwert, int(4·(T/100)^¼) — 2 retards pour 20 à 30 observations —,
  // bornée pour garder assez de degrés de liberté sur un échantillon court.
  const schwert = Math.floor(4 * (T / 100) ** 0.25);
  const pmax = Math.max(0, Math.min(maxLags ?? schwert, Math.floor((T - 6) / 3)));
  let best: { lags: number; aic: number } | null = null;
  for (let p = 0; p <= pmax; p += 1) {
    const fit = adfRegression(y, p, det, pmax);
    if (!fit || fit.sse <= 0) continue;
    const aic = fit.n * Math.log(fit.sse / fit.n) + 2 * fit.params;
    if (!best || aic < best.aic) best = { lags: p, aic };
  }
  const lags = best?.lags ?? 0;
  const fit = adfRegression(y, lags, det, lags);
  if (!fit || fit.t[0] === null) return empty("Test non réalisable : la régression de Dickey-Fuller ne peut pas être estimée (série constante ou trop courte).");
  const stat = fit.t[0] as number;
  const critical = criticalValues(fit.n, det);
  const level = critical ? (stat < critical.p1 ? "1 %" : stat < critical.p5 ? "5 %" : stat < critical.p10 ? "10 %" : null) : null;
  return { deterministic: det, lags, nobs: fit.n, stat, critical, stationary: critical ? stat < critical.p5 : null, level, reason: null };
}

export interface IntegrationOrder {
  /** 0 : stationnaire en niveau ; 1 : stationnaire en différence première ; 2 : au moins I(2) ; null : indéterminé. */
  order: 0 | 1 | 2 | null;
  level: { c: AdfResult; ct: AdfResult };
  difference: AdfResult | null;
  /** Explication en une phrase, en langage économétrique. */
  summary: string;
}

/**
 * Ordre d'intégration : ADF en niveau (avec constante, puis avec constante et tendance), puis en différence
 * première si la racine unitaire n'est pas rejetée en niveau. Seuil de décision : 5 %.
 */
export function integrationOrder(values: Values, name: string): IntegrationOrder {
  const c = adf(values, "c");
  const ct = adf(values, "ct");
  if (c.stat === null && ct.stat === null) return { order: null, level: { c, ct }, difference: null, summary: `${name} : stationnarité non testable (${c.reason ?? "données insuffisantes"}).` };
  if (c.stationary || ct.stationary) {
    const which = c.stationary ? "avec constante" : "avec constante et tendance (stationnaire autour d'une tendance)";
    return { order: 0, level: { c, ct }, difference: null, summary: `${name} est stationnaire en niveau, I(0) : la racine unitaire est rejetée au seuil de 5 % (ADF ${which}).` };
  }
  const dvalues = values.map((v, i) => (i > 0 && isNum(v) && isNum(values[i - 1]) ? v - (values[i - 1] as number) : null));
  const d = adf(dvalues, "c");
  if (d.stat === null) return { order: null, level: { c, ct }, difference: d, summary: `${name} n'est pas stationnaire en niveau ; le test en différence première n'est pas réalisable (${d.reason}).` };
  if (d.stationary) return { order: 1, level: { c, ct }, difference: d, summary: `${name} est intégrée d'ordre 1, I(1) : non stationnaire en niveau, stationnaire en différence première (seuil de 5 %).` };
  return { order: 2, level: { c, ct }, difference: d, summary: `${name} n'est stationnaire ni en niveau ni en différence première : au moins I(2), à traiter avec votre encadreur.` };
}

/* ------------------------------- Autocorrélation ------------------------------- */

/** Statistique de Durbin-Watson : proche de 2 sans autocorrélation d'ordre 1, vers 0 si positive, vers 4 si négative. */
export function durbinWatson(residuals: number[]): number | null {
  const sse = residuals.reduce((s, e) => s + e * e, 0);
  if (residuals.length < 3 || sse === 0) return null;
  let num = 0;
  for (let t = 1; t < residuals.length; t += 1) num += (residuals[t] - residuals[t - 1]) ** 2;
  return num / sse;
}

export interface LmTest {
  statistic: number | null;
  df: number;
  pValue: number | null;
}

/** Breusch-Godfrey (ordre p) : régression des résidus sur les régresseurs et p résidus retardés ; LM = n·R² ~ χ²(p). */
export function breuschGodfrey(design: number[][], residuals: number[], order = 1): LmTest {
  const n = residuals.length;
  const rows = design.map((row, t) => [...row, ...Array.from({ length: order }, (_, i) => (t - i - 1 >= 0 ? residuals[t - i - 1] : 0))]);
  const aux = fitDesign(rows, residuals);
  if (!aux || aux.r2 === null) return { statistic: null, df: order, pValue: null };
  const lm = n * Math.max(0, aux.r2);
  return { statistic: lm, df: order, pValue: chiSquarePValue(lm, order) };
}

/* ---------------------------------- Cointégration ---------------------------------- */

export const COINTEGRATION_MIN_OBS = 15;

export interface CointegrationResult {
  available: boolean;
  stat: number | null;
  critical: { p1: number; p5: number; p10: number } | null;
  cointegrated: boolean | null;
  lags: number;
  nobs: number;
  reason: string | null;
}

/**
 * Engle-Granger : (1) relation de long terme y = a + Σ b·x estimée par les MCO ; (2) ADF sans constante sur
 * les résidus, comparé aux valeurs critiques de MacKinnon pour N variables (y compris y). N ≤ 3.
 */
export function engleGranger(residuals: number[], nVariables: number): CointegrationResult {
  if (nVariables > 3) return { available: false, stat: null, critical: null, cointegrated: null, lags: 0, nobs: residuals.length, reason: "Test d'Engle-Granger proposé jusqu'à deux variables explicatives ; au-delà, utilisez l'approche de Johansen avec votre encadreur." };
  if (residuals.length < COINTEGRATION_MIN_OBS) return { available: false, stat: null, critical: null, cointegrated: null, lags: 0, nobs: residuals.length, reason: `Test non réalisable : ${residuals.length} observations, il en faut au moins ${COINTEGRATION_MIN_OBS}.` };
  const r = adf(residuals, "n");
  if (r.stat === null) return { available: false, stat: null, critical: null, cointegrated: null, lags: 0, nobs: residuals.length, reason: r.reason };
  const critical = criticalValues(r.nobs, "c", nVariables);
  return { available: true, stat: r.stat, critical, cointegrated: critical ? r.stat < critical.p5 : null, lags: r.lags, nobs: r.nobs, reason: null };
}

/* ------------------------------ Causalité de Granger ------------------------------ */

export interface GrangerResult {
  lags: number;
  f: number | null;
  pValue: number | null;
  nobs: number;
  reason: string | null;
}

/** x « cause au sens de Granger » y si les valeurs passées de x améliorent la prévision de y (test F). Séries stationnaires requises. */
export function granger(y: Values, x: Values, lags = 1): GrangerResult {
  const rowsU: number[][] = [];
  const rowsR: number[][] = [];
  const target: number[] = [];
  for (let t = lags; t < y.length; t += 1) {
    const yl = Array.from({ length: lags }, (_, i) => y[t - i - 1]);
    const xl = Array.from({ length: lags }, (_, i) => x[t - i - 1]);
    if (!isNum(y[t]) || !yl.every(isNum) || !xl.every(isNum)) continue;
    rowsR.push([1, ...(yl as number[])]);
    rowsU.push([1, ...(yl as number[]), ...(xl as number[])]);
    target.push(y[t] as number);
  }
  const nobs = target.length;
  if (nobs < 3 * lags + 8) return { lags, f: null, pValue: null, nobs, reason: `Test non réalisable : ${nobs} observations utilisables pour ${lags} retard(s).` };
  const u = fitDesign(rowsU, target);
  const r = fitDesign(rowsR, target);
  if (!u || !r || u.sse <= 0) return { lags, f: null, pValue: null, nobs, reason: "Test non réalisable : régression impossible à estimer." };
  const f = ((r.sse - u.sse) / lags) / (u.sse / u.df);
  return { lags, f, pValue: fStatisticPValue(Math.max(0, f), lags, u.df), nobs, reason: null };
}
