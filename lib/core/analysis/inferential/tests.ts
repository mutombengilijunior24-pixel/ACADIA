/**
 * Tests statistiques — calcul pur sur des tableaux de nombres ou d'effectifs.
 * Aucune dépendance à React ni aux données importées ; chaque fonction refuse explicitement
 * (ok: false + raison) les situations où le résultat ne serait pas calculable ou pas interprétable.
 */
import { mean, median, varianceSample } from "../descriptiveStatistics";

import { chiSquareUpperTail, fUpperTail, lnFactorial, normalQuantile, tQuantile, tTwoSidedP } from "./distributions";

export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: string };

export type CheckStatus = "ok" | "warning" | "failed";
export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

const sumOf = (values: number[]) => values.reduce((a, b) => a + b, 0);

/* ================================================================= */
/* Tableau croisé et test du Chi² d'indépendance                       */
/* ================================================================= */

export interface ChiSquareResult {
  observed: number[][];
  expected: number[][];
  rowTotals: number[];
  colTotals: number[];
  n: number;
  /** Contribution (O − E)² / E de chaque case. */
  contributions: number[][];
  statistic: number;
  df: number;
  pValue: number;
  cramersV: number;
  minExpected: number;
  cellsBelow5: number;
  cellsBelow1: number;
  /** Part des effectifs attendus < 5 (règle de Cochran : au plus 20 %). */
  shareBelow5: number;
  conditionsMet: boolean;
  checks: Check[];
  fisher?: FisherResult;
  /** Tableau 2 × 2 : mesures d'effet avec catégories de référence explicites. */
  twoByTwo?: TwoByTwoMeasures;
}

/**
 * Mesures d'un tableau 2 × 2 (lignes = groupes, colonnes = issue).
 * Groupe de référence : 1re ligne ; groupe comparé : 2e ligne ; issue étudiée : 1re colonne.
 */
export interface TwoByTwoMeasures {
  referenceRow: number;
  comparisonRow: number;
  eventColumn: number;
  /** Proportion de l'issue dans le groupe de référence et dans le groupe comparé. */
  pReference: number;
  pComparison: number;
  /** Différence p(comparé) − p(référence), en proportion (× 100 = points de pourcentage). */
  difference: number;
  differenceCi: [number, number];
  differenceCiMethod: string;
  riskRatio: number | null;
  riskRatioCi: [number, number] | null;
  oddsRatio: number | null;
  oddsRatioCi: [number, number] | null;
  /** Correction de Haldane-Anscombe (+0,5) appliquée à l'odds ratio et au risque relatif si une case vaut 0. */
  continuityCorrection: boolean;
  confidence: number;
}

