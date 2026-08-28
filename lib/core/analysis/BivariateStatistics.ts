// ============================================================
// ACADIA — STATISTIQUES BIVARIÉES : FONCTIONS PURES (P7.38)
//
// Aucune dépendance externe (pas de librairie de calcul
// statistique dans le projet — voir audit P7). Les fonctions de
// distribution (p-value) utilisent des approximations numériques
// standard (Lanczos pour Gamma, séries/fractions continues pour
// les fonctions Gamma et Bêta incomplètes régularisées — méthode
// « Numerical Recipes »), volontairement transcrites et testées
// contre des valeurs de référence connues plutôt qu'ajouter une
// dépendance.
//
// Comme StatisticsMath.ts (P6) : jamais NaN/Infinity en sortie
// publique — `null` explicite lorsqu'un résultat n'est pas
// calculable, jamais une valeur inventée.
// ============================================================

function mean(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}


// ============================================================
// FONCTIONS SPÉCIALES (Gamma / Bêta incomplètes régularisées)
// ============================================================

function logGamma(x: number): number {
  const g = 7;
  const coefficients = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const xm1 = x - 1;
  let a = coefficients[0];
  const t = xm1 + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += coefficients[i] / (xm1 + i);
  return 0.5 * Math.log(2 * Math.PI) + (xm1 + 0.5) * Math.log(t) - t + Math.log(a);
}

function gammaPSeries(s: number, x: number): number {
  if (x <= 0) return 0;
  let sum = 1 / s;
  let term = sum;
  let n = s;
  for (let i = 0; i < 200; i++) {
    n += 1;
    term *= x / n;
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
  }
  return sum * Math.exp(-x + s * Math.log(x) - logGamma(s));
}

function gammaQContinuedFraction(s: number, x: number): number {
  const FPMIN = 1e-300;
  let b = x + 1 - s;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.exp(-x + s * Math.log(x) - logGamma(s)) * h;
}

/** Q(s,x) — fonction Gamma incomplète supérieure régularisée. */
function upperIncompleteGammaRegularized(s: number, x: number): number {
  if (x < 0 || s <= 0) return NaN;
  if (x === 0) return 1;
  if (x < s + 1) return 1 - gammaPSeries(s, x);
  return gammaQContinuedFraction(s, x);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/**
 * I_x(a,b) — fonction Bêta incomplète régularisée. Exportée : réutilisée
 * par EconometricStatistics.ts (P8) pour la p-value du test F, plutôt que
 * de dupliquer la machinerie Bêta/Gamma incomplète dans un second fichier.
 */
export function incompleteBetaRegularized(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - logBeta);
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}


// ============================================================
// P-VALUES
// ============================================================

/** p-value du test du χ² (loi du χ² à `df` degrés de liberté). */
export function chiSquarePValue(chiSquare: number, df: number): number | null {
  if (!Number.isFinite(chiSquare) || !Number.isFinite(df) || df <= 0 || chiSquare < 0) return null;
  if (chiSquare === 0) return 1;
  const p = upperIncompleteGammaRegularized(df / 2, chiSquare / 2);
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : null;
}

/** p-value bilatérale d'une statistique de Student t à `df` degrés de liberté. */
export function studentTTwoTailedPValue(t: number, df: number): number | null {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return null;
  if (t === 0) return 1;
  const x = df / (df + t * t);
  const p = incompleteBetaRegularized(df / 2, 0.5, x);
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : null;
}

/**
 * p-value (test unilatéral supérieur) d'une statistique F à (d1, d2)
 * degrés de liberté — utilisée par le test F global de la régression
 * MCO (P8, EconometricStatistics.ts).
 */
export function fStatisticPValue(f: number, d1: number, d2: number): number | null {
  if (!Number.isFinite(f) || f < 0 || d1 <= 0 || d2 <= 0) return null;
  if (f === 0) return 1;
  const x = d2 / (d2 + d1 * f);
  const p = incompleteBetaRegularized(d2 / 2, d1 / 2, x);
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : null;
}


// ============================================================
// CORRÉLATIONS (P7.10 / P7.11)
// ============================================================

export interface CorrelationResult {
  coefficient: number | null;
  n: number;
  pValue: number | null;
  warnings: string[];
}

export function calculatePearsonCorrelation(pairs: [number, number][]): CorrelationResult {
  const warnings: string[] = [];
  const n = pairs.length;

  if (n < 3) {
    if (n > 0) warnings.push("Effectif insuffisant pour calculer une corrélation de Pearson (n < 3).");
    return { coefficient: null, n, pValue: null, warnings };
  }

  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const meanX = mean(xs);
  const meanY = mean(ys);

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) {
    warnings.push("Au moins une des deux variables ne présente aucune variation dans l'échantillon — corrélation non calculable.");
    return { coefficient: null, n, pValue: null, warnings };
  }

  const r = Math.max(-1, Math.min(1, num / Math.sqrt(denX * denY)));

  let pValue: number | null = null;
  if (Math.abs(r) >= 1) {
    pValue = 0;
  } else {
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    pValue = studentTTwoTailedPValue(t, n - 2);
  }

  return { coefficient: r, n, pValue, warnings };
}

