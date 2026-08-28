"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FrequencyEntry } from "@/lib/core/analysis/DescriptiveAnalysisTypes";

interface AnalysisChartProps {
  title: string;
  n: number;
  entries: FrequencyEntry[];
}

/**
 * Bar chart générique pour toute variable disposant d'un tableau de
 * fréquences (nominal, ordinal, binaire, choix multiples) — respecte
 * l'ordre déjà établi par le tableau de fréquences (jamais retrié).
 */
export default function AnalysisChart({ title, n, entries }: AnalysisChartProps) {
  const data = entries.map((e) => ({
    label: e.label.length > 18 ? `${e.label.slice(0, 17)}…` : e.label,
    fullLabel: e.label,
    count: e.count,
  }));

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-semibold text-acadia-navy">
        {title} <span className="font-normal text-slate-400">(n = {n})</span>
      </p>
      <div className="mt-3 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) => [String(value), "Effectif"]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""}
            />
            <Bar dataKey="count" fill="#2554eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