/** Intervalle de Wilson d'une proportion. */
export function wilsonInterval(successes: number, n: number, z: number): [number, number] {
  if (n === 0) return [NaN, NaN];
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export function twoByTwoMeasures(table: number[][], alpha = 0.05): TwoByTwoMeasures {
  const z = normalQuantile(1 - alpha / 2);
  // Référence = ligne 0 (c = issue, d = autre) ; comparé = ligne 1 (a = issue, b = autre).
  const [[c, d], [a, b]] = table;
  const n1 = a + b;
  const n0 = c + d;
  const p1 = a / n1;
  const p0 = c / n0;
  const [l1, u1] = wilsonInterval(a, n1, z);
  const [l0, u0] = wilsonInterval(c, n0, z);
  const diff = p1 - p0;
  // Méthode 10 de Newcombe (1998) : combinaison des intervalles de Wilson.
  const differenceCi: [number, number] = [diff - Math.sqrt((p1 - l1) ** 2 + (u0 - p0) ** 2), diff + Math.sqrt((u1 - p1) ** 2 + (p0 - l0) ** 2)];
  const zero = a === 0 || b === 0 || c === 0 || d === 0;
  const k = zero ? 0.5 : 0;
  const A = a + k, B = b + k, C = c + k, D = d + k;
  const rr = (A / (A + B)) / (C / (C + D));
  const seLogRr = Math.sqrt(1 / A - 1 / (A + B) + 1 / C - 1 / (C + D));
  const or = (A * D) / (B * C);
  const seLogOr = Math.sqrt(1 / A + 1 / B + 1 / C + 1 / D);
  const ci = (estimate: number, se: number): [number, number] => [Math.exp(Math.log(estimate) - z * se), Math.exp(Math.log(estimate) + z * se)];
  const valid = Number.isFinite(rr) && rr > 0 && Number.isFinite(or) && or > 0;
  return {
    referenceRow: 0,
    comparisonRow: 1,
    eventColumn: 0,
    pReference: p0,
    pComparison: p1,
    difference: diff,
    differenceCi,
    differenceCiMethod: "Newcombe (1998), à partir des intervalles de Wilson",
    riskRatio: valid ? rr : null,
    riskRatioCi: valid ? ci(rr, seLogRr) : null,
    oddsRatio: valid ? or : null,
    oddsRatioCi: valid ? ci(or, seLogOr) : null,
    continuityCorrection: zero,
    confidence: 1 - alpha,
  };
}

export function chiSquareTest(observed: number[][]): Outcome<ChiSquareResult> {
  const rows = observed.length;
  const cols = observed[0]?.length ?? 0;
  if (rows < 2 || cols < 2) return { ok: false, reason: "Il faut au moins deux modalités observées pour chacune des deux variables." };
  const rowTotals = observed.map((row) => sumOf(row));
  const colTotals = observed[0].map((_, j) => sumOf(observed.map((row) => row[j])));
  const n = sumOf(rowTotals);
  if (rowTotals.some((t) => t === 0) || colTotals.some((t) => t === 0)) return { ok: false, reason: "Une modalité n'a aucune observation : retirez-la du tableau avant le test." };
  const expected = rowTotals.map((r) => colTotals.map((c) => (r * c) / n));
  const contributions = observed.map((row, i) => row.map((o, j) => (o - expected[i][j]) ** 2 / expected[i][j]));
  const statistic = sumOf(contributions.flat());
  const df = (rows - 1) * (cols - 1);
  const pValue = chiSquareUpperTail(statistic, df);
  const cramersV = Math.sqrt(statistic / (n * (Math.min(rows, cols) - 1)));
  const flatExpected = expected.flat();
  const minExpected = Math.min(...flatExpected);
  const cellsBelow5 = flatExpected.filter((e) => e < 5).length;
  const cellsBelow1 = flatExpected.filter((e) => e < 1).length;
  const shareBelow5 = cellsBelow5 / flatExpected.length;
  const conditionsMet = cellsBelow1 === 0 && shareBelow5 <= 0.2;
  const checks: Check[] = [
    {
      id: "expected",
      label: "Effectifs attendus suffisants (règle de Cochran)",
      status: conditionsMet ? "ok" : "failed",
      detail: `${cellsBelow5} case(s) sur ${flatExpected.length} ont un effectif attendu inférieur à 5 (${(shareBelow5 * 100).toFixed(0)} %, maximum toléré 20 %) ; ${cellsBelow1} case(s) inférieure(s) à 1 ; plus petit effectif attendu : ${minExpected.toFixed(2)}.`,
    },
    { id: "independence", label: "Observations indépendantes", status: "warning", detail: "Chaque observation doit compter une seule fois dans le tableau (pas de mesures répétées sur les mêmes individus) : à vérifier d'après votre plan de collecte." },
  ];
  const fisher = rows === 2 && cols === 2 ? fisherExact2x2(observed) : undefined;
  const twoByTwo = rows === 2 && cols === 2 ? twoByTwoMeasures(observed) : undefined;
  return { ok: true, value: { observed, expected, rowTotals, colTotals, n, contributions, statistic, df, pValue, cramersV, minExpected, cellsBelow5, cellsBelow1, shareBelow5, conditionsMet, checks, fisher, twoByTwo } };
}

export interface FisherResult {
  pValue: number;
  /** Rapport de cotes de l'échantillon (a·d)/(b·c), null si une case est nulle. */
  oddsRatio: number | null;
}

/**
 * Test exact de Fisher bilatéral pour un tableau 2×2 (loi hypergéométrique exacte) :
 * somme des probabilités des tableaux de mêmes marges au plus aussi probables que l'observé.
 */
export function fisherExact2x2(table: number[][]): FisherResult {
  const [[a, b], [c, d]] = table;
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const n = r1 + r2;
  const logP = (x: number) =>
    lnFactorial(r1) + lnFactorial(r2) + lnFactorial(c1) + lnFactorial(n - c1) - lnFactorial(n) - lnFactorial(x) - lnFactorial(r1 - x) - lnFactorial(c1 - x) - lnFactorial(r2 - c1 + x);
  const observed = logP(a);
  let p = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x += 1) {
    const lp = logP(x);
    // Tolérance relative identique à celle de R (fisher.test) pour les égalités numériques.
    if (lp <= observed + 1e-7) p += Math.exp(lp);
  }
  return { pValue: Math.min(1, p), oddsRatio: b * c === 0 ? null : (a * d) / (b * c) };
}

