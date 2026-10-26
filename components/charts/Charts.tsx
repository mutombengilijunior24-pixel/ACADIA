"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ErrorBar,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PALETTE, sequential } from "@/lib/core/export/palette";
import { useChartPalette } from "@/lib/ui/chartTheme";

export { PALETTE, sequential };

/**
 * Graphiques ACADIA : une palette commune, des étiquettes lisibles, aucune animation
 * (rendu identique à l'écran, à l'impression et dans les tests).
 */

const fr = (v: number, d = 1) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(v).replace(/[  ]/g, " ");
const TICK = { fontSize: 12, fill: "#64748b" };
const TOOLTIP = { contentStyle: { borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 10px 30px -12px rgba(15,23,42,.25)", fontSize: 13 }, cursor: { fill: "rgba(99,102,241,0.06)" } };

function Figure({ title, note, height, children }: { title: string; note?: string; height: number; children: React.ReactElement }) {
  return (
    <figure className="mt-4 rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/60 p-3 sm:p-4">
      <figcaption className="mb-2 text-sm font-semibold text-slate-800">{title}</figcaption>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
      {note ? <p className="mt-2 text-xs text-slate-500">{note}</p> : null}
    </figure>
  );
}

const short = (label: string, max = 26) => (label.length > max ? `${label.slice(0, max - 1)}…` : label);

/** Répartition d'une variable qualitative : anneau (≤ 4 modalités non ordonnées) ou barres horizontales colorées. */
export function FrequencyChart({ title, data, ordered = false }: { title: string; data: Array<{ label: string; count: number }>; ordered?: boolean }) {
  const palette = useChartPalette();
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!data.length || total === 0) return null;
  const rows = data.map((d) => ({ ...d, share: (d.count / total) * 100, name: short(d.label) }));
  const colors = ordered ? sequential(rows.length, palette[0]) : rows.map((_, i) => palette[i % palette.length]);
  if (!ordered && rows.length <= 4) {
    return (
      <Figure title={title} height={240}>
        <PieChart>
          <Pie data={rows} dataKey="count" nameKey="name" innerRadius="52%" outerRadius="78%" paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={false} label={(props: { payload?: { share?: number } }) => `${fr(props.payload?.share ?? 0)} %`} labelLine={false}>
            {rows.map((r, i) => (
              <Cell key={r.label} fill={colors[i]} />
            ))}
          </Pie>
          <Tooltip {...TOOLTIP} formatter={(value: unknown, _n: unknown, item: { payload?: { share?: number } }) => [`${value} (${fr(item.payload?.share ?? 0)} %)`, "Effectif"]} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </Figure>
    );
  }
  return (
    <Figure title={title} height={Math.max(160, rows.length * 38 + 40)} note={ordered ? "Modalités dans l'ordre de l'échelle, de la plus basse à la plus haute." : undefined}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="#eef2f7" />
        <XAxis type="number" allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={150} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP} formatter={(value: unknown, _n: unknown, item: { payload?: { share?: number } }) => [`${value} (${fr(item.payload?.share ?? 0)} %)`, "Effectif"]} />
        <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={22} isAnimationActive={false}>
          {rows.map((r, i) => (
            <Cell key={r.label} fill={colors[i]} />
          ))}
          <LabelList dataKey="share" position="right" formatter={(v: unknown) => `${fr(Number(v))} %`} style={{ fontSize: 12, fill: "#334155", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </Figure>
  );
}

/** Histogramme : classes contiguës, dégradé. */
export function HistogramChart({ title, bins }: { title: string; bins: Array<{ label: string; count: number }> }) {
  const palette = useChartPalette();
  if (bins.length < 2) return null;
  return (
    <Figure title={title} height={240}>
      <BarChart data={bins} barCategoryGap={1} margin={{ top: 16, right: 8, bottom: 4, left: -12 }}>
        <defs>
          <linearGradient id="acadia-hist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette[0]} />
            <stop offset="100%" stopColor={palette[4] ?? palette[1]} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="label" tick={{ ...TICK, fontSize: 11 }} interval={0} angle={bins.length > 6 ? -30 : 0} textAnchor={bins.length > 6 ? "end" : "middle"} height={bins.length > 6 ? 60 : 30} tickLine={false} />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP} formatter={(value: unknown) => [String(value), "Effectif"]} />
        <Bar dataKey="count" fill="url(#acadia-hist)" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: "#475569" }} />
        </Bar>
      </BarChart>
    </Figure>
  );
}

