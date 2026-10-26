/**
 * Description d'un graphique indépendante du rendu : la même spécification produit
 * le SVG du rapport imprimable et le graphique NATIF (modifiable) de Word et d'Excel.
 */
import type { VariableDescriptive } from "@/lib/core/analysis/descriptiveStatistics";
import type { AnalysisReport } from "@/lib/core/analysis/inferential";

import { colorAt, DEFAULT_PALETTE, sequential } from "./palette";

const fr = (v: number, d = 2) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(v).replace(/[  ]/g, " ");

export type ChartSpec =
  | { kind: "donut"; title: string; categories: string[]; values: number[]; colors: string[]; valueName: string; note?: string }
  | { kind: "bars"; title: string; categories: string[]; values: number[]; colors: string[]; valueName: string; ordered: boolean; note?: string }
  | { kind: "histogram"; title: string; categories: string[]; values: number[]; colors: [string, string]; valueName: string; note?: string }
  | { kind: "stacked"; title: string; categories: string[]; categoryName: string; series: Array<{ name: string; values: number[]; counts: number[]; color: string }>; note?: string }
  | { kind: "means"; title: string; categories: string[]; means: number[]; sds: number[]; ns: number[]; colors: string[]; valueName: string; note?: string }
  | { kind: "scatter"; title: string; xLabel: string; yLabel: string; points: Array<{ x: number; y: number }>; color: string; lineColor: string; trendline: boolean; note?: string }
  /** Évolution de quelques séries sur des périodes (exercices) ; une valeur absente laisse un trou. */
  | { kind: "line"; title: string; categories: string[]; categoryName: string; series: Array<{ name: string; values: Array<number | null>; color: string }>; valueName: string; note?: string };

/** Tableau de données d'un graphique : celui qu'on retrouve (et modifie) dans Word et Excel. */
export function chartTable(spec: ChartSpec): { head: string[]; rows: Array<Array<string | number>> } {
  switch (spec.kind) {
    case "donut":
    case "bars":
    case "histogram":
      return { head: [spec.kind === "histogram" ? "Classe" : "Modalité", spec.valueName], rows: spec.categories.map((c, i) => [c, spec.values[i]]) };
    case "stacked":
      return { head: [spec.categoryName, ...spec.series.map((s) => s.name)], rows: spec.categories.map((c, i) => [c, ...spec.series.map((s) => s.values[i])]) };
    case "means":
      return { head: ["Groupe", spec.valueName, "Écart-type", "n"], rows: spec.categories.map((c, i) => [c, spec.means[i], Number.isFinite(spec.sds[i]) ? spec.sds[i] : 0, spec.ns[i]]) };
    case "scatter":
      return { head: [spec.xLabel, spec.yLabel], rows: spec.points.slice(0, 3000).map((p) => [p.x, p.y]) };
    case "line":
      return { head: [spec.categoryName, ...spec.series.map((s) => s.name)], rows: spec.categories.map((c, i) => [c, ...spec.series.map((s) => s.values[i] ?? "")]) };
  }
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Graphique d'une variable décrite — même choix de forme que l'écran. */
export function specForDescriptive(result: VariableDescriptive, palette: string[] = DEFAULT_PALETTE): ChartSpec | null {
  if (result.kind === "quantitative") {
    if (result.histogram.length < 2) return null;
    return {
      kind: "histogram",
      title: `Histogramme — ${result.header}`,
      categories: result.histogram.map((b, i) => `${fr(b.from)}–${fr(b.to)}${i === result.histogram.length - 1 ? "" : "["}`),
      values: result.histogram.map((b) => b.count),
      colors: [palette[0], palette[4] ?? palette[1]],
      valueName: "Effectif",
    };
  }
  const rows = result.frequencies.slice(0, 20);
  if (!rows.length || result.valid === 0) return null;
  const ordered = result.kind === "ordinal" && result.orderKnown;
  const base = { categories: rows.map((f) => f.value), values: rows.map((f) => f.count), valueName: "Effectif" };
  if (!ordered && result.kind === "categorical" && rows.length <= 4) {
    return { kind: "donut", title: `Répartition — ${result.header}`, ...base, colors: rows.map((_, i) => colorAt(palette, i)) };
  }
  return {
    kind: "bars",
    title: result.kind === "ordinal" ? `Distribution des réponses — ${result.header}` : `Répartition — ${result.header}`,
    ...base,
    ordered,
    colors: ordered ? sequential(rows.length, palette[0]) : rows.map((_, i) => colorAt(palette, i)),
    note: ordered ? "Modalités dans l'ordre de l'échelle." : undefined,
  };
}

/** Graphique d'un test — même choix de forme que l'écran. */
export function specForReport(report: AnalysisReport, palette: string[] = DEFAULT_PALETTE): ChartSpec | null {
  const d = report.detail;
  if (d.kind === "chi_square") {
    const totals = d.result.rowTotals;
    return {
      kind: "stacked",
      title: `Répartition de « ${d.colVariable} » selon « ${d.rowVariable} »`,
      categories: d.rowLabels,
      categoryName: d.rowVariable,
      series: d.colLabels.map((name, j) => ({ name, values: d.rowLabels.map((_, i) => round1((d.result.observed[i][j] / (totals[i] || 1)) * 100)), counts: d.rowLabels.map((_, i) => d.result.observed[i][j]), color: colorAt(palette, j) })),
      note: "Pourcentages en ligne : chaque barre totalise 100 %.",
    };
  }
  if (d.kind === "welch_t" || d.kind === "anova") {
    const g = d.result.groups;
    return {
      kind: "means",
      title: `Moyenne de « ${d.measure} » selon « ${d.grouping} »`,
      categories: g.map((x) => x.label),
      means: g.map((x) => Number(x.mean.toFixed(4))),
      sds: g.map((x) => Number((Number.isFinite(x.sd) ? x.sd : 0).toFixed(4))),
      ns: g.map((x) => x.n),
      colors: g.map((_, i) => colorAt(palette, i)),
      valueName: "Moyenne",
      note: "Barres : moyenne de chaque groupe ; traits : ± 1 écart-type.",
    };
  }
  if (d.points.length < 2) return null;
  return {
    kind: "scatter",
    title: `« ${d.y} » en fonction de « ${d.x} »`,
    xLabel: d.x,
    yLabel: d.y,
    points: d.points,
    color: palette[0],
    lineColor: palette[3] ?? palette[1],
    trendline: d.kind === "pearson",
    note: d.kind === "pearson" ? "Droite des moindres carrés tracée à titre illustratif." : undefined,
  };
}