/* ================================================================= */
/* Test t de Welch (deux groupes indépendants)                          */
/* ================================================================= */

export interface GroupSummary {
  label: string;
  n: number;
  mean: number;
  sd: number;
  variance: number;
  median: number;
}

export interface WelchResult {
  groups: [GroupSummary, GroupSummary];
  difference: number;
  standardError: number;
  statistic: number;
  df: number;
  pValue: number;
  confidence: number;
  ci: [number, number];
  tCritical: number;
  pooledSd: number;
  cohensD: number;
  hedgesG: number;
  checks: Check[];
}

export function summarize(label: string, values: number[]): GroupSummary {
  const variance = varianceSample(values) ?? NaN;
  return { label, n: values.length, mean: mean(values) ?? NaN, sd: Math.sqrt(variance), variance, median: median(values) ?? NaN };
}

function outlierCount(values: number[]): number {
  if (values.length < 4) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const h = (sorted.length - 1) * p;
    const lo = Math.floor(h);
    return sorted[lo] + (h - lo) * ((sorted[Math.min(lo + 1, sorted.length - 1)] ?? sorted[lo]) - sorted[lo]);
  };
  const q1 = q(0.25);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  return values.filter((v) => v < q1 - 3 * iqr || v > q3 + 3 * iqr).length;
}

export function welchTTest(a: { label: string; values: number[] }, b: { label: string; values: number[] }, alpha = 0.05): Outcome<WelchResult> {
  if (a.values.length < 2 || b.values.length < 2) return { ok: false, reason: `Chaque groupe doit compter au moins 2 observations (« ${a.label} » : ${a.values.length}, « ${b.label} » : ${b.values.length}).` };
  const g1 = summarize(a.label, a.values);
  const g2 = summarize(b.label, b.values);
  const se1 = g1.variance / g1.n;
  const se2 = g2.variance / g2.n;
  const standardError = Math.sqrt(se1 + se2);
  if (standardError === 0) return { ok: false, reason: "Les valeurs sont constantes dans les deux groupes : la variabilité est nulle, le test t n'est pas calculable." };
  const difference = g1.mean - g2.mean;
  const statistic = difference / standardError;
  const df = (se1 + se2) ** 2 / (se1 ** 2 / (g1.n - 1) + se2 ** 2 / (g2.n - 1));
  const pValue = tTwoSidedP(statistic, df);
  const confidence = 1 - alpha;
  const tCritical = tQuantile(1 - alpha / 2, df);
  const ci: [number, number] = [difference - tCritical * standardError, difference + tCritical * standardError];
  const pooledSd = Math.sqrt(((g1.n - 1) * g1.variance + (g2.n - 1) * g2.variance) / (g1.n + g2.n - 2));
  const cohensD = pooledSd === 0 ? NaN : difference / pooledSd;
  const hedgesG = cohensD * (1 - 3 / (4 * (g1.n + g2.n) - 9));
  const small = [g1, g2].filter((g) => g.n < 15);
  const outliers = outlierCount(a.values) + outlierCount(b.values);
  const ratio = Math.max(g1.variance, g2.variance) / Math.max(Math.min(g1.variance, g2.variance), Number.MIN_VALUE);
  const checks: Check[] = [
    { id: "size", label: "Effectifs par groupe", status: small.length ? "warning" : "ok", detail: small.length ? `Effectif réduit (${small.map((g) => `« ${g.label} » : ${g.n}`).join(", ")}) : le test suppose alors une distribution à peu près normale dans chaque groupe, difficile à vérifier.` : `Effectifs de ${g1.n} et ${g2.n} : le test est robuste à un écart modéré à la normalité.` },
    { id: "outliers", label: "Valeurs extrêmes", status: outliers ? "warning" : "ok", detail: outliers ? `${outliers} valeur(s) très éloignée(s) (au-delà de 3 écarts interquartiles) : elles peuvent influencer fortement les moyennes.` : "Aucune valeur très éloignée détectée (règle des 3 écarts interquartiles)." },
    { id: "variances", label: "Égalité des variances", status: "ok", detail: `Non requise par le test de Welch (rapport des variances : ${Number.isFinite(ratio) ? ratio.toFixed(2) : "—"}).` },
  ];
  return { ok: true, value: { groups: [g1, g2], difference, standardError, statistic, df, pValue, confidence, ci, tCritical, pooledSd, cohensD, hedgesG, checks } };
}

