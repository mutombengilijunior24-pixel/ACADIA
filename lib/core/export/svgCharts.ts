/**
 * Graphiques des fichiers exportés, dessinés en SVG à partir des résultats (pas de capture d'écran) :
 * mêmes formes et mêmes couleurs que les graphiques affichés dans ACADIA.
 * Le SVG est inséré tel quel dans le rapport imprimable, et converti en image PNG pour Word et Excel.
 */
import type { ChartSpec } from "./chartSpecs";

export interface ChartSvg {
  title: string;
  svg: string;
  width: number;
  height: number;
  note?: string;
}

const FONT = "Inter, 'Segoe UI', Calibri, Arial, sans-serif";
const TEXT = "#334155";
const MUTED = "#64748b";
const GRID = "#e8edf4";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fr = (v: number, d = 1) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(v).replace(/[  ]/g, " ");
const short = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);
const r1 = (v: number) => Math.round(v * 10) / 10;

function svg(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}"><rect width="${width}" height="${height}" fill="#ffffff"/>${body}</svg>`;
}

function text(x: number, y: number, content: string, opts: { size?: number; anchor?: "start" | "middle" | "end"; color?: string; weight?: number; rotate?: number } = {}): string {
  const transform = opts.rotate ? ` transform="rotate(${opts.rotate} ${r1(x)} ${r1(y)})"` : "";
  return `<text x="${r1(x)}" y="${r1(y)}" font-size="${opts.size ?? 12}" fill="${opts.color ?? TEXT}" text-anchor="${opts.anchor ?? "start"}"${opts.weight ? ` font-weight="${opts.weight}"` : ""}${transform}>${esc(content)}</text>`;
}

/** Graduations « rondes » couvrant [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const span = max - min;
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => span / s <= count) ?? 10 * power;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  if (ticks[ticks.length - 1] < max) ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(10)));
  return ticks;
}

/* ---------------------------------------------------------------- */

/** Anneau (≤ 4 modalités non ordonnées) avec légende. */
export function donutSvg(data: Array<{ label: string; count: number }>, colors: string[]): ChartSvg | null {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!data.length || !total) return null;
  const width = 640;
  const height = 260;
  const cx = 150;
  const cy = 130;
  const outer = 100;
  const inner = 54;
  let angle = -Math.PI / 2;
  const parts: string[] = [];
  data.forEach((d, i) => {
    const share = d.count / total;
    if (share === 0) return;
    const color = colors[i % colors.length];
    if (share >= 0.9999) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${(outer + inner) / 2}" fill="none" stroke="${color}" stroke-width="${outer - inner}"/>`);
    } else {
      const end = angle + share * 2 * Math.PI;
      const large = share > 0.5 ? 1 : 0;
      const p = (r: number, a: number) => `${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`;
      parts.push(`<path d="M ${p(outer, angle)} A ${outer} ${outer} 0 ${large} 1 ${p(outer, end)} L ${p(inner, end)} A ${inner} ${inner} 0 ${large} 0 ${p(inner, angle)} Z" fill="${color}" stroke="#ffffff" stroke-width="2"/>`);
      if (share >= 0.06) {
        const mid = (angle + end) / 2;
        const rm = (outer + inner) / 2;
        parts.push(text(cx + rm * Math.cos(mid), cy + rm * Math.sin(mid) + 4, `${fr(share * 100)} %`, { size: 12, anchor: "middle", color: "#ffffff", weight: 700 }));
      }
      angle = end;
    }
  });
  parts.push(text(cx, cy + 5, `n = ${total}`, { size: 13, anchor: "middle", color: MUTED, weight: 600 }));
  data.forEach((d, i) => {
    const y = 70 + i * 34;
    parts.push(`<circle cx="300" cy="${y - 4}" r="7" fill="${colors[i % colors.length]}"/>`);
    parts.push(text(316, y, short(d.label, 36), { size: 13, weight: 600 }));
    parts.push(text(316, y + 16, `${d.count} (${fr((d.count / total) * 100)} %)`, { size: 12, color: MUTED }));
  });
  return { title: "", svg: svg(width, height, parts.join("")), width, height };
}