/** Tableau croisé : barres empilées à 100 % (répartition des colonnes dans chaque ligne). */
export function StackedPercentChart({ title, rowLabels, colLabels, observed, colOrdered = false }: { title: string; rowLabels: string[]; colLabels: string[]; observed: number[][]; colOrdered?: boolean }) {
  const palette = useChartPalette();
  const colors = colOrdered ? sequential(colLabels.length, palette[0]) : colLabels.map((_, i) => palette[i % palette.length]);
  const data = rowLabels.map((row, i) => {
    const total = observed[i].reduce((s, v) => s + v, 0) || 1;
    return Object.fromEntries([["name", short(row, 22)], ...colLabels.map((c, j) => [`c${j}`, (observed[i][j] / total) * 100]), ...colLabels.map((c, j) => [`n${j}`, observed[i][j]])]);
  });
  return (
    <Figure title={title} height={Math.max(170, rowLabels.length * 48 + 70)} note="Chaque barre totalise 100 % : comparez la répartition d'une ligne à l'autre.">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="#eef2f7" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v} %`} tick={TICK} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={130} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP} formatter={(value: unknown, key: unknown, item: { payload?: Record<string, number> }) => {
          const j = Number(String(key).slice(1));
          return [`${fr(Number(value))} % (${item.payload?.[`n${j}`] ?? 0})`, colLabels[j]];
        }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(_v: unknown, _e: unknown, index: number) => short(colLabels[index] ?? "", 30)} />
        {colLabels.map((c, j) => (
          <Bar key={c} dataKey={`c${j}`} stackId="all" fill={colors[j]} isAnimationActive={false} radius={j === colLabels.length - 1 ? [0, 6, 6, 0] : j === 0 ? [6, 0, 0, 6] : 0}>
            <LabelList dataKey={`c${j}`} position="center" formatter={(v: unknown) => (Number(v) >= 9 ? `${fr(Number(v), 0)} %` : "")} style={{ fontSize: 11, fill: "#fff", fontWeight: 600 }} />
          </Bar>
        ))}
      </BarChart>
    </Figure>
  );
}

/** Moyennes par groupe avec ± 1 écart-type. */
export function GroupMeansChart({ title, groups }: { title: string; groups: Array<{ label: string; mean: number; sd: number; n: number }> }) {
  const palette = useChartPalette();
  const data = groups.map((g) => ({ name: short(g.label, 20), mean: g.mean, sd: Number.isFinite(g.sd) ? g.sd : 0, n: g.n }));
  return (
    <Figure title={title} height={260} note="Barres : moyenne de chaque groupe ; traits : ± 1 écart-type (dispersion des valeurs, pas un intervalle de confiance).">
      <BarChart data={data} margin={{ top: 16, right: 8, bottom: 4, left: -8 }}>
        <CartesianGrid vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="name" tick={TICK} tickLine={false} />
        <YAxis tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP} formatter={(value: unknown, _k: unknown, item: { payload?: { sd: number; n: number } }) => [`${fr(Number(value), 3)} (écart-type ${fr(item.payload?.sd ?? 0, 3)}, n = ${item.payload?.n ?? 0})`, "Moyenne"]} />
        <Bar dataKey="mean" radius={[8, 8, 0, 0]} barSize={48} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={palette[i % palette.length]} />
          ))}
          <ErrorBar dataKey="sd" width={10} strokeWidth={1.5} stroke="#334155" direction="y" />
        </Bar>
      </BarChart>
    </Figure>
  );
}

/** Nuage de points, avec la droite des moindres carrés à titre illustratif. */
export function ScatterPlot({ title, points, xLabel, yLabel, line = true }: { title: string; points: Array<{ x: number; y: number }>; xLabel: string; yLabel: string; line?: boolean }) {
  const palette = useChartPalette();
  if (points.length < 2) return null;
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const slope = sxx ? points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx : 0;
  const xs = points.map((p) => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  return (
    <Figure title={title} height={280} note={line && sxx ? "Droite des moindres carrés tracée à titre illustratif (elle ne change pas le test réalisé)." : undefined}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 4 }}>
        <CartesianGrid stroke="#eef2f7" />
        <XAxis type="number" dataKey="x" name={xLabel} tick={TICK} label={{ value: short(xLabel, 40), position: "insideBottom", offset: -14, fontSize: 12, fill: "#475569" }} domain={["auto", "auto"]} />
        <YAxis type="number" dataKey="y" name={yLabel} tick={TICK} width={48} domain={["auto", "auto"]} />
        <Tooltip {...TOOLTIP} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={points} fill={palette[0]} fillOpacity={0.65} stroke={palette[0]} isAnimationActive={false} />
        {line && sxx ? (
          <ReferenceLine
            segment={[
              { x: x0, y: my + slope * (x0 - mx) },
              { x: x1, y: my + slope * (x1 - mx) },
            ]}
            stroke={palette[3] ?? palette[1]}
            strokeWidth={2}
            ifOverflow="extendDomain"
          />
        ) : null}
      </ScatterChart>
    </Figure>
  );
}

/** Évolution de quelques séries sur plusieurs exercices (courbes ; un trou si la valeur manque). */
export function TrendChart({ title, categories, series, format = (v: number) => fr(v, 0), note }: { title: string; categories: string[]; series: Array<{ name: string; values: Array<number | null> }>; format?: (v: number) => string; note?: string }) {
  const palette = useChartPalette();
  const rows = categories.map((label, i) => Object.fromEntries([["label", label], ...series.map((s) => [s.name, s.values[i]])]));
  const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (categories.length < 2 || !values.length) return null;
  const crossesZero = Math.min(...values) < 0 && Math.max(...values) > 0;
  return (
    <Figure title={title} height={260} note={note}>
      <LineChart data={rows} margin={{ top: 8, right: 24, bottom: 4, left: 8 }}>
        <CartesianGrid stroke="#eef2f7" />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} axisLine={false} tickLine={false} width={88} tickFormatter={(v: number) => format(v)} />
        {crossesZero || Math.min(...values) < 0 ? <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" /> : null}
        <Tooltip {...TOOLTIP} formatter={(value: unknown) => format(Number(value))} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line key={s.name} type="monotone" dataKey={s.name} stroke={palette[i % palette.length]} strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />
        ))}
      </LineChart>
    </Figure>
  );
}