/* ================================================================= */
/* Corrélations de Pearson et de Spearman                               */
/* ================================================================= */

export interface CorrelationResult {
  n: number;
  coefficient: number;
  statistic: number;
  df: number;
  pValue: number;
  confidence: number;
  ci: [number, number] | null;
  ciMethod: string;
  meanX: number;
  meanY: number;
  sdX: number;
  sdY: number;
  ties?: { x: number; y: number };
  checks: Check[];
}

function pearsonCore(x: number[], y: number[]): Outcome<{ r: number; mx: number; my: number; sx: number; sy: number }> {
  const n = x.length;
  const mx = sumOf(x) / n;
  const my = sumOf(y) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return { ok: false, reason: `${sxx === 0 ? "La première" : "La seconde"} variable est constante sur les observations retenues : une corrélation n'est pas définie.` };
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
  return { ok: true, value: { r, mx, my, sx: Math.sqrt(sxx / (n - 1)), sy: Math.sqrt(syy / (n - 1)) } };
}

function correlationInference(r: number, n: number, alpha: number, seZ: number) {
  const df = n - 2;
  const perfect = Math.abs(r) === 1;
  const statistic = perfect ? Math.sign(r) * Infinity : r * Math.sqrt(df / (1 - r * r));
  const pValue = perfect ? 0 : tTwoSidedP(statistic, df);
  let ci: [number, number] | null = null;
  if (!perfect && n > 3) {
    const z = Math.atanh(r);
    const half = normalQuantile(1 - alpha / 2) * seZ;
    ci = [Math.tanh(z - half), Math.tanh(z + half)];
  }
  return { df, statistic, pValue, ci };
}

export function pearsonCorrelation(x: number[], y: number[], alpha = 0.05): Outcome<CorrelationResult> {
  const n = x.length;
  if (n < 3) return { ok: false, reason: `Au moins 3 observations complètes sont nécessaires (${n} disponible(s)).` };
  const core = pearsonCore(x, y);
  if (!core.ok) return core;
  const { r, mx, my, sx, sy } = core.value;
  const inference = correlationInference(r, n, alpha, 1 / Math.sqrt(n - 3));
  const outliers = outlierCount(x) + outlierCount(y);
  const checks: Check[] = [
    { id: "size", label: "Nombre d'observations", status: n < 10 ? "warning" : "ok", detail: n < 10 ? `${n} observations : l'estimation est très imprécise.` : `${n} observations complètes.` },
    { id: "linearity", label: "Relation linéaire", status: "warning", detail: "Pearson ne mesure que la composante linéaire : une relation courbe peut donner un coefficient faible. Examinez le nuage de points." },
    { id: "outliers", label: "Valeurs extrêmes", status: outliers ? "warning" : "ok", detail: outliers ? `${outliers} valeur(s) très éloignée(s) : elles peuvent déterminer à elles seules le coefficient ; comparez avec Spearman.` : "Aucune valeur très éloignée détectée." },
  ];
  return {
    ok: true,
    value: {
      n,
      coefficient: r,
      ...inference,
      confidence: 1 - alpha,
      ciMethod: inference.ci ? "transformation de Fisher (z = atanh r, erreur type 1/√(n − 3))" : Math.abs(r) === 1 ? "non calculé : corrélation parfaite" : "non calculé : moins de 4 observations",
      meanX: mx,
      meanY: my,
      sdX: sx,
      sdY: sy,
      checks,
    },
  };
}

