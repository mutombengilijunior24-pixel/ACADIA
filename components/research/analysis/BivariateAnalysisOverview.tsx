"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, GitCompareArrows } from "lucide-react";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset, DatasetColumn } from "@/lib/core/dataset/DatasetTypes";
import {
  buildBivariateAnalysis,
  computeBivariateReadiness,
  DEFAULT_ALPHA,
} from "@/lib/core/analysis/BivariateAnalysisEngine";
import type { BivariateAnalysis } from "@/lib/core/analysis/BivariateAnalysisTypes";
import { formatStat } from "@/lib/core/analysis/StatisticsMath";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";
import ContingencyTableView from "./ContingencyTableView";
import BivariateChart from "./BivariateChart";
import { interpretBivariateResult } from "@/lib/core/analysis/EconomicInterpretationEngine";
import AnnotatedBlock from "./AnnotatedBlock";

const MEASUREMENT_LABELS: Record<string, string> = {
  nominal: "nominal",
  ordinal: "ordinal",
  interval: "intervalle",
  ratio: "ratio",
};

function columnOptionLabel(column: DatasetColumn): string {
  const role = column.role ? `, ${column.role}` : "";
  return `${column.name} — ${column.label} (${MEASUREMENT_LABELS[column.measurementLevel] ?? column.measurementLevel}${role})`;
}

interface BivariateAnalysisOverviewProps {
  project: ResearchProject;
  dataset?: Dataset;
}