/** Barres horizontales colorées, avec le pourcentage au bout de chaque barre. */
export function barsSvg(data: Array<{ label: string; count: number }>, colors: string[], ordered = false): ChartSvg | null {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!data.length || !total) return null;
  const width = 640;
  const labelWidth = 200;
  const row = 34;
  const top = 12;
  const height = top + data.length * row + 32;
  const plot = width - labelWidth - 70;
  const max = Math.max(...data.map((d) => d.count));
  const ticks = niceTicks(0, max, 4);
  const scale = (v: number) => (v / ticks[ticks.length - 1]) * plot;
  const parts: string[] = [];
  for (const t of ticks) {
    const x = labelWidth + scale(t);
    parts.push(`<line x1="${r1(x)}" y1="${top}" x2="${r1(x)}" y2="${top + data.length * row}" stroke="${GRID}"/>`);
    parts.push(text(x, top + data.length * row + 18, fr(t, 2), { size: 11, anchor: "middle", color: MUTED }));
  }
  data.forEach((d, i) => {
    const y = top + i * row;
    const w = Math.max(scale(d.count), d.count ? 2 : 0);
    parts.push(text(labelWidth - 10, y + row / 2 + 4, short(d.label, 30), { size: 12, anchor: "end" }));
    parts.push(`<rect x="${labelWidth}" y="${y + 6}" width="${r1(w)}" height="${row - 12}" rx="6" fill="${colors[i % colors.length]}"/>`);
    parts.push(text(labelWidth + w + 8, y + row / 2 + 4, `${fr((d.count / total) * 100)} %`, { size: 12, weight: 700 }));
  });
  return { title: "", svg: svg(width, height, parts.join("")), width, height, note: ordered ? "Modalités dans l'ordre de l'échelle." : undefined };
}

/** Histogramme : classes contiguës, dégradé indigo → bleu ciel, effectif au-dessus de chaque barre. */
export function histogramSvg(bins: Array<{ label: string; count: number }>, colors: [string, string]): ChartSvg | null {
  if (bins.length < 2) return null;
  const width = 640;
  const height = 280;
  const left = 46;
  const bottom = bins.length > 6 ? 70 : 40;
  const top = 20;
  const plotW = width - left - 16;
  const plotH = height - top - bottom;
  const ticks = niceTicks(0, Math.max(...bins.map((b) => b.count)), 4);
  const maxT = ticks[ticks.length - 1];
  const bw = plotW / bins.length;
  const parts = [`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${colors[0]}"/><stop offset="100%" stop-color="${colors[1]}"/></linearGradient></defs>`];
  for (const t of ticks) {
    const y = top + plotH - (t / maxT) * plotH;
    parts.push(`<line x1="${left}" y1="${r1(y)}" x2="${width - 16}" y2="${r1(y)}" stroke="${GRID}"/>`);
    parts.push(text(left - 8, y + 4, fr(t, 2), { size: 11, anchor: "end", color: MUTED }));
  }
  bins.forEach((b, i) => {
    const h = (b.count / maxT) * plotH;
    const x = left + i * bw;
    parts.push(`<rect x="${r1(x + 0.5)}" y="${r1(top + plotH - h)}" width="${r1(bw - 1)}" height="${r1(h)}" rx="4" fill="url(#g)"/>`);
    if (b.count) parts.push(text(x + bw / 2, top + plotH - h - 5, String(b.count), { size: 11, anchor: "middle", color: TEXT, weight: 600 }));
    const lx = x + bw / 2;
    parts.push(bins.length > 6 ? text(lx, top + plotH + 14, b.label, { size: 10, anchor: "end", color: MUTED, rotate: -35 }) : text(lx, top + plotH + 18, b.label, { size: 11, anchor: "middle", color: MUTED }));
  });
  return { title: "", svg: svg(width, height, parts.join("")), width, height };
}