/** Rangs moyens (ex æquo : moyenne des rangs occupés), rangs commençant à 1. */
export function averageRanks(values: number[]): { ranks: number[]; tiedValues: number } {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(values.length);
  let tiedValues = 0;
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j += 1;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[order[k].index] = rank;
    if (j > i) tiedValues += j - i + 1;
    i = j + 1;
  }
  return { ranks, tiedValues };
}

export function spearmanCorrelation(x: number[], y: number[], alpha = 0.05): Outcome<CorrelationResult> {
  const n = x.length;
  if (n < 3) return { ok: false, reason: `Au moins 3 observations complètes sont nécessaires (${n} disponible(s)).` };
  const rx = averageRanks(x);
  const ry = averageRanks(y);
  const core = pearsonCore(rx.ranks, ry.ranks);
  if (!core.ok) return core;
  const r = core.value.r;
  // Erreur type de Fieller, Hartley et Pearson (1957) pour z(ρs) : √(1,06 / (n − 3)).
  const inference = correlationInference(r, n, alpha, Math.sqrt(1.06 / (n - 3)));
  const checks: Check[] = [
    { id: "size", label: "Nombre d'observations", status: n < 10 ? "warning" : "ok", detail: n < 10 ? `${n} observations : la p-value (approximation par la loi t) est peu précise pour de si petits effectifs.` : `${n} observations complètes.` },
    { id: "ties", label: "Ex æquo", status: rx.tiedValues + ry.tiedValues > n / 2 ? "warning" : "ok", detail: `${rx.tiedValues} valeur(s) ex æquo pour la première variable, ${ry.tiedValues} pour la seconde (rangs moyens attribués).` },
    { id: "monotonic", label: "Relation monotone", status: "ok", detail: "Spearman mesure une relation monotone (toujours croissante ou toujours décroissante), linéaire ou non." },
  ];
  return {
    ok: true,
    value: {
      n,
      coefficient: r,
      ...inference,
      confidence: 1 - alpha,
      ciMethod: inference.ci ? "transformation de Fisher avec l'erreur type de Fieller et al. (1957), approximative" : Math.abs(r) === 1 ? "non calculé : corrélation parfaite des rangs" : "non calculé : moins de 4 observations",
      meanX: mean(x) ?? NaN,
      meanY: mean(y) ?? NaN,
      sdX: Math.sqrt(varianceSample(x) ?? NaN),
      sdY: Math.sqrt(varianceSample(y) ?? NaN),
      ties: { x: rx.tiedValues, y: ry.tiedValues },
      checks,
    },
  };
}

/* ================================================================= */
/* ANOVA à un facteur                                                   */
/* ================================================================= */

export interface AnovaResult {
  groups: GroupSummary[];
  grandMean: number;
  n: number;
  ssBetween: number;
  ssWithin: number;
  ssTotal: number;
  dfBetween: number;
  dfWithin: number;
  msBetween: number;
  msWithin: number;
  statistic: number;
  pValue: number;
  etaSquared: number;
  omegaSquared: number;
  levene: { statistic: number; df1: number; df2: number; pValue: number } | null;
  checks: Check[];
}

interface AnovaCore {
  ssBetween: number;
  ssWithin: number;
  dfBetween: number;
  dfWithin: number;
  grandMean: number;
  n: number;
}

function anovaCore(groups: number[][]): AnovaCore {
  const all = groups.flat();
  const n = all.length;
  const grandMean = sumOf(all) / n;
  let ssBetween = 0;
  let ssWithin = 0;
  for (const group of groups) {
    const m = sumOf(group) / group.length;
    ssBetween += group.length * (m - grandMean) ** 2;
    for (const v of group) ssWithin += (v - m) ** 2;
  }
  return { ssBetween, ssWithin, dfBetween: groups.length - 1, dfWithin: n - groups.length, grandMean, n };
}

/** Test de Brown-Forsythe (Levene centré sur la médiane) : ANOVA sur |x − médiane du groupe|. */
export function brownForsythe(groups: number[][]): { statistic: number; df1: number; df2: number; pValue: number } | null {
  const deviations = groups.map((g) => {
    const m = median(g) ?? 0;
    return g.map((v) => Math.abs(v - m));
  });
  const core = anovaCore(deviations);
  if (core.dfWithin <= 0 || core.ssWithin === 0) return null;
  const statistic = core.ssBetween / core.dfBetween / (core.ssWithin / core.dfWithin);
  return { statistic, df1: core.dfBetween, df2: core.dfWithin, pValue: fUpperTail(statistic, core.dfBetween, core.dfWithin) };
}

