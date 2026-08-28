// ============================================================
// ACADIA — MOTEUR ÉCONOMÉTRIQUE : FONCTIONS PURES (P8.49)
//
// MCO (moindres carrés ordinaires) par équations normales
// β = (X'X)⁻¹X'Y — approche standard, adaptée à la taille des
// échantillons visés (mémoires SEG, quelques dizaines à
// quelques centaines d'observations), sans dépendance externe
// (audit confirmé : aucune librairie numérique dans le projet).
//
// P8.60 — CALCUL STATISTIQUE = MOTEUR DÉTERMINISTE. Aucun appel
// OpenAI ici, jamais. Comme StatisticsMath (P6) et
// BivariateStatistics (P7) : jamais NaN/Infinity en sortie
// publique — `null` explicite lorsqu'un résultat n'est pas
// calculable (matrice singulière, degrés de liberté insuffisants,
// variance nulle...).
// ============================================================

import { invert, multiply, multiplyVector, transpose, type Matrix } from "./Matrix";
import { chiSquarePValue, fStatisticPValue, studentTTwoTailedPValue } from "./BivariateStatistics";

export { fStatisticPValue };


// ============================================================
// VALEUR CRITIQUE DE STUDENT (IC 95 %) — inversion par bissection
// de studentTTwoTailedPValue, monotone décroissante en t (t ≥ 0).
// ============================================================

export function tCriticalValue(df: number, alpha: number = 0.05): number | null {
  if (!Number.isFinite(df) || df <= 0) return null;

  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const p = studentTTwoTailedPValue(mid, df);
    if (p === null) return null;
    if (p > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}


// ============================================================
// MCO (P8.49 — calculateOLS)
// ============================================================

export interface OLSResult {
  /** [intercept, β1, β2, ...] */
  coefficients: number[];

  fitted: number[];

  residuals: number[];

  n: number;

  /** Nombre de régresseurs explicatifs, intercept exclu. */
  k: number;

  sse: number;
  ssr: number;
  sst: number;

  r2: number | null;
  adjustedR2: number | null;

  /** Même ordre que `coefficients` (intercept inclus). `null` par coefficient si non calculable. */
  standardErrors: (number | null)[];
  tStatistics: (number | null)[];
  pValues: (number | null)[];
  confidenceIntervals: ([number, number] | null)[];

  fStatistic: number | null;
  fPValue: number | null;

  /** Conservée pour les diagnostics dérivés (VIF, leviers/Cook) — jamais recalculée deux fois. */
  xtxInverse: Matrix;

  meanSquaredError: number | null;

  degreesOfFreedomResidual: number;
}

/**
 * `X` ne contient PAS la colonne d'intercept (ajoutée ici). Renvoie
 * `null` si l'estimation est mathématiquement impossible (pas assez
 * de degrés de liberté, matrice X'X singulière — colinéarité
 * parfaite) plutôt qu'un résultat inventé.
 */
export function calculateOLS(X: number[][], y: number[]): OLSResult | null {
  const n = y.length;
  if (n === 0 || X.length !== n) return null;

  const k = X[0]?.length ?? 0;
  const p = k + 1; // paramètres, intercept inclus
  if (n <= p) return null; // pas assez de degrés de liberté

  const design: Matrix = X.map((row) => [1, ...row]);
  const designT = transpose(design);
  const XtX = multiply(designT, design);
  const xtxInverse = invert(XtX);
  if (!xtxInverse) return null; // singularité — colinéarité parfaite entre régresseurs

  const XtY = multiplyVector(designT, y);
  const coefficients = multiplyVector(xtxInverse, XtY);

  const fitted = design.map((row) => row.reduce((sum, v, j) => sum + v * coefficients[j], 0));
  const residuals = y.map((yi, i) => yi - fitted[i]);

  const meanY = y.reduce((a, b) => a + b, 0) / n;
  const sst = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);
  const sse = residuals.reduce((sum, e) => sum + e * e, 0);
  const ssr = sst - sse;

  const degreesOfFreedomResidual = n - p;
  const r2 = sst > 0 ? Math.max(0, Math.min(1, ssr / sst)) : null;
  const adjustedR2 =
    r2 !== null && degreesOfFreedomResidual > 0 ? 1 - (1 - r2) * (n - 1) / degreesOfFreedomResidual : null;

  const meanSquaredError = degreesOfFreedomResidual > 0 ? sse / degreesOfFreedomResidual : null;

  const standardErrors: (number | null)[] = xtxInverse.map((row, i) => {
    if (meanSquaredError === null) return null;
    const variance = meanSquaredError * row[i];
    return variance >= 0 ? Math.sqrt(variance) : null;
  });

  const tStatistics: (number | null)[] = coefficients.map((b, i) => {
    const se = standardErrors[i];
    if (se === null || se === 0) return null;
    return b / se;
  });

  const pValues: (number | null)[] = tStatistics.map((t) => {
    if (t === null || degreesOfFreedomResidual <= 0) return null;
    return studentTTwoTailedPValue(t, degreesOfFreedomResidual);
  });

  const tCrit = degreesOfFreedomResidual > 0 ? tCriticalValue(degreesOfFreedomResidual, 0.05) : null;
  const confidenceIntervals: ([number, number] | null)[] = coefficients.map((b, i) => {
    const se = standardErrors[i];
    if (se === null || tCrit === null) return null;
    return [b - tCrit * se, b + tCrit * se];
  });

  let fStatistic: number | null = null;
  let fPValue: number | null = null;
  if (k > 0 && degreesOfFreedomResidual > 0 && sse > 0) {
    fStatistic = ssr / k / (sse / degreesOfFreedomResidual);
    fPValue = fStatisticPValue(fStatistic, k, degreesOfFreedomResidual);
  }

  return {
    coefficients,
    fitted,
    residuals,
    n,
    k,
    sse,
    ssr,
    sst,
    r2,
    adjustedR2,
    standardErrors,
    tStatistics,
    pValues,
    confidenceIntervals,
    fStatistic,
    fPValue,
    xtxInverse,
    meanSquaredError,
    degreesOfFreedomResidual,
  };
}


