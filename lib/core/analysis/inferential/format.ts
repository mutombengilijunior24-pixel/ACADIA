/** Mise en forme française des nombres des rapports (le calcul, lui, garde la précision complète). */

export function fmt(value: number, digits = 3): string {
  if (Number.isNaN(value)) return "—";
  if (!Number.isFinite(value)) return value > 0 ? "+∞" : "−∞";
  const rounded = Number(value.toFixed(digits));
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(Object.is(rounded, -0) ? 0 : rounded).replace(/[  ]/g, " ");
}

export function fmtP(p: number): string {
  if (Number.isNaN(p)) return "—";
  if (p < 0.001) return "< 0,001";
  return `= ${p.toFixed(3).replace(".", ",")}`;
}

/** Valeur exacte d'une p-value, 3 chiffres significatifs (ex. 0,000629 ; 0,00144). */
export function fmtPExact(p: number): string {
  if (Number.isNaN(p)) return "—";
  if (p === 0) return "0 (inférieure à la précision de calcul)";
  if (p < 1e-6) return p.toExponential(2).replace(".", ",").replace("e-", " × 10^-");
  return Number(p.toPrecision(3)).toString().replace(".", ",");
}

export function fmtPct(proportion: number, digits = 1): string {
  return `${fmt(proportion * 100, digits)} %`;
}
