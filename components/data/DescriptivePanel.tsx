"use client";

import { Calculator, RefreshCw } from "lucide-react";
import { FrequencyChart, HistogramChart } from "@/components/charts/Charts";
import { ExportBar } from "@/components/export/ExportBar";
import { descriptiveSheets, descriptivesDocument } from "@/lib/core/export/reports";

import {
  FORMULAS,
  type CategoricalResult,
  type DescriptiveReport,
  type FrequencyRow,
  type OrdinalResult,
  type QuantitativeResult,
  type VariableDescriptive,
} from "@/lib/core/analysis/descriptiveStatistics";

import { STATISTICAL_LABELS } from "./labels";
import { Metric, Pill, Section, buttonClass } from "./ui";

const fmt = (value: number | null | undefined, digits = 3) =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toLocaleString("fr-FR", { maximumFractionDigits: digits });
const pct = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

export default function DescriptivePanel({
  report,
  stale,
  readyCount,
  onRun,
  ordinalMeanColumns,
  onToggleOrdinalMean,
}: {
  report: DescriptiveReport | null;
  stale: boolean;
  readyCount: number;
  onRun: () => void;
  ordinalMeanColumns: number[];
  onToggleOrdinalMean: (column: number) => void;
}) {
  return (
    <div className="space-y-5">
      <Section
        title="Analyse descriptive"
        description="Statistiques calculées par ACADIA à partir des observations importées, après vos exclusions et codes de non-réponse. Aucune IA n'intervient dans ces calculs."
        action={
          <button type="button" className={buttonClass.primary} onClick={onRun} disabled={readyCount === 0}>
            {report ? <RefreshCw size={16} aria-hidden /> : <Calculator size={16} aria-hidden />}
            {report ? "Recalculer" : "Lancer le calcul"}
          </button>
        }
      >
        {readyCount === 0 ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Aucune variable n&apos;a encore un type certain ou confirmé. Confirmez la classification dans l&apos;onglet « Variables » pour pouvoir lancer le calcul.
          </p>
        ) : !report ? (
          <p className="text-sm text-slate-600">{readyCount} variable(s) prête(s) pour l&apos;analyse. Les variables dont le type reste à confirmer seront signalées et non calculées.</p>
        ) : null}
        {report && stale ? (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">
            Vos décisions ont changé depuis le dernier calcul : les résultats affichés ne sont plus à jour. Cliquez sur « Recalculer ».
          </p>
        ) : null}

        {report ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Lignes importées" value={report.rowsTotal.toLocaleString("fr-FR")} />
              <Metric label="Lignes exclues" value={report.rowsExcluded} tone={report.rowsExcluded ? "warn" : undefined} />
              <Metric label="Observations utilisées" value={report.rowsUsed.toLocaleString("fr-FR")} />
              <Metric label="Variables analysées" value={report.results.length} hint={`${report.skipped.length} non analysée(s)`} />
            </div>
            {report.rowsExcluded ? (
              <p className="text-sm text-slate-600">
                Lignes exclues (n° dans le fichier) : {report.excludedSourceRows.slice(0, 20).join(", ")}
                {report.excludedSourceRows.length > 20 ? "…" : ""}
              </p>
            ) : null}
            {report.skipped.length ? (
              <details className="rounded-xl bg-slate-50 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-700">Variables non analysées ({report.skipped.length})</summary>
                <ul className="mt-2 space-y-1 text-slate-600">
                  {report.skipped.map((skipped) => (
                    <li key={skipped.column}>
                      <span className="font-medium text-slate-800">{skipped.header}</span> — {skipped.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </Section>

      {report && !stale && report.results.length ? <ExportBar fileBase="acadia-statistiques-descriptives" sheets={() => descriptiveSheets(report.results)} document={(palette) => descriptivesDocument("Statistiques descriptives — ACADIA", report.results, palette)} /> : null}
      {report?.results.map((result) => (
        <VariableCard
          key={result.column}
          result={result}
          meanEnabled={ordinalMeanColumns.includes(result.column)}
          onToggleMean={() => onToggleOrdinalMean(result.column)}
        />
      ))}
    </div>
  );
}

export function VariableCard({ result, meanEnabled, onToggleMean }: { result: VariableDescriptive; meanEnabled: boolean; onToggleMean: () => void }) {
  return (
    <Section
      title={result.header}
      description={
        <>
          {STATISTICAL_LABELS[result.statisticalType]} · n = {result.valid} valide(s) sur {result.rows} ligne(s) · {result.missing} manquante(s) ({pct(result.missingPercent)})
          {result.invalid ? ` · ${result.invalid} valeur(s) non numérique(s) exclue(s) (ex. ${result.invalidExamples.map((v) => `« ${v} »`).join(", ")})` : ""}
        </>
      }
      action={<Pill tone="blue">{result.kind === "quantitative" ? "Quantitative" : result.kind === "ordinal" ? "Ordinale" : "Qualitative"}</Pill>}
    >
      {result.kind === "quantitative" ? <Quantitative result={result} /> : null}
      {result.kind === "categorical" ? <Categorical result={result} /> : null}
      {result.kind === "ordinal" ? <Ordinal result={result} meanEnabled={meanEnabled} onToggleMean={onToggleMean} /> : null}
    </Section>
  );
}

function Quantitative({ result }: { result: QuantitativeResult }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="n valides" value={result.valid} />
        <Metric label="Somme" value={fmt(result.sum)} />
        <Metric label="Moyenne" value={fmt(result.mean)} />
        <Metric label="Médiane" value={fmt(result.median)} />
        <Metric label="Minimum – maximum" value={`${fmt(result.min)} – ${fmt(result.max)}`} hint={`étendue ${fmt(result.range)}`} />
        <Metric label="Écart-type (échantillon)" value={fmt(result.sdSample)} hint={`variance s² = ${fmt(result.varianceSample)}`} />
        <Metric label="Écart-type (population)" value={fmt(result.sdPopulation)} hint={`variance σ² = ${fmt(result.variancePopulation)}`} />
        <Metric label="Q1 / Q3" value={`${fmt(result.q1)} / ${fmt(result.q3)}`} hint={result.q1 === null ? "moins de 4 valeurs" : `écart interquartile ${fmt(result.iqr)}`} />
      </div>
      {result.histogram.length > 1 ? (
        <HistogramChart
          title="Histogramme"
          bins={result.histogram.map((bin, i) => ({
            label: `${fmt(bin.from, 2)}–${fmt(bin.to, 2)}${i === result.histogram.length - 1 ? "" : "["}`,
            count: bin.count,
          }))}
        />
      ) : null}
      <Formulas keys={["valid", "missing", "sum", "mean", "median", "varianceSample", "variancePopulation", "sd", "quartiles", "iqr", "histogram"]} />
    </>
  );
}

function Categorical({ result }: { result: CategoricalResult }) {
  return (
    <>
      <p className="mb-3 text-sm text-slate-700">
        {result.categories} modalité(s) · mode : <span className="font-semibold">{result.modes.join(", ") || "—"}</span>
      </p>
      <FrequencyTable rows={result.frequencies} valid={result.valid} missing={result.missing} cumulative={false} />
      <FrequencyChart title="Répartition par modalité" data={result.frequencies.slice(0, 20).map((row) => ({ label: row.value, count: row.count }))} />
      {result.frequencies.length > 20 ? <p className="text-xs text-slate-500">Graphique limité aux 20 premières modalités ; le tableau les contient toutes.</p> : null}
      <Formulas keys={["valid", "missing", "percent", "mode"]} />
    </>
  );
}

function Ordinal({ result, meanEnabled, onToggleMean }: { result: OrdinalResult; meanEnabled: boolean; onToggleMean: () => void }) {
  const median = result.median ? (result.median.lower === result.median.upper ? result.median.lower : `entre ${result.median.lower} et ${result.median.upper}`) : "non calculable";
  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Médiane" value={median} hint={result.medianCode !== null ? `médiane des codes : ${fmt(result.medianCode)}` : undefined} />
        <Metric label="Mode" value={result.modes.join(", ") || "—"} />
        <Metric label="n valides" value={result.valid} />
        {result.meanRequested && result.meanOfCodes !== null ? <Metric label="Moyenne des codes" value={fmt(result.meanOfCodes)} hint="convention d'intervalles égaux" /> : null}
      </div>
      {!result.orderKnown ? (
        <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          L&apos;ordre des modalités n&apos;est pas connu (ni codes numériques, ni échelle reconnue) : la médiane et les pourcentages cumulés ne sont pas calculés.
        </p>
      ) : null}
      {result.meanAvailable ? (
        <label className="mb-3 flex min-h-10 items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={meanEnabled} onChange={onToggleMean} />
          <span>
            Calculer aussi la moyenne des codes (puis « Recalculer »). {FORMULAS.ordinalMean}
          </span>
        </label>
      ) : null}
      <FrequencyTable rows={result.frequencies} valid={result.valid} missing={result.missing} cumulative={result.orderKnown} />
      <FrequencyChart title="Distribution des réponses" ordered={result.orderKnown} data={result.frequencies.map((row) => ({ label: row.value, count: row.count }))} />
      <Formulas keys={["valid", "missing", "percent", "cumulative", "ordinalMedian", "mode"]} />
    </>
  );
}

function FrequencyTable({ rows, valid, missing, cumulative }: { rows: FrequencyRow[]; valid: number; missing: number; cumulative: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full min-w-[22rem] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Modalité</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Effectif</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">% des valides</th>
            {cumulative ? <th scope="col" className="px-3 py-2 text-right font-semibold">% cumulé</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.value} className="border-t border-slate-100">
              <td className="max-w-[16rem] truncate px-3 py-1.5 text-slate-800" title={row.value}>
                {row.value}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{row.count}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{pct(row.percent)}</td>
              {cumulative ? <td className="px-3 py-1.5 text-right tabular-nums">{row.cumulativePercent === undefined ? "—" : pct(row.cumulativePercent)}</td> : null}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
          <tr>
            <td className="px-3 py-1.5 font-semibold">Total valides</td>
            <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{valid}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{valid ? pct(100) : "—"}</td>
            {cumulative ? <td /> : null}
          </tr>
          <tr>
            <td className="px-3 py-1.5">Manquantes (hors pourcentages)</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{missing}</td>
            <td />
            {cumulative ? <td /> : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}


function Formulas({ keys }: { keys: Array<keyof typeof FORMULAS> }) {
  return (
    <details className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-slate-700">Formules et conventions</summary>
      <ul className="mt-2 space-y-1 text-slate-600">
        {keys.map((key) => (
          <li key={key}>• {FORMULAS[key]}</li>
        ))}
      </ul>
    </details>
  );
}