// ============================================================
// VIF — MULTICOLINÉARITÉ (P8.49 — calculateVIF)
//
// VIF_j = 1 / (1 - R²_j), où R²_j provient de la régression
// auxiliaire de X_j sur les autres régresseurs. `null` si non
// pertinent (un seul régresseur) ou non calculable (colinéarité
// parfaite dans la régression auxiliaire elle-même).
// ============================================================

export function calculateVIF(X: number[][]): (number | null)[] {
  const k = X[0]?.length ?? 0;
  if (k < 2) return X.length > 0 ? new Array(k).fill(null) : [];

  const result: (number | null)[] = [];
  for (let j = 0; j < k; j++) {
    const yAux = X.map((row) => row[j]);
    const xAux = X.map((row) => row.filter((_, idx) => idx !== j));
    const aux = calculateOLS(xAux, yAux);
    if (!aux || aux.r2 === null || aux.r2 >= 1) {
      result.push(null);
      continue;
    }
    result.push(1 / (1 - aux.r2));
  }
  return result;
}


// ============================================================
// HÉTÉROSCÉDASTICITÉ — TEST DE BREUSCH-PAGAN
//
// LM = n·R²(régression auxiliaire des résidus² sur X) ~ χ²(k)
// sous H0 (homoscédasticité).
// ============================================================

export interface HeteroscedasticityResult {
  statistic: number | null;
  degreesOfFreedom: number;
  pValue: number | null;
}

export function breuschPaganTest(X: number[][], residuals: number[]): HeteroscedasticityResult {
  const k = X[0]?.length ?? 0;
  const squaredResiduals = residuals.map((e) => e * e);
  const aux = calculateOLS(X, squaredResiduals);
  if (!aux || aux.r2 === null) {
    return { statistic: null, degreesOfFreedom: k, pValue: null };
  }
  const lm = aux.n * aux.r2;
  return { statistic: lm, degreesOfFreedom: k, pValue: chiSquarePValue(lm, k) };
}


// ============================================================
// NORMALITÉ DES RÉSIDUS — TEST DE JARQUE-BERA
//
// JB = (n/6)·(S² + (K-3)²/4) ~ χ²(2) sous H0 (normalité).
// ============================================================

export interface NormalityResult {
  statistic: number | null;
  pValue: number | null;
  skewness: number | null;
  kurtosis: number | null;
}

export function jarqueBeraTest(residuals: number[]): NormalityResult {
  const n = residuals.length;
  if (n < 8) {
    // Trop peu d'observations pour une lecture fiable des moments d'ordre 3/4.
    return { statistic: null, pValue: null, skewness: null, kurtosis: null };
  }

  const mean = residuals.reduce((a, b) => a + b, 0) / n;
  const m2 = residuals.reduce((sum, e) => sum + (e - mean) ** 2, 0) / n;
  const m3 = residuals.reduce((sum, e) => sum + (e - mean) ** 3, 0) / n;
  const m4 = residuals.reduce((sum, e) => sum + (e - mean) ** 4, 0) / n;

  if (m2 === 0) {
    return { statistic: null, pValue: null, skewness: null, kurtosis: null };
  }

  const skewness = m3 / Math.pow(m2, 1.5);
  const kurtosis = m4 / (m2 * m2);
  const jb = (n / 6) * (skewness ** 2 + (kurtosis - 3) ** 2 / 4);

  return { statistic: jb, pValue: chiSquarePValue(jb, 2), skewness, kurtosis };
}


// ============================================================
// OBSERVATIONS INFLUENTES — DISTANCE DE COOK
//
// D_i = (e_i² / (p·MSE))·(h_ii / (1-h_ii)²), h_ii = levier
// (diagonale de la matrice chapeau). Seuil usuel D_i > 4/n signalé
// comme repère descriptif — jamais une suppression automatique.
// ============================================================

export interface InfluenceResult {
  rowIndex: number;
  leverage: number;
  cooksDistance: number;
  flagged: boolean;
}

export function calculateCooksDistance(
  X: number[][],
  residuals: number[],
  xtxInverse: Matrix,
  meanSquaredError: number
): InfluenceResult[] {
  const n = residuals.length;
  const design = X.map((row) => [1, ...row]);
  const p = design[0]?.length ?? 1;

  return design.map((xi, i) => {
    const temp = xtxInverse.map((row) => row.reduce((sum, v, j) => sum + v * xi[j], 0));
    const leverage = xi.reduce((sum, v, j) => sum + v * temp[j], 0);
    const ei = residuals[i];

    const cooksDistance =
      meanSquaredError > 0 && leverage < 1
        ? (ei * ei / (p * meanSquaredError)) * (leverage / (1 - leverage) ** 2)
        : 0;

    return { rowIndex: i, leverage, cooksDistance, flagged: cooksDistance > 4 / n };
  });
}