export function oneWayAnova(groups: Array<{ label: string; values: number[] }>): Outcome<AnovaResult> {
  if (groups.length < 2) return { ok: false, reason: "Il faut au moins deux groupes comportant des observations." };
  const tooSmall = groups.filter((g) => g.values.length < 2);
  if (tooSmall.length) return { ok: false, reason: `Chaque groupe doit compter au moins 2 observations (${tooSmall.map((g) => `« ${g.label} » : ${g.values.length}`).join(", ")}).` };
  const core = anovaCore(groups.map((g) => g.values));
  const ssTotal = core.ssBetween + core.ssWithin;
  if (core.ssWithin === 0) return { ok: false, reason: "Les valeurs sont constantes à l'intérieur de chaque groupe : la variance intra-groupe est nulle, la statistique F n'est pas définie." };
  const msBetween = core.ssBetween / core.dfBetween;
  const msWithin = core.ssWithin / core.dfWithin;
  const statistic = msBetween / msWithin;
  const pValue = fUpperTail(statistic, core.dfBetween, core.dfWithin);
  const etaSquared = core.ssBetween / ssTotal;
  const omegaSquared = Math.max(0, (core.ssBetween - core.dfBetween * msWithin) / (ssTotal + msWithin));
  const summaries = groups.map((g) => summarize(g.label, g.values));
  const levene = brownForsythe(groups.map((g) => g.values));
  const sizes = summaries.map((g) => g.n);
  const unbalanced = Math.max(...sizes) / Math.min(...sizes) > 1.5;
  const outliers = groups.reduce((acc, g) => acc + outlierCount(g.values), 0);
  const heterogeneous = !!levene && levene.pValue < 0.05;
  const checks: Check[] = [
    {
      id: "variances",
      label: "Homogénéité des variances (test de Brown-Forsythe)",
      status: !levene ? "warning" : heterogeneous ? (unbalanced ? "failed" : "warning") : "ok",
      detail: !levene
        ? "Test non calculable (dispersion nulle autour des médianes)."
        : `F = ${levene.statistic.toFixed(3)}, p = ${levene.pValue < 0.001 ? "< 0,001" : levene.pValue.toFixed(3).replace(".", ",")}. ${heterogeneous ? `Les variances semblent différer${unbalanced ? " et les groupes sont déséquilibrés : le résultat de l'ANOVA classique peut être nettement faussé. Une ANOVA de Welch serait plus adaptée (non encore disponible)." : " ; avec des groupes de tailles proches, l'ANOVA reste assez robuste, mais interprétez avec prudence."}` : "Pas d'indice d'hétérogénéité marquée des variances."}`,
    },
    { id: "size", label: "Effectifs par groupe", status: sizes.some((s) => s < 10) ? "warning" : "ok", detail: `Effectifs : ${summaries.map((g) => `${g.label} = ${g.n}`).join(", ")}.${sizes.some((s) => s < 10) ? " Avec moins de 10 observations dans un groupe, la normalité des résidus est difficile à vérifier." : ""}` },
    { id: "balance", label: "Équilibre des groupes", status: unbalanced ? "warning" : "ok", detail: unbalanced ? "Groupes de tailles très différentes : l'ANOVA est alors plus sensible à l'inégalité des variances." : "Groupes de tailles comparables." },
    { id: "outliers", label: "Valeurs extrêmes", status: outliers ? "warning" : "ok", detail: outliers ? `${outliers} valeur(s) très éloignée(s) dans les groupes.` : "Aucune valeur très éloignée détectée." },
  ];
  return {
    ok: true,
    value: {
      groups: summaries,
      grandMean: core.grandMean,
      n: core.n,
      ssBetween: core.ssBetween,
      ssWithin: core.ssWithin,
      ssTotal,
      dfBetween: core.dfBetween,
      dfWithin: core.dfWithin,
      msBetween,
      msWithin,
      statistic,
      pValue,
      etaSquared,
      omegaSquared,
      levene,
      checks,
    },
  };
}