/** Tableau croisé : barres empilées à 100 % par ligne, légende des colonnes. */
export function stackedSvg(rowLabels: string[], colLabels: string[], observed: number[][], colors: string[]): ChartSvg {
  const width = 640;
  const labelWidth = 150;
  const row = 40;
  const top = 10;
  const legendRows = Math.ceil(colLabels.length / 3);
  const height = top + rowLabels.length * row + 30 + legendRows * 22 + 10;
  const plot = width - labelWidth - 20;
  const parts: string[] = [];
  for (const t of [0, 25, 50, 75, 100]) {
    const x = labelWidth + (t / 100) * plot;
    parts.push(`<line x1="${r1(x)}" y1="${top}" x2="${r1(x)}" y2="${top + rowLabels.length * row}" stroke="${GRID}"/>`);
    parts.push(text(x, top + rowLabels.length * row + 16, `${t} %`, { size: 11, anchor: "middle", color: MUTED }));
  }
  rowLabels.forEach((label, i) => {
    const y = top + i * row;
    const total = observed[i].reduce((s, v) => s + v, 0) || 1;
    parts.push(text(labelWidth - 10, y + row / 2 + 4, short(label, 22), { size: 12, anchor: "end" }));
    let x = labelWidth;
    observed[i].forEach((v, j) => {
      const w = (v / total) * plot;
      if (w <= 0) return;
      parts.push(`<rect x="${r1(x)}" y="${y + 7}" width="${r1(w)}" height="${row - 14}" fill="${colors[j]}"/>`);
      if (v / total >= 0.09) parts.push(text(x + w / 2, y + row / 2 + 4, `${fr((v / total) * 100, 0)} %`, { size: 11, anchor: "middle", color: "#ffffff", weight: 700 }));
      x += w;
    });
  });
  colLabels.forEach((label, j) => {
    const lx = 20 + (j % 3) * 205;
    const ly = top + rowLabels.length * row + 40 + Math.floor(j / 3) * 22;
    parts.push(`<circle cx="${lx}" cy="${ly - 4}" r="6" fill="${colors[j]}"/>`);
    parts.push(text(lx + 12, ly, short(label, 28), { size: 12 }));
  });
  return { title: "", svg: svg(width, height, parts.join("")), width, height, note: "Chaque barre totalise 100 % : comparez la répartition d'une ligne à l'autre." };
}

/** Moyennes par groupe, avec ± 1 écart-type. */
export function groupMeansSvg(groups: Array<{ label: string; mean: number; sd: number; n: number }>, colors: string[]): ChartSvg {
  const width = 640;
  const height = 290;
  const left = 56;
  const top = 20;
  const bottom = 44;
  const plotW = width - left - 16;
  const plotH = height - top - bottom;
  const sd = (g: { sd: number }) => (Number.isFinite(g.sd) ? g.sd : 0);
  const lo = Math.min(0, ...groups.map((g) => g.mean - sd(g)));
  const hi = Math.max(0, ...groups.map((g) => g.mean + sd(g)));
  const ticks = niceTicks(lo, hi, 5);
  const t0 = ticks[0];
  const t1 = ticks[ticks.length - 1];
  const yOf = (v: number) => top + plotH - ((v - t0) / (t1 - t0 || 1)) * plotH;
  const slot = plotW / groups.length;
  const bw = Math.min(64, slot * 0.6);
  const parts: string[] = [];
  for (const t of ticks) {
    parts.push(`<line x1="${left}" y1="${r1(yOf(t))}" x2="${width - 16}" y2="${r1(yOf(t))}" stroke="${GRID}"/>`);
    parts.push(text(left - 8, yOf(t) + 4, fr(t, 2), { size: 11, anchor: "end", color: MUTED }));
  }
  groups.forEach((g, i) => {
    const cx = left + slot * (i + 0.5);
    const y0 = yOf(0);
    const y = yOf(g.mean);
    parts.push(`<rect x="${r1(cx - bw / 2)}" y="${r1(Math.min(y, y0))}" width="${r1(bw)}" height="${r1(Math.abs(y0 - y))}" rx="6" fill="${colors[i % colors.length]}"/>`);
    const a = yOf(g.mean + sd(g));
    const b = yOf(g.mean - sd(g));
    parts.push(`<line x1="${r1(cx)}" y1="${r1(a)}" x2="${r1(cx)}" y2="${r1(b)}" stroke="#334155" stroke-width="1.5"/><line x1="${r1(cx - 7)}" y1="${r1(a)}" x2="${r1(cx + 7)}" y2="${r1(a)}" stroke="#334155" stroke-width="1.5"/><line x1="${r1(cx - 7)}" y1="${r1(b)}" x2="${r1(cx + 7)}" y2="${r1(b)}" stroke="#334155" stroke-width="1.5"/>`);
    parts.push(text(cx, top + plotH + 18, short(g.label, 18), { size: 12, anchor: "middle" }));
    parts.push(text(cx, top + plotH + 34, `moy. ${fr(g.mean, 2)} · n = ${g.n}`, { size: 11, anchor: "middle", color: MUTED }));
  });
  return { title: "", svg: svg(width, height, parts.join("")), width, height, note: "Barres : moyenne de chaque groupe ; traits : ± 1 écart-type." };
}