export default function BivariateAnalysisOverview({ project, dataset }: BivariateAnalysisOverviewProps) {
  const eligibleColumns = (dataset?.columns ?? []).filter((c) => c.dataType !== "text" && c.dataType !== "date");

  const defaultX = eligibleColumns.find((c) => c.role === "independent") ?? eligibleColumns[0];
  const defaultY = eligibleColumns.find((c) => c.role === "dependent" && c.id !== defaultX?.id) ?? eligibleColumns[1];

  const [xId, setXId] = useState<string>(defaultX?.id ?? "");
  const [yId, setYId] = useState<string>(defaultY?.id ?? "");
  const [analysis, setAnalysis] = useState<BivariateAnalysis | null>(null);
  const [history, setHistory] = useState<BivariateAnalysis[]>([]);

  if (project.researchType === "qualitative") {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
          <GitCompareArrows className="h-3.5 w-3.5" /> Analyse bivariée
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Le projet utilise une approche qualitative. L&apos;analyse bivariée quantitative n&apos;est pas
          applicable à ce stade.
        </p>
      </section>
    );
  }

  if (!dataset || eligibleColumns.length < 2) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
          <GitCompareArrows className="h-3.5 w-3.5" /> Analyse bivariée
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Au moins deux variables exploitables (hors texte libre / date) sont nécessaires dans le dataset pour
          lancer une analyse bivariée.
        </p>
      </section>
    );
  }

  function handleAnalyze() {
    if (!dataset || !xId || !yId) return;
    const result = buildBivariateAnalysis(project, dataset, xId, yId, DEFAULT_ALPHA);
    setAnalysis(result);
    setHistory((prev) => [result, ...prev].slice(0, 10));
  }

  const readiness = analysis ? computeBivariateReadiness(analysis) : null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
        <GitCompareArrows className="h-3.5 w-3.5" /> Analyse bivariée
      </p>
      <h2 className="mt-1 text-lg font-bold text-acadia-navy">{project.title}</h2>

      {/* SÉLECTION X / Y (P7.2) */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Variable X</span>
          <select
            value={xId}
            onChange={(e) => setXId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-acadia-blue focus:outline-none"
          >
            {eligibleColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {columnOptionLabel(c)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Variable Y</span>
          <select
            value={yId}
            onChange={(e) => setYId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-acadia-blue focus:outline-none"
          >
            {eligibleColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {columnOptionLabel(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-3 text-2xs text-slate-400">
        X et Y sont ici des variables statistiques. Cette sélection ne constitue pas une preuve de causalité.
      </p>

      <div className="mt-4">
        <ResearchPrimaryButton onClick={handleAnalyze} disabled={!xId || !yId || xId === yId}>
          Analyser la relation
        </ResearchPrimaryButton>
        {xId === yId && <p className="mt-2 text-2xs text-amber-600">Choisissez deux variables différentes.</p>}
      </div>

      {analysis && readiness && (
        <div className="mt-6 space-y-5">
          {/* READINESS (P7.29) */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge ok={readiness.analyzable} label={readiness.label} />
            <span className="text-2xs text-slate-400">Méthode : {analysis.methodLabel}</span>
          </div>

          {analysis.status !== "ready" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              {analysis.interpretation.map((line) => (
                <p key={line} className="flex items-start gap-1.5 text-sm text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {line}
                </p>
              ))}
              {analysis.warnings.map((w) => (
                <p key={w} className="mt-1 text-xs text-amber-600">
                  {w}
                </p>
              ))}
            </div>
          ) : (
            <>
              {/* RÉSULTAT */}
              <div className="rounded-2xl bg-slate-50/70 p-4">
                <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Résultat</p>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
                  <span>
                    Méthode : <strong className="text-acadia-navy">{analysis.methodLabel}</strong>
                  </span>
                  <span>
                    n = <strong className="text-acadia-navy">{analysis.validPairCount}</strong>
                  </span>
                  {analysis.chiSquare?.chiSquare !== null && analysis.chiSquare && (
                    <>
                      <span>
                        χ²({analysis.chiSquare.degreesOfFreedom}) = <strong className="text-acadia-navy">{formatStat(analysis.chiSquare.chiSquare)}</strong>
                      </span>
                      <span>
                        p = <strong className="text-acadia-navy">{formatStat(analysis.chiSquare.pValue, 3)}</strong>
                      </span>
                      {analysis.chiSquare.cramersV !== null && (
                        <span>
                          V de Cramér = <strong className="text-acadia-navy">{formatStat(analysis.chiSquare.cramersV)}</strong>
                        </span>
                      )}
                    </>
                  )}
                  {(analysis.method === "pearson_spearman" || analysis.method === "spearman") && (
                    <>
                      {analysis.pearson?.coefficient !== null && analysis.pearson && (
                        <span>
                          r = <strong className="text-acadia-navy">{formatStat(analysis.pearson.coefficient)}</strong>
                        </span>
                      )}
                      {analysis.spearman?.coefficient !== null && analysis.spearman && (
                        <span>
                          rho = <strong className="text-acadia-navy">{formatStat(analysis.spearman.coefficient)}</strong>
                        </span>
                      )}
                      {(analysis.pearson?.pValue ?? analysis.spearman?.pValue) !== null && (
                        <span>
                          p = <strong className="text-acadia-navy">{formatStat(analysis.pearson?.pValue ?? analysis.spearman?.pValue, 3)}</strong>
                        </span>
                      )}
                    </>
                  )}
                </div>
                {analysis.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {analysis.warnings.map((w) => (
                      <p key={w} className="flex items-start gap-1 text-2xs text-amber-600">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {analysis.scientificModelNote && (
                <p className="rounded-xl bg-acadia-blue-50 p-3 text-xs text-acadia-navy">{analysis.scientificModelNote}</p>
              )}

              {analysis.hypothesisLink && (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
                  <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                    Hypothèse {analysis.hypothesisLink.hypothesisId}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{analysis.hypothesisLink.statement}</p>
                  <p className="mt-2 text-xs font-semibold text-acadia-blue">Statut : {analysis.hypothesisLink.note}</p>
                </div>
              )}

              {/* TABLEAU CROISÉ */}
              {analysis.chiSquare && (
                <ContingencyTableView block={analysis.chiSquare} xLabel={analysis.variableX.label} yLabel={analysis.variableY.label} />
              )}

              {/* COMPARAISON DE GROUPES */}
              {analysis.groupComparison && (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Groupe", "N", "Moyenne", "Médiane", "Écart-type", "Min", "Max"].map((h) => (
                          <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-2xs font-bold uppercase tracking-wider text-slate-400">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analysis.groupComparison.groups.map((g) => (
                        <tr key={g.groupLabel}>
                          <td className="whitespace-nowrap px-3 py-2 font-semibold text-acadia-navy">{g.groupLabel}</td>
                          <td className="px-3 py-2 text-slate-600">{g.n}</td>
                          <td className="px-3 py-2 text-slate-600">{formatStat(g.mean)}</td>
                          <td className="px-3 py-2 text-slate-600">{formatStat(g.median)}</td>
                          <td className="px-3 py-2 text-slate-600">{formatStat(g.standardDeviation)}</td>
                          <td className="px-3 py-2 text-slate-600">{formatStat(g.min)}</td>
                          <td className="px-3 py-2 text-slate-600">{formatStat(g.max)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* GRAPHIQUE */}
              <BivariateChart analysis={analysis} />

              {/* LECTURE ACADIA */}
              <div className="rounded-2xl bg-acadia-navy p-5 text-white">
                <p className="text-xs font-bold tracking-wider text-acadia-blue-light uppercase">Lecture ACADIA</p>
                <ul className="mt-2 space-y-1.5">
                  {analysis.interpretation.map((line) => (
                    <li key={line} className="flex items-start gap-1.5 text-sm text-slate-200">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-acadia-blue-light" /> {line}
                    </li>
                  ))}
                </ul>
              </div>

              {/* ASSOCIATION ≠ CAUSALITÉ (P7.13) */}
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-800">
                  <strong>Association ≠ causalité.</strong> Une association statistique ou une corrélation ne
                  constitue pas, à elle seule, une preuve de causalité. L&apos;analyse économétrique et le cadre
                  théorique sont nécessaires pour approfondir cette relation.
                </p>
              </div>

              {/* P9.2 — INTERPRÉTATION ÉCONOMIQUE DU RÉSULTAT BIVARIÉ */}
              {(() => {
                const bivariateInterpretation = interpretBivariateResult(analysis, project);
                return bivariateInterpretation.available ? (
                  <AnnotatedBlock
                    researchId={project.id}
                    blockId={bivariateInterpretation.block.id}
                    title="Interprétation économique de l'association"
                    statements={bivariateInterpretation.block.statements}
                  />
                ) : null;
              })()}
            </>
          )}
        </div>
      )}

      {/* HISTORIQUE DE SESSION (P7.27) — non persisté : recalculable à tout moment depuis le Dataset */}
      {history.length > 1 && (
        <div className="mt-6">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Analyses de cette session</p>
          <ul className="mt-2 space-y-1">
            {history.map((h, i) => (
              <li key={`${h.variableX.columnId}-${h.variableY.columnId}-${i}`} className="text-2xs text-slate-500">
                {h.variableX.label} × {h.variableY.label} — {h.methodLabel}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}
