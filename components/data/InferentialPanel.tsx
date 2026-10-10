"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Calculator, RefreshCw } from "lucide-react";

import { preparationKey } from "@/lib/core/analysis/descriptiveStatistics";
import {
  METHOD_LABELS,
  fmt,
  multipleTestingNote,
  runAnalysis,
  selectMethods,
  type AnalysisOutcome,
  type AnalysisReport,
  type Check,
  type MethodId,
} from "@/lib/core/analysis/inferential";
import { statisticalTypeLabel } from "@/lib/core/data/preparation";
import type { ImportedDataset, PreparationState, VariableMetadata } from "@/lib/core/data/types";

import { GroupMeansChart, ScatterPlot, StackedPercentChart } from "@/components/charts/Charts";
import { ExportBar } from "@/components/export/ExportBar";
import { analysesDocument, inferentialSheets } from "@/lib/core/export/reports";

import { buttonClass, inputClass, Pill, Section } from "./ui";

const USABLE = new Set(["nominal", "ordinal", "quantitative_discrete", "quantitative_continuous"]);
const header = (v: VariableMetadata) => v.originalHeader.trim() || v.technicalName;

interface RunResult {
  explanatory: string;
  outcome: AnalysisOutcome;
}

interface RunBatch {
  key: string;
  results: RunResult[];
  note: string | null;
}

