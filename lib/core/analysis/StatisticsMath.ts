// ============================================================
// ACADIA — STATISTIQUES DESCRIPTIVES : FONCTIONS PURES (P6.9)
//
// Aucune dépendance, aucun accès au Dataset ici — uniquement des
// fonctions mathématiques pures sur des tableaux de nombres.
// Jamais NaN/Infinity en sortie : une valeur non calculable
// renvoie `null`, à charge de la couche d'affichage de montrer
// "N/A" (voir formatStat/formatPercentage, P6.10).
//
// Convention retenue pour la variance/l'écart-type : variance
// D'ÉCHANTILLON (dénominateur n-1), usage standard en statistique
// descriptive appliquée à un échantillon censé représenter une
// population — jamais la variance de population (n).
// ============================================================

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function calculateMean(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

export function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Renvoie toutes les valeurs à égalité au sommet de la distribution.
 * `null` si aucune valeur ne se répète (mode non pertinent — toutes
 * les valeurs sont uniques, afficher un mode serait trompeur).
 */
export function calculateMode(values: number[]): number[] | null {
  if (values.length === 0) return null;

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  const maxCount = Math.max(...counts.values());
  if (maxCount <= 1) return null;

  return [...counts.entries()].filter(([, c]) => c === maxCount).map(([v]) => v);
}

/** Variance d'échantillon (n-1). `null` si n < 2 (indéfinie, jamais 0 par défaut). */
export function calculateVariance(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = calculateMean(values);
  if (mean === null) return null;
  const sumSquares = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  return sumSquares / (values.length - 1);
}

export function calculateStandardDeviation(values: number[]): number | null {
  const variance = calculateVariance(values);
  return variance === null ? null : Math.sqrt(variance);
}

export function calculateMin(values: number[]): number | null {
  return values.length === 0 ? null : Math.min(...values);
}

export function calculateMax(values: number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
}


// ============================================================
// FORMATAGE — ARRONDIS UNIQUEMENT À L'AFFICHAGE (P6.10)
// ============================================================

/** Séparateur décimal français (virgule) — cohérent avec les gabarits SEG du produit. */
export function formatStat(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return Math.round(value).toLocaleString("fr-FR");
}

export function formatPercentage(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} %`;
}
