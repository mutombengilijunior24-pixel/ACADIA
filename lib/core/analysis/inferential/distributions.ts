/**
 * Lois de probabilité utilisées par les tests (bibliothèque stdlib, licence Apache-2.0 / BSL-1.0).
 * Les p-values sont obtenues par les relations exactes entre ces lois et les fonctions
 * gamma et bêta incomplètes régularisées — aucune approximation ad hoc.
 */
import betainc from "@stdlib/math-base-special-betainc";
import gammainc from "@stdlib/math-base-special-gammainc";
import gammaln from "@stdlib/math-base-special-gammaln";
import normalQuantileStd from "@stdlib/stats-base-dists-normal-quantile";
import tQuantileStd from "@stdlib/stats-base-dists-t-quantile";

/** P(X ≥ x) pour X ~ χ²(df) : Q(df/2, x/2), gamma incomplète supérieure régularisée. */
export function chiSquareUpperTail(x: number, df: number): number {
  if (!(df > 0) || !Number.isFinite(x)) return NaN;
  if (x <= 0) return 1;
  return gammainc(x / 2, df / 2, true, true);
}

/** P(|T| ≥ |t|) pour T ~ t(df) : I_{df/(df+t²)}(df/2, 1/2). */
export function tTwoSidedP(t: number, df: number): number {
  if (!(df > 0) || Number.isNaN(t)) return NaN;
  if (!Number.isFinite(t)) return 0;
  return betainc(df / (df + t * t), df / 2, 0.5, true, false);
}

/** P(F ≥ f) pour F ~ F(d1, d2) : I_{d2/(d2+d1·f)}(d2/2, d1/2). */
export function fUpperTail(f: number, d1: number, d2: number): number {
  if (!(d1 > 0) || !(d2 > 0) || Number.isNaN(f)) return NaN;
  if (f <= 0) return 1;
  if (!Number.isFinite(f)) return 0;
  return betainc(d2 / (d2 + d1 * f), d2 / 2, d1 / 2, true, false);
}

export function tQuantile(p: number, df: number): number {
  return tQuantileStd(p, df);
}

export function normalQuantile(p: number): number {
  return normalQuantileStd(p, 0, 1);
}

export function lnFactorial(n: number): number {
  return gammaln(n + 1);
}
