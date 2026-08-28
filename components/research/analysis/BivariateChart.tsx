"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { BivariateAnalysis } from "@/lib/core/analysis/BivariateAnalysisTypes";

const SERIES_COLORS = ["#2554eb", "#5b82ff", "#173fc2", "#93b0fb", "#0b1b3a"];

function truncateLabel(label: string, max = 16): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

interface BivariateChartProps {
  analysis: BivariateAnalysis;
}

export default function BivariateChart({ analysis }: BivariateChartProps) {
  const scatterPairs = analysis.scatterPairs;
  if (analysis.method === "chi_square" && analysis.chiSquare) {
    const { table } = analysis.chiSquare;
    const data = table.rowLabels.map((rowLabel, ri) => {
      const entry: Record<string, string | number> = { row: truncateLabel(rowLabel) };
      table.colLabels.forEach((colLabel, ci) => {
        entry[colLabel] = table.counts[ri][ci];
      });
      return entry;
    });

    return (
      <ChartFrame
        title={`Répartition croisée — ${analysis.variableX.label} × ${analysis.variableY.label}`}
        n={analysis.validPairCount}
      >
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="row" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {table.colLabels.map((colLabel, i) => (
            <Bar key={colLabel} dataKey={colLabel} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ChartFrame>
    );
  }

  if ((analysis.method === "pearson_spearman" || analysis.method === "spearman") && scatterPairs && scatterPairs.length > 0) {
    const data = scatterPairs.map(([x, y]) => ({ x, y }));

    return (
      <ChartFrame title={`Nuage de points — ${analysis.variableX.label} × ${analysis.variableY.label}`} n={analysis.validPairCount}>
        <ScatterChart margin={{ top: 4, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" />
          <XAxis type="number" dataKey="x" name={analysis.variableX.label} tick={{ fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name={analysis.variableY.label} tick={{ fontSize: 11 }} />
          <ZAxis range={[40, 40]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill="#2554eb" />
        </ScatterChart>
      </ChartFrame>
    );
  }

  if (analysis.method === "group_comparison" && analysis.groupComparison) {
    const data = analysis.groupComparison.groups
      .filter((g) => g.mean !== null)
      .map((g) => ({
        group: truncateLabel(g.groupLabel),
        mean: g.mean ?? 0,
        error: g.standardDeviation ?? 0,
      }));

    return (
      <ChartFrame title={`Moyenne par groupe (± écart-type) — ${analysis.variableX.label} × ${analysis.variableY.label}`} n={analysis.validPairCount}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="group" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="mean" fill="#2554eb" radius={[3, 3, 0, 0]}>
            <ErrorBar dataKey="error" width={4} strokeWidth={1.5} stroke="#0b1b3a" direction="y" />
          </Bar>
        </BarChart>
      </ChartFrame>
    );
  }

  return null;
}

function ChartFrame({ title, n, children }: { title: string; n: number; children: React.ReactElement }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-semibold text-acadia-navy">
        {title} <span className="font-normal text-slate-400">(n = {n})</span>
      </p>
      <div className="mt-3 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
