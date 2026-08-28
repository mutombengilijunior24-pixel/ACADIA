"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { DescriptiveVariableResult } from "@/lib/core/analysis/DescriptiveAnalysisTypes";
import { formatInteger, formatPercentage, formatStat } from "@/lib/core/analysis/StatisticsMath";
import AnalysisChart from "./AnalysisChart";

const MEASUREMENT_LABELS: Record<string, string> = {
  nominal: "Nominal",
  ordinal: "Ordinal",
  interval: "Intervalle",
  ratio: "Ratio",
};

export default function VariableAnalysisCard({ result }: { result: DescriptiveVariableResult }) {
  if (!result.analyzable) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
          <AlertTriangle className="h-4 w-4" /> {result.label}
        </p>
        {result.warnings.map((w) => (
          <p key={w} className="mt-1 text-xs text-amber-700">
            {w}
          </p>
        ))}
      </div>
    );
  }

  const hasContent = Boolean(result.numericalStatistics || result.frequencyTable);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-acadia-navy">{result.label}</p>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-2xs font-semibold text-slate-500 ring-1 ring-slate-200">
          {MEASUREMENT_LABELS[result.measurementLevel] ?? result.measurementLevel}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-slate-500">
        <span>N valide : {formatInteger(result.validCount)}</span>
        <span>Manquants : {formatInteger(result.missingCount)}</span>
      </div>

      {result.warnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {result.warnings.map((w) => (
            <p key={w} className="flex items-start gap-1 text-2xs text-amber-600">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      {result.numericalStatistics && (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <tbody>
              <StatRow label="Minimum" value={formatStat(result.numericalStatistics.min)} />
              <StatRow label="Maximum" value={formatStat(result.numericalStatistics.max)} />
              {result.numericalStatistics.mean !== null && (
                <StatRow label="Moyenne" value={formatStat(result.numericalStatistics.mean)} />
              )}
              <StatRow label="Médiane" value={formatStat(result.numericalStatistics.median)} />
              <StatRow
                label="Mode"
                value={
                  result.numericalStatistics.mode
                    ? result.numericalStatistics.mode.map((m) => formatStat(m)).join(" / ")
                    : "N/A"
                }
              />
              {result.numericalStatistics.variance !== null && (
                <StatRow label="Variance" value={formatStat(result.numericalStatistics.variance)} />
              )}
              {result.numericalStatistics.standardDeviation !== null && (
                <StatRow label="Écart-type" value={formatStat(result.numericalStatistics.standardDeviation)} />
              )}
            </tbody>
          </table>
        </div>
      )}

      {result.frequencyTable && result.frequencyTable.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <p className="mb-1 text-2xs text-slate-400">Base des pourcentages : réponses valides (N = {result.validCount}).</p>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-2xs uppercase tracking-wider text-slate-400">
                <th className="px-2 py-1 text-left">Modalité</th>
                <th className="px-2 py-1 text-right">N</th>
                <th className="px-2 py-1 text-right">%</th>
                {result.frequencyTable.some((e) => e.cumulativePercentage !== undefined) && (
                  <th className="px-2 py-1 text-right">% cumulé</th>
                )}
              </tr>
            </thead>
            <tbody>
              {result.frequencyTable.map((entry) => (
                <tr key={entry.value} className="border-t border-slate-200/70">
                  <td className="px-2 py-1 text-slate-700">{entry.label}</td>
                  <td className="px-2 py-1 text-right text-slate-600">{entry.count}</td>
                  <td className="px-2 py-1 text-right text-slate-600">{formatPercentage(entry.validPercentage)}</td>
                  {result.frequencyTable!.some((e) => e.cumulativePercentage !== undefined) && (
                    <td className="px-2 py-1 text-right text-slate-400">
                      {entry.cumulativePercentage !== undefined ? formatPercentage(entry.cumulativePercentage) : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.frequencyTable && result.frequencyTable.length > 0 && result.validCount > 0 && (
        <div className="mt-3">
          <AnalysisChart title={`Répartition — ${result.label}`} n={result.validCount} entries={result.frequencyTable} />
        </div>
      )}

      {result.reading && (
        <div className="mt-3 space-y-2 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-emerald-600">
              Ce que ce résultat permet de dire
            </p>
            <ul className="mt-1 space-y-1">
              {result.reading.statements.map((s) => (
                <li key={s} className="flex items-start gap-1.5 text-xs text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" /> {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-amber-600">
              Ce que ce résultat ne permet pas encore de conclure
            </p>
            <p className="mt-1 text-xs text-slate-500">{result.reading.limitation}</p>
          </div>
        </div>
      )}

      {!hasContent && (
        <p className="mt-2 text-2xs text-slate-400">
          Aucune synthèse statistique disponible pour ce type de réponse à ce stade.
        </p>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t border-slate-200/70 first:border-t-0">
      <td className="py-1 pr-4 text-slate-500">{label}</td>
      <td className="py-1 text-right font-semibold text-acadia-navy">{value}</td>
    </tr>
  );
}