/** Rangs moyens (gestion des ex aequo) — base du calcul de Spearman. */
function rankValues(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const ranks: number[] = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const averageRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = averageRank;
    i = j + 1;
  }
  return ranks;
}

/**
 * rho de Spearman = corrélation de Pearson calculée sur les rangs
 * (formule correcte y compris en présence d'ex aequo, via rangs
 * moyens) — réutilise calculatePearsonCorrelation plutôt que
 * dupliquer la logique.
 */
export function calculateSpearmanCorrelation(pairs: [number, number][]): CorrelationResult {
  const n = pairs.length;
  if (n < 3) {
    const warnings = n > 0 ? ["Effectif insuffisant pour calculer une corrélation de Spearman (n < 3)."] : [];
    return { coefficient: null, n, pValue: null, warnings };
  }

  const ranksX = rankValues(pairs.map((p) => p[0]));
  const ranksY = rankValues(pairs.map((p) => p[1]));
  const rankedPairs: [number, number][] = ranksX.map((rx, i) => [rx, ranksY[i]]);

  const result = calculatePearsonCorrelation(rankedPairs);
  return { ...result, n };
}


// ============================================================
// TABLEAU CROISÉ (P7.4 / P7.5 / P7.6)
// ============================================================

export interface ContingencyTable {
  rowLabels: string[];
  colLabels: string[];
  /** counts[rowIndex][colIndex] */
  counts: number[][];
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
}

export function buildContingencyTable(
  rowValues: string[],
  colValues: string[],
  rowLabels: string[],
  colLabels: string[]
): ContingencyTable {
  const counts: number[][] = rowLabels.map(() => colLabels.map(() => 0));
  const rowIndex = new Map(rowLabels.map((l, i) => [l, i]));
  const colIndex = new Map(colLabels.map((l, i) => [l, i]));

  const n = Math.min(rowValues.length, colValues.length);
  for (let k = 0; k < n; k++) {
    const ri = rowIndex.get(rowValues[k]);
    const ci = colIndex.get(colValues[k]);
    if (ri === undefined || ci === undefined) continue;
    counts[ri][ci] += 1;
  }

  const rowTotals = counts.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = colLabels.map((_, ci) => counts.reduce((sum, row) => sum + row[ci], 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

  return { rowLabels, colLabels, counts, rowTotals, colTotals, grandTotal };
}

/** % calculés par LIGNE (chaque ligne totalise 100 %) — P7.5. */
export function calculateRowPercentages(table: ContingencyTable): number[][] {
  return table.counts.map((row, ri) =>
    row.map((c) => (table.rowTotals[ri] > 0 ? (c / table.rowTotals[ri]) * 100 : 0))
  );
}

/** % calculés par COLONNE (chaque colonne totalise 100 %) — P7.6. */
export function calculateColumnPercentages(table: ContingencyTable): number[][] {
  return table.counts.map((row) =>
    row.map((c, ci) => (table.colTotals[ci] > 0 ? (c / table.colTotals[ci]) * 100 : 0))
  );
}


// ============================================================
// KHI-DEUX (P7.7 / P7.9)
// ============================================================

export interface ChiSquareResult {
  chiSquare: number | null;
  degreesOfFreedom: number;
  pValue: number | null;
  expectedCellsBelow5Count: number;
  totalCells: number;
  assumptionsMet: boolean;
}

export function calculateChiSquare(table: ContingencyTable): ChiSquareResult {
  const rows = table.counts.length;
  const cols = rows > 0 ? table.counts[0].length : 0;
  const totalCells = rows * cols;

  if (table.grandTotal === 0 || rows < 2 || cols < 2) {
    return { chiSquare: null, degreesOfFreedom: 0, pValue: null, expectedCellsBelow5Count: 0, totalCells, assumptionsMet: false };
  }

  let chiSquare = 0;
  let expectedCellsBelow5Count = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const expected = (table.rowTotals[r] * table.colTotals[c]) / table.grandTotal;
      if (expected < 5) expectedCellsBelow5Count++;
      if (expected > 0) {
        chiSquare += (table.counts[r][c] - expected) ** 2 / expected;
      }
    }
  }

  const degreesOfFreedom = (rows - 1) * (cols - 1);
  const pValue = chiSquarePValue(chiSquare, degreesOfFreedom);

  // Condition d'application usuelle (Cochran) : au plus 20 % des cellules
  // avec un effectif attendu < 5, et aucune cellule à effectif attendu < 1.
  const assumptionsMet = expectedCellsBelow5Count / totalCells <= 0.2;

  return { chiSquare, degreesOfFreedom, pValue, expectedCellsBelow5Count, totalCells, assumptionsMet };
}

/** V de Cramér — mesure d'association, jamais un effet causal (P7.9). */
export function calculateCramersV(chiSquare: number, n: number, rows: number, cols: number): number | null {
  if (!Number.isFinite(chiSquare) || n <= 0 || rows < 2 || cols < 2) return null;
  const k = Math.min(rows - 1, cols - 1);
  if (k <= 0) return null;
  const v = Math.sqrt(chiSquare / (n * k));
  return Number.isFinite(v) ? v : null;
}
