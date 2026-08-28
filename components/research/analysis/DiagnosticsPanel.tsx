"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { EconometricDiagnostics } from "@/lib/core/analysis/EconometricModelTypes";
import { formatStat } from "@/lib/core/analysis/StatisticsMath";
import EconometricInfoTip from "./EconometricInfoTip";

const ALPHA = 0.05;

export default function DiagnosticsPanel({ diagnostics }: { diagnostics: EconometricDiagnostics }) {
  return (
    <div className="space-y-4">
      {/* VIF */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
        <p className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-400">
          Multicolinéarité (VIF)
          <EconometricInfoTip
            label="VIF"
            text="Mesure dans quelle mesure un régresseur est redondant avec les autres. VIF > 5 signale une redondance à examiner — pas une suppression automatique."
          />
        </p>
        {diagnostics.vif.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">Non pertinent avec un seul régresseur.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs">
              <tbody className="divide-y divide-slate-100">
                {diagnostics.vif.map((row) => (
                  <tr key={row.name}>
                    <td className="py-1.5 pr-4 text-slate-600">{row.label}</td>
                    <td className={`py-1.5 text-right font-semibold ${row.concern ? "text-amber-600" : "text-slate-700"}`}>
                      {formatStat(row.vif)}
                      {row.concern && <AlertTriangle className="ml-1 inline h-3 w-3" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HÉTÉROSCÉDASTICITÉ */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
        <p className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-400">
          Hétéroscédasticité (test de Breusch-Pagan)
          <EconometricInfoTip
            label="Hétéroscédasticité"
            text="Vérifie si la dispersion des erreurs varie selon les valeurs des régresseurs. Si détectée, les erreurs standards doivent être interprétées avec prudence."
          />
        </p>
        <DiagnosticLine
          statistic={diagnostics.heteroscedasticity.statistic}
          df={diagnostics.heteroscedasticity.degreesOfFreedom}
          pValue={diagnostics.heteroscedasticity.pValue}
          symbol="LM"
        />
      </div>

      {/* NORMALITÉ */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
        <p className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-400">
          Normalité des résidus (test de Jarque-Bera)
          <EconometricInfoTip
            label="Normalité des résidus"
            text="Vérifie si les résidus suivent approximativement une loi normale — une hypothèse utile pour l'inférence sur petits échantillons."
          />
        </p>
        <DiagnosticLine statistic={diagnostics.normality.statistic} df={2} pValue={diagnostics.normality.pValue} symbol="JB" />
        {diagnostics.normality.skewness !== null && (
          <p className="mt-1 text-2xs text-slate-400">
            Asymétrie (skewness) = {formatStat(diagnostics.normality.skewness)} · Aplatissement (kurtosis) ={" "}
            {formatStat(diagnostics.normality.kurtosis)}
          </p>
        )}
      </div>

      {/* OBSERVATIONS INFLUENTES */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Observations influentes (distance de Cook)</p>
        {diagnostics.influentialObservations.length === 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Aucune observation fortement influente détectée (seuil D &gt; 4/n).
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {diagnostics.influentialObservations.map((obs) => (
              <li key={obs.rowIndex} className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" /> {obs.respondentLabel} — D = {formatStat(obs.cooksDistance)}, levier ={" "}
                {formatStat(obs.leverage)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DiagnosticLine({
  statistic,
  df,
  pValue,
  symbol,
}: {
  statistic: number | null;
  df: number;
  pValue: number | null;
  symbol: string;
}) {
  if (statistic === null || pValue === null) {
    return <p className="mt-1 text-xs text-slate-400">Non calculable dans cette configuration.</p>;
  }
  const flagged = pValue < ALPHA;
  return (
    <p className={`mt-1 text-xs ${flagged ? "text-amber-600" : "text-slate-600"}`}>
      {symbol}({df}) = {formatStat(statistic)}, p = {formatStat(pValue, 3)} —{" "}
      {flagged ? "écart détecté au seuil de 5 %" : "aucun écart détecté au seuil de 5 %"}.
    </p>
  );
}
