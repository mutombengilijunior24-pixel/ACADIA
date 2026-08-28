// ============================================================
// ACADIA — ALGÈBRE MATRICIELLE MINIMALE (P8)
//
// Aucune dépendance numérique dans le projet (audit confirmé :
// pas de numeric.js / ml-matrix / jStat) — implémentation
// manuelle, volontairement minimale (MCO sur des échantillons de
// taille "mémoire de recherche", pas de calcul intensif).
//
// Inversion par élimination de Gauss-Jordan avec pivot partiel —
// renvoie `null` explicite en cas de matrice singulière (jamais
// NaN/Infinity silencieux, voir P8.49).
// ============================================================

export type Matrix = number[][];

export function transpose(m: Matrix): Matrix {
  if (m.length === 0) return [];
  const rows = m.length;
  const cols = m[0].length;
  const result: Matrix = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = m[i][j];
    }
  }
  return result;
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  const rowsA = a.length;
  const colsA = a[0]?.length ?? 0;
  const colsB = b[0]?.length ?? 0;

  const result: Matrix = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) sum += a[i][k] * b[k][j];
      result[i][j] = sum;
    }
  }
  return result;
}

export function multiplyVector(a: Matrix, v: number[]): number[] {
  return a.map((row) => row.reduce((sum, value, j) => sum + value * v[j], 0));
}

/**
 * Inversion par Gauss-Jordan avec pivot partiel. `null` si la
 * matrice est singulière (ou quasi singulière — pivot négligeable),
 * jamais une pseudo-inverse approchée présentée comme fiable.
 */
export function invert(m: Matrix): Matrix | null {
  const n = m.length;
  if (n === 0 || m.some((row) => row.length !== n)) return null;

  // Matrice augmentée [m | I]
  const a: Matrix = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  const EPS = 1e-10;

  for (let col = 0; col < n; col++) {
    // Pivot partiel : ligne au plus grand |valeur| dans la colonne courante
    let pivotRow = col;
    let maxAbs = Math.abs(a[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > maxAbs) {
        maxAbs = Math.abs(a[r][col]);
        pivotRow = r;
      }
    }

    if (maxAbs < EPS) return null; // colonne (quasi) nulle -> matrice singulière

    if (pivotRow !== col) {
      [a[col], a[pivotRow]] = [a[pivotRow], a[col]];
    }

    const pivot = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) a[r][j] -= factor * a[col][j];
    }
  }

  return a.map((row) => row.slice(n));
}

export function identity(n: number): Matrix {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}