export default function InferentialPanel({ dataset, preparation, variables }: { dataset: ImportedDataset; preparation: PreparationState; variables: VariableMetadata[] }) {
  const [question, setQuestion] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [alpha, setAlpha] = useState(0.05);
  const [outcomeColumn, setOutcomeColumn] = useState<number | null>(null);
  const [explanatoryColumns, setExplanatoryColumns] = useState<number[]>([]);
  const [chosen, setChosen] = useState<Record<number, MethodId>>({});
  const [independence, setIndependence] = useState(false);
  const [batch, setBatch] = useState<RunBatch | null>(null);

  const outcome = variables.find((v) => v.column === outcomeColumn) ?? null;
  const selections = useMemo(
    () =>
      outcome
        ? explanatoryColumns
            .map((column) => variables.find((v) => v.column === column))
            .filter((v): v is VariableMetadata => !!v)
            .map((v) => ({ variable: v, selection: selectMethods(dataset, preparation, outcome, v) }))
        : [],
    [dataset, preparation, variables, outcome, explanatoryColumns],
  );
  const methodFor = (column: number, recommended?: MethodId) => chosen[column] ?? recommended;
  const runnable = selections.filter((s) => !s.selection.refused && s.selection.options.length);
  const needsIndependence = runnable.some((s) => s.selection.needsIndependence && !["pearson", "spearman"].includes(methodFor(s.variable.column, s.selection.options.find((o) => o.recommended)?.method) ?? ""));
  const currentKey = `${preparationKey(preparation)}|${alpha}|${outcomeColumn}|${explanatoryColumns.join(",")}|${JSON.stringify(chosen)}|${independence}|${question}|${hypothesis}`;

  const run = () => {
    if (!outcome) return;
    const results = runnable.map(({ variable, selection }) => ({
      explanatory: header(variable),
      outcome: runAnalysis(dataset, preparation, variables, {
        outcomeColumn: outcome.column,
        explanatoryColumn: variable.column,
        method: methodFor(variable.column, selection.options.find((o) => o.recommended)?.method) as MethodId,
        alpha,
        question,
        researchHypothesis: hypothesis,
        independenceConfirmed: independence,
      }),
    }));
    const computed = results.filter((r) => r.outcome.ok).length;
    setBatch({ key: currentKey, results, note: multipleTestingNote(computed, alpha) });
  };

  const toggleExplanatory = (column: number) => setExplanatoryColumns((list) => (list.includes(column) ? list.filter((c) => c !== column) : [...list, column]));

  return (
    <div className="space-y-5">
      <Section
        title="Analyse statistique"
        description="Tests calculés par ACADIA sur les observations importées, après vos exclusions et codes de non-réponse. Les calculs sont déterministes et n'utilisent aucune IA."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Question de recherche examinée</span>
            <input className={inputClass} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex. : Le revenu diffère-t-il selon le sexe des répondants ?" />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">
              Hypothèse de recherche <span className="font-normal text-slate-400">(facultative)</span>
            </span>
            <input className={inputClass} value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="Ex. : Le revenu est positivement associé à l'âge." />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Variable à expliquer</span>
            <select
              className={inputClass}
              value={outcomeColumn ?? ""}
              onChange={(e) => {
                const value = e.target.value === "" ? null : Number(e.target.value);
                setOutcomeColumn(value);
                setExplanatoryColumns((list) => list.filter((c) => c !== value));
              }}
            >
              <option value="">Choisir…</option>
              {variables.map((v) => (
                <option key={v.column} value={v.column} disabled={!USABLE.has(v.effectiveType) || !v.analysisReady}>
                  {header(v)} — {statisticalTypeLabel(v.effectiveType)}
                  {!v.analysisReady ? " (type à confirmer)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Seuil de signification (α)</span>
            <select className={inputClass} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))}>
              <option value={0.05}>0,05 (usuel)</option>
              <option value={0.01}>0,01 (plus exigeant)</option>
              <option value={0.1}>0,10 (exploratoire)</option>
            </select>
          </label>
        </div>

        {outcome ? (
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-medium text-slate-700">Variable(s) explicative(s) — une analyse par variable</legend>
            <div className="flex flex-wrap gap-2">
              {variables
                .filter((v) => v.column !== outcome.column)
                .map((v) => {
                  const usable = USABLE.has(v.effectiveType) && v.analysisReady;
                  return (
                    <label key={v.column} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm ring-1 ${usable ? "bg-white text-slate-700 ring-slate-200" : "bg-slate-50 text-slate-400 ring-slate-100"}`}>
                      <input type="checkbox" className="h-4 w-4" disabled={!usable} checked={explanatoryColumns.includes(v.column)} onChange={() => toggleExplanatory(v.column)} />
                      {header(v)} <span className="text-xs text-slate-400">({statisticalTypeLabel(v.effectiveType)})</span>
                    </label>
                  );
                })}
            </div>
            <p className="mt-2 text-xs text-slate-500">Les variables grisées ne sont pas utilisables : identifiant, texte libre, date, ou type non confirmé (onglet « Variables »).</p>
          </fieldset>
        ) : null}

        {selections.length ? (
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Méthodes compatibles</h3>
            {selections.map(({ variable, selection }) => (
              <div key={variable.column} className="rounded-2xl border border-slate-200 p-4 text-sm">
                <p className="font-semibold text-slate-900">
                  « {header(variable)} » → « {outcome ? header(outcome) : ""} »
                </p>
                {selection.refused ? (
                  <p className="mt-2 rounded-xl bg-red-50 p-3 text-red-800">Analyse non adaptée : {selection.refused}</p>
                ) : (
                  <div className="mt-2 space-y-2" role="radiogroup" aria-label={`Méthode pour ${header(variable)}`}>
                    {selection.options.map((option) => {
                      const checked = methodFor(variable.column, selection.options.find((o) => o.recommended)?.method) === option.method;
                      return (
                        <label key={option.method} className={`flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ${checked ? "bg-blue-50 ring-blue-200" : "ring-slate-200"}`}>
                          <input type="radio" className="mt-1 h-4 w-4 shrink-0" name={`method-${variable.column}`} checked={checked} onChange={() => setChosen((c) => ({ ...c, [variable.column]: option.method }))} />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                              {METHOD_LABELS[option.method]} {option.recommended ? <Pill tone="green">Recommandée</Pill> : null}
                            </span>
                            <span className="mt-1 block text-slate-600">{option.why}</span>
                            {option.difference ? <span className="mt-1 block text-slate-500">{option.difference}</span> : null}
                          </span>
                        </label>
                      );
                    })}
                    {selection.notes.map((note) => (
                      <p key={note} className="text-slate-600">
                        {note}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {needsIndependence ? (
          <label className="mt-4 flex min-h-11 items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={independence} onChange={(e) => setIndependence(e.target.checked)} />
            <span>
              Je confirme que chaque ligne correspond à une unité différente (personne, entreprise…) et qu&apos;aucune n&apos;apparaît dans plusieurs groupes. <span className="block text-xs">Les tests de comparaison et le Chi² supposent des observations indépendantes ; ils ne conviennent pas à des mesures répétées sur les mêmes personnes (avant/après, par exemple).</span>
            </span>
          </label>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className={buttonClass.primary} onClick={run} disabled={!runnable.length}>
            {batch ? <RefreshCw size={16} aria-hidden /> : <Calculator size={16} aria-hidden />}
            {batch ? "Relancer le calcul" : "Lancer le calcul"}
          </button>
          {!outcome ? <span className="text-sm text-slate-500">Choisissez la variable à expliquer.</span> : !explanatoryColumns.length ? <span className="text-sm text-slate-500">Choisissez au moins une variable explicative.</span> : null}
        </div>
      </Section>

      {batch && batch.key !== currentKey ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">
          Vos choix ou vos données ont changé depuis le dernier calcul : les résultats ci-dessous ne sont plus à jour. Cliquez sur « Relancer le calcul ».
        </p>
      ) : null}
      {batch && batch.key === currentKey && batch.results.some((r) => r.outcome.ok) ? (
        <ExportBar
          fileBase="acadia-tests-statistiques"
          sheets={() => inferentialSheets(batch.results.flatMap((r) => (r.outcome.ok ? [r.outcome.report] : [])))}
          document={(palette) => analysesDocument("Analyses statistiques — ACADIA", batch.results.flatMap((r) => (r.outcome.ok ? [r.outcome.report] : [])), batch.note, palette)}
        />
      ) : null}
      {batch?.note ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">
          <span className="font-semibold">Comparaisons multiples : </span>
          {batch.note}
        </p>
      ) : null}
      {batch?.results.map(({ explanatory, outcome: result }) =>
        result.ok ? (
          <ReportView key={`${explanatory}-${result.report.method}`} report={result.report} />
        ) : (
          <Section key={explanatory} title={`« ${explanatory} » : calcul non effectué`}>
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
              {result.reason}
            </p>
          </Section>
        ),
      )}
    </div>
  );
}

const STATUS = { ok: { tone: "green", text: "Satisfaite" }, warning: { tone: "yellow", text: "À vérifier" }, failed: { tone: "red", text: "Non satisfaite" } } as const;

export function ReportView({ report }: { report: AnalysisReport }) {
  const outcome = report.variables.find((v) => v.role === "outcome")!;
  const explanatory = report.variables.find((v) => v.role === "explanatory")!;
  return (
    <Section
      title={`${explanatory.header} → ${outcome.header}`}
      description={report.methodLabel}
      action={report.reliable ? <Pill tone={report.significant ? "blue" : "neutral"}>{report.significant ? `Significatif à α = ${fmt(report.alpha)}` : `Non significatif à α = ${fmt(report.alpha)}`}</Pill> : <Pill tone="red">Conditions non satisfaites</Pill>}
    >
      <div className="space-y-5 text-sm break-words">
        <Block n={1} title="Question étudiée">
          <p className="text-slate-800">{report.question}</p>
        </Block>
        <Block n={2} title="Variables">
          <ul className="space-y-1 text-slate-700">
            {report.variables.map((v) => (
              <li key={v.role}>
                <span className="font-medium">{v.role === "outcome" ? "À expliquer" : "Explicative"} :</span> {v.header} ({v.type}, utilisée en {v.usedAs})
              </li>
            ))}
          </ul>
        </Block>
        <Block n={3} title="Observations analysées">
          <p className="text-slate-700">
            <span className="font-semibold">{report.data.n}</span> observation(s) complète(s) sur {report.data.rowsTotal} ligne(s) importée(s) ; {report.data.rowsExcluded} exclue(s) par vous
            {report.data.excludedSourceRows.length ? ` (lignes ${report.data.excludedSourceRows.slice(0, 15).join(", ")}${report.data.excludedSourceRows.length > 15 ? "…" : ""})` : ""} ; {report.data.rowsDropped} écartée(s) car incomplète(s) ou invalide(s).
          </p>
          <ul className="mt-1 text-slate-600">
            {report.data.perVariable.map((v) => (
              <li key={v.header}>
                « {v.header} » : {v.missing} manquante(s){v.invalid ? `, ${v.invalid} invalide(s) (ex. ${v.invalidExamples.map((e) => `« ${e} »`).join(", ")})` : ""}
              </li>
            ))}
          </ul>
          <details className="mt-1 text-slate-600">
            <summary className="cursor-pointer">Lignes du fichier effectivement utilisées</summary>
            <p className="mt-1">{report.data.usedSourceRows.join(", ")}</p>
          </details>
        </Block>
        <Block n={4} title="Méthode et justification">
          <p className="text-slate-700">{report.justification}</p>
        </Block>
        <Block n={5} title="Hypothèses">
          {report.hypotheses.research ? (
            <p className="text-slate-700">
              <span className="font-medium">Hypothèse de recherche (la vôtre) :</span> {report.hypotheses.research}
            </p>
          ) : null}
          <p className="text-slate-700">{report.hypotheses.h0}</p>
          <p className="text-slate-700">{report.hypotheses.h1}</p>
          <p className="text-xs text-slate-500">{report.hypotheses.note}</p>
        </Block>
        <Block n={6} title="Résultats numériques">
          <RowsTable rows={report.results} />
          <Detail report={report} />
        </Block>
        <Block n={7} title="Éléments de vérification du calcul">
          <RowsTable rows={report.verification} />
        </Block>
        <Block n={8} title="p-value">
          <p className="text-slate-700">{report.pInterpretation}</p>
          <p className="mt-1 text-xs text-slate-500">La p-value n&apos;est pas la probabilité que l&apos;hypothèse nulle soit vraie : c&apos;est la probabilité d&apos;observer un écart au moins aussi marqué si elle l&apos;était.</p>
        </Block>
        {report.effect ? (
          <Block n={9} title="Taille d'effet">
            <p className="text-slate-700">
              <span className="font-semibold">
                {report.effect.name} = {fmt(report.effect.value)}
              </span>{" "}
              — ampleur {report.effect.magnitude}.
            </p>
            <p className="mt-1 text-slate-600">{report.effect.explanation}</p>
          </Block>
        ) : null}
        <Block n={10} title="Conditions et limites">
          <ul className="space-y-1.5">
            {report.checks.map((check: Check) => (
              <li key={check.id} className="flex flex-wrap items-start gap-2">
                <Pill tone={STATUS[check.status].tone}>{STATUS[check.status].text}</Pill>
                <span className="min-w-0 flex-1 text-slate-700">
                  <span className="font-medium">{check.label} : </span>
                  {check.detail}
                </span>
              </li>
            ))}
          </ul>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
            {report.limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </Block>
        <Block n={11} title="Interprétation">
          <p className="mb-2">
            <Pill tone="blue">Interprétation déterministe générée par ACADIA (sans IA)</Pill>
          </p>
          <div className="space-y-2 text-slate-700">
            {report.interpretation.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </Block>
        <Block n={12} title="Conclusion">
          <p className="rounded-xl bg-slate-50 p-3 text-slate-800">{report.conclusion}</p>
        </Block>
      </div>
    </Section>
  );
}

function Block({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 font-bold text-slate-900">
        {n}. {title}
      </h3>
      {children}
    </div>
  );
}

function RowsTable({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <table className="w-full text-left">
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row" className="w-1/2 py-1.5 pr-3 align-top font-medium text-slate-600">
              {row.label}
            </th>
            <td className="py-1.5 align-top tabular-nums text-slate-900">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Detail({ report }: { report: AnalysisReport }) {
  const detail = report.detail;
  if (detail.kind === "chi_square") {
    const r = detail.result;
    const cell = (i: number, j: number) => r.observed[i][j];
    return (
      <div className="mt-3 space-y-3">
        <StackedPercentChart title={`Répartition de « ${detail.colVariable} » selon « ${detail.rowVariable} »`} rowLabels={detail.rowLabels} colLabels={detail.colLabels} observed={r.observed} />
        <CrossTable
          title={`Effectifs observés (lignes : « ${detail.rowVariable} », colonnes : « ${detail.colVariable} »)`}
          rowLabels={detail.rowLabels}
          colLabels={detail.colLabels}
          value={(i, j) => String(cell(i, j))}
          rowTotal={(i) => String(r.rowTotals[i])}
          colTotal={(j) => String(r.colTotals[j])}
          total={String(r.n)}
        />
        <CrossTable title="Pourcentages en ligne (répartition des colonnes dans chaque ligne)" rowLabels={detail.rowLabels} colLabels={detail.colLabels} value={(i, j) => `${fmt((cell(i, j) / r.rowTotals[i]) * 100, 1)} %`} rowTotal={() => "100 %"} />
        <CrossTable title="Pourcentages en colonne (répartition des lignes dans chaque colonne)" rowLabels={detail.rowLabels} colLabels={detail.colLabels} value={(i, j) => `${fmt((cell(i, j) / r.colTotals[j]) * 100, 1)} %`} colTotal={() => "100 %"} />
        <CrossTable title="Effectifs attendus si les variables étaient indépendantes" rowLabels={detail.rowLabels} colLabels={detail.colLabels} value={(i, j) => fmt(r.expected[i][j], 2)} highlight={(i, j) => r.expected[i][j] < 5} />
      </div>
    );
  }
  if (detail.kind === "welch_t") {
    return <GroupMeansChart title={`Moyenne de « ${detail.measure} » selon « ${detail.grouping} »`} groups={detail.result.groups.map((g) => ({ label: g.label, mean: g.mean, sd: g.sd, n: g.n }))} />;
  }
  if (detail.kind === "pearson" || detail.kind === "spearman") {
    return <ScatterPlot title={`« ${detail.y} » en fonction de « ${detail.x} »`} points={detail.points} xLabel={detail.x} yLabel={detail.y} line={detail.kind === "pearson"} />;
  }
  if (detail.kind === "anova") {
    const r = detail.result;
    const rows = [
      ["Inter-groupes", r.ssBetween, r.dfBetween, r.msBetween],
      ["Intra-groupes", r.ssWithin, r.dfWithin, r.msWithin],
      ["Total", r.ssTotal, r.dfBetween + r.dfWithin, NaN],
    ] as const;
    return (
      <div className="mt-3 overflow-x-auto">
        <GroupMeansChart title={`Moyenne de « ${detail.measure} » selon « ${detail.grouping} »`} groups={r.groups.map((g) => ({ label: g.label, mean: g.mean, sd: g.sd, n: g.n }))} />
        <p className="mb-1 mt-4 font-medium text-slate-700">Tableau d&apos;ANOVA</p>
        <table className="w-full min-w-[420px] text-left">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1 pr-3">Source</th>
              <th className="py-1 pr-3 text-right">Somme des carrés</th>
              <th className="py-1 pr-3 text-right">ddl</th>
              <th className="py-1 pr-3 text-right">Carré moyen</th>
              <th className="py-1 text-right">F</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {rows.map(([label, ss, df, ms], i) => (
              <tr key={label}>
                <td className="py-1 pr-3">{label}</td>
                <td className="py-1 pr-3 text-right">{fmt(ss)}</td>
                <td className="py-1 pr-3 text-right">{df}</td>
                <td className="py-1 pr-3 text-right">{Number.isNaN(ms) ? "" : fmt(ms)}</td>
                <td className="py-1 text-right">{i === 0 ? fmt(r.statistic) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

function CrossTable({
  title,
  rowLabels,
  colLabels,
  value,
  rowTotal,
  colTotal,
  total,
  highlight,
}: {
  title: string;
  rowLabels: string[];
  colLabels: string[];
  value: (i: number, j: number) => string;
  rowTotal?: (i: number) => string;
  colTotal?: (j: number) => string;
  total?: string;
  highlight?: (i: number, j: number) => boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-1 font-medium text-slate-700">{title}</p>
      <table className="min-w-full text-left tabular-nums">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="py-1 pr-3" />
            {colLabels.map((c) => (
              <th key={c} scope="col" className="py-1 pr-3 text-right font-semibold">
                {c}
              </th>
            ))}
            {rowTotal ? <th className="py-1 text-right font-semibold">Total</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rowLabels.map((r, i) => (
            <tr key={r}>
              <th scope="row" className="py-1 pr-3 font-medium text-slate-700">
                {r}
              </th>
              {colLabels.map((c, j) => (
                <td key={c} className={`py-1 pr-3 text-right ${highlight?.(i, j) ? "font-semibold text-red-700" : ""}`}>
                  {value(i, j)}
                </td>
              ))}
              {rowTotal ? <td className="py-1 text-right text-slate-500">{rowTotal(i)}</td> : null}
            </tr>
          ))}
          {colTotal ? (
            <tr>
              <th scope="row" className="py-1 pr-3 font-medium text-slate-500">
                Total
              </th>
              {colLabels.map((c, j) => (
                <td key={c} className="py-1 pr-3 text-right text-slate-500">
                  {colTotal(j)}
                </td>
              ))}
              {rowTotal ? <td className="py-1 text-right text-slate-500">{total ?? ""}</td> : null}
            </tr>
          ) : null}
        </tbody>
      </table>
      {highlight ? <p className="mt-1 text-xs text-slate-500">En rouge : effectifs attendus inférieurs à 5.</p> : null}
    </div>
  );
}
