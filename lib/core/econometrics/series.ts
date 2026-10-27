/**
 * Séries temporelles : transformations (logarithme, différence, taux de croissance) et statistiques
 * descriptives. Une valeur non calculable reste « null » (jamais NaN, jamais inventée) ; une transformation
 * qui n'a pas de sens (logarithme d'une valeur négative) le dit au lieu de produire un chiffre.
 */
import type { Transform } from "./types";

export type Values = Array<number | null>;

export const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Applique une transformation ; `issue` explique pourquoi certaines valeurs n'ont pas pu être calculées. */
export function transform(values: Values, t: Transform): { values: Values; issue: string | null } {
  if (t === "niveau") return { values: [...values], issue: null };
  if (t === "log") {
    const bad = values.some((v) => isNum(v) && v <= 0);
    return { values: values.map((v) => (isNum(v) && v > 0 ? Math.log(v) : null)), issue: bad ? "Le logarithme n'existe pas pour une valeur nulle ou négative : ces périodes sont écartées." : null };
  }
  if (t === "diff") return { values: values.map((v, i) => (i > 0 && isNum(v) && isNum(values[i - 1]) ? v - (values[i - 1] as number) : null)), issue: null };
  const bad = values.some((v, i) => i > 0 && isNum(v) && isNum(values[i - 1]) && (values[i - 1] as number) === 0);
  return {
    values: values.map((v, i) => (i > 0 && isNum(v) && isNum(values[i - 1]) && (values[i - 1] as number) !== 0 ? (v / (values[i - 1] as number) - 1) * 100 : null)),
    issue: bad ? "Un taux de croissance ne peut pas être calculé à partir d'une valeur nulle." : null,
  };
}

/** Taux de croissance (%) d'une période à l'autre. */
export const growth = (values: Values) => transform(values, "croissance").values;

export interface DescriptiveStats {
  n: number;
  missing: number;
  mean: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  /** Coefficient de variation (écart-type / moyenne × 100), si la moyenne n'est pas nulle. */
  cv: number | null;
  first: number | null;
  last: number | null;
  /** Taux de croissance annuel (ou périodique) moyen entre la première et la dernière valeur, en %. */
  tcam: number | null;
  /** Indices (dans la série) du minimum et du maximum. */
  minIndex: number | null;
  maxIndex: number | null;
}

export function describe(values: Values): DescriptiveStats {
  const present = values.map((v, i) => [v, i] as const).filter((x): x is readonly [number, number] => isNum(x[0]));
  const n = present.length;
  const missing = values.length - n;
  if (!n) return { n, missing, mean: null, sd: null, min: null, max: null, cv: null, first: null, last: null, tcam: null, minIndex: null, maxIndex: null };
  const xs = present.map(([v]) => v);
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : null;
  let minI = 0;
  let maxI = 0;
  present.forEach(([v], j) => {
    if (v < present[minI][0]) minI = j;
    if (v > present[maxI][0]) maxI = j;
  });
  const [first, firstIndex] = present[0];
  const [last, lastIndex] = present[n - 1];
  const span = lastIndex - firstIndex;
  const tcam = span > 0 && first > 0 && last > 0 ? ((last / first) ** (1 / span) - 1) * 100 : null;
  return { n, missing, mean, sd, min: present[minI][0], max: present[maxI][0], cv: sd !== null && mean !== 0 ? (sd / Math.abs(mean)) * 100 : null, first, last, tcam, minIndex: present[minI][1], maxIndex: present[maxI][1] };
}

/** Coefficient de corrélation de Pearson sur les périodes communes (null si moins de 3 paires). */
export function correlation(a: Values, b: Values): number | null {
  const pairs = a.map((v, i) => [v, b[i]] as const).filter((p): p is readonly [number, number] => isNum(p[0]) && isNum(p[1]));
  if (pairs.length < 3) return null;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const my = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

/** Sens de l'évolution entre la première et la dernière valeur. */
export function trendWord(stats: DescriptiveStats): "hausse" | "baisse" | "stabilité" | null {
  if (stats.first === null || stats.last === null) return null;
  const base = Math.abs(stats.first) || 1;
  const rel = (stats.last - stats.first) / base;
  return Math.abs(rel) < 0.02 ? "stabilité" : rel > 0 ? "hausse" : "baisse";
}