/** Nuage de points avec droite des moindres carrés (illustrative). */
export function scatterSvg(points: Array<{ x: number; y: number }>, xLabel: string, yLabel: string, line = true, color = "#4f46e5", lineColor = "#f43f5e"): ChartSvg | null {
  if (points.length < 2) return null;
  const width = 640;
  const height = 320;
  const left = 56;
  const top = 16;
  const bottom = 50;
  const plotW = width - left - 20;
  const plotH = height - top - bottom;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const tx = niceTicks(Math.min(...xs), Math.max(...xs), 5);
  const ty = niceTicks(Math.min(...ys), Math.max(...ys), 5);
  const X = (v: number) => left + ((v - tx[0]) / (tx[tx.length - 1] - tx[0] || 1)) * plotW;
  const Y = (v: number) => top + plotH - ((v - ty[0]) / (ty[ty.length - 1] - ty[0] || 1)) * plotH;
  const parts: string[] = [];
  for (const t of tx) parts.push(`<line x1="${r1(X(t))}" y1="${top}" x2="${r1(X(t))}" y2="${top + plotH}" stroke="${GRID}"/>`, text(X(t), top + plotH + 16, fr(t, 2), { size: 11, anchor: "middle", color: MUTED }));
  for (const t of ty) parts.push(`<line x1="${left}" y1="${r1(Y(t))}" x2="${left + plotW}" y2="${r1(Y(t))}" stroke="${GRID}"/>`, text(left - 8, Y(t) + 4, fr(t, 2), { size: 11, anchor: "end", color: MUTED }));
  for (const p of points.slice(0, 3000)) parts.push(`<circle cx="${r1(X(p.x))}" cy="${r1(Y(p.y))}" r="4.5" fill="${color}" fill-opacity="0.65" stroke="${color}" stroke-width="0.8"/>`);
  const n = points.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((s, v) => s + (v - mx) ** 2, 0);
  if (line && sxx) {
    const slope = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    parts.push(`<line x1="${r1(X(x0))}" y1="${r1(Y(my + slope * (x0 - mx)))}" x2="${r1(X(x1))}" y2="${r1(Y(my + slope * (x1 - mx)))}" stroke="${lineColor}" stroke-width="2"/>`);
  }
  parts.push(text(left + plotW / 2, height - 10, short(xLabel, 60), { size: 12, anchor: "middle", weight: 600 }));
  parts.push(text(14, top + plotH / 2, short(yLabel, 40), { size: 12, anchor: "middle", weight: 600, rotate: -90 }));
  return { title: "", svg: svg(width, height, parts.join("")), width, height, note: line && sxx ? "Droite des moindres carrés tracée à titre illustratif." : undefined };
}

/* ---------------------------------------------------------------- */

/** Rendu SVG d'une spécification de graphique (mêmes formes qu'à l'écran). */
export function svgFromSpec(spec: ChartSpec): ChartSvg | null {
  const pairs = (categories: string[], values: number[]) => categories.map((label, i) => ({ label, count: values[i] }));
  let chart: ChartSvg | null;
  switch (spec.kind) {
    case "donut":
      chart = donutSvg(pairs(spec.categories, spec.values), spec.colors);
      break;
    case "bars":
      chart = barsSvg(pairs(spec.categories, spec.values), spec.colors, spec.ordered);
      break;
    case "histogram":
      chart = histogramSvg(pairs(spec.categories, spec.values), spec.colors);
      break;
    case "stacked":
      chart = stackedSvg(spec.categories, spec.series.map((x) => x.name), spec.categories.map((_, i) => spec.series.map((x) => x.counts[i])), spec.series.map((x) => x.color));
      break;
    case "means":
      chart = groupMeansSvg(spec.categories.map((label, i) => ({ label, mean: spec.means[i], sd: spec.sds[i], n: spec.ns[i] })), spec.colors);
      break;
    case "scatter":
      chart = scatterSvg(spec.points, spec.xLabel, spec.yLabel, spec.trendline, spec.color, spec.lineColor);
      break;
  }
  return chart ? { ...chart, title: spec.title, note: spec.note ?? chart.note } : null;
}
