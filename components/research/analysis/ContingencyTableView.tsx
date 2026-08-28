"use client";

import { useState } from "react";
import type { ChiSquareBlock } from "@/lib/core/analysis/BivariateAnalysisTypes";
import { formatPercentage } from "@/lib/core/analysis/StatisticsMath";

type Mode = "counts" | "row" | "col";

export default function ContingencyTableView({
  block,
  xLabel,
  yLabel,
}: {
  block: ChiSquareBlock;
  xLabel: string;
  yLabel: string;
}) {
  const [mode, setMode] = useState<Mode>("counts");
  const { table } = block;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ModeButton label="Effectifs" active={mode === "counts"} onClick={() => setMode("counts")} />
        <ModeButton label="% par ligne" active={mode === "row"} onClick={() => setMode("row")} />
        <ModeButton label="% par colonne" active={mode === "col"} onClick={() => setMode("col")} />
      </div>
      <p className="mb-2 text-2xs text-slate-400">
        {mode === "counts" && "Effectifs bruts."}
        {mode === "row" && "Pourcentages calculés par ligne (chaque ligne totalise 100 %)."}
        {mode === "col" && "Pourcentages calculés par colonne (chaque colonne totalise 100 %)."}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-2xs font-bold uppercase tracking-wider text-slate-400">
                {xLabel} \ {yLabel}
              </th>
              {table.colLabels.map((c) => (
                <th key={c} className="whitespace-nowrap px-3 py-2 text-right text-2xs font-bold uppercase tracking-wider text-slate-400">
                  {c}
                </th>
              ))}
              {mode === "counts" && (
                <th className="whitespace-nowrap px-3 py-2 text-right text-2xs font-bold uppercase tracking-wider text-slate-400">
                  Total
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.rowLabels.map((rowLabel, ri) => (
              <tr key={rowLabel}>
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-acadia-navy">{rowLabel}</td>
                {table.colLabels.map((_, ci) => (
                  <td key={ci} className="whitespace-nowrap px-3 py-2 text-right text-slate-600">
                    {mode === "counts"
                      ? table.counts[ri][ci]
                      : mode === "row"
                      ? formatPercentage(block.rowPercentages[ri][ci])
                      : formatPercentage(block.columnPercentages[ri][ci])}
                  </td>
                ))}
                {mode === "counts" && (
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-500">{table.rowTotals[ri]}</td>
                )}
              </tr>
            ))}
            {mode === "counts" && (
              <tr className="bg-slate-50/70">
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-500">Total</td>
                {table.colTotals.map((t, ci) => (
                  <td key={ci} className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-500">
                    {t}
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-acadia-navy">{table.grandTotal}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-2xs font-semibold transition ${
        active ? "bg-acadia-blue text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
