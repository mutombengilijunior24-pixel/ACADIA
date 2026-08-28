"use client";

import { CheckCircle2 } from "lucide-react";
import type { CoefficientRow } from "@/lib/core/analysis/EconometricModelTypes";
import { formatStat } from "@/lib/core/analysis/StatisticsMath";
import EconometricInfoTip from "./EconometricInfoTip";

const ROLE_LABELS: Record<CoefficientRow["role"], string> = {
  intercept: "Constante",
  principal: "Principale",
  control: "Contrôle",
};

export default function CoefficientsTable({
  intercept,
  coefficients,
}: {
  intercept: CoefficientRow | null;
  coefficients: CoefficientRow[];
}) {
  const rows = [...(intercept ? [intercept] : []), ...coefficients];

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50">
          <tr>
            {["Variable", "Rôle", "Coefficient (β)", "Erreur standard", "t", "p", "IC 95 %"].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-2xs font-bold uppercase tracking-wider text-slate-400">
                {h === "Erreur standard" ? (
                  <>
                    {h}
                    <EconometricInfoTip label="Erreur standard" text="Mesure la précision du coefficient estimé — plus elle est faible, plus l'estimation est stable." />
                  </>
                ) : h === "p" ? (
                  <>
                    {h}
                    <EconometricInfoTip label="p-value" text="Teste l'hypothèse que le coefficient vaut réellement 0 dans la population. p < 0,05 : peu probable que l'effet observé soit dû au hasard." />
                  </>
                ) : (
                  h
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.name} className={row.significant ? "bg-acadia-blue-50/40" : undefined}>
              <td className="whitespace-nowrap px-3 py-2 font-semibold text-acadia-navy">{row.label}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-500">{ROLE_LABELS[row.role]}</td>
              <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">
                {row.coefficient >= 0 ? "+" : ""}
                {formatStat(row.coefficient)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatStat(row.standardError)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatStat(row.tStatistic)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                <span className="inline-flex items-center gap-1">
                  {formatStat(row.pValue, 3)}
                  {row.significant && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                {row.confidenceInterval ? `[${formatStat(row.confidenceInterval[0])} ; ${formatStat(row.confidenceInterval[1])}]` : "N/A"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-slate-100 px-3 py-2 text-2xs text-slate-400">
        Les lignes surlignées sont statistiquement significatives au seuil de 5 %. Un coefficient significatif
        indique une association conditionnelle, jamais un effet causal prouvé.
      </p>
    </div>
  );
}
