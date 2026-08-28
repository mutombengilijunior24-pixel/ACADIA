"use client";

import { BarChart3, CheckCircle2, AlertTriangle } from "lucide-react";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";
import { checkDatasetQuality } from "@/lib/core/dataset/DatasetEngine";
import { buildDescriptiveAnalysis } from "@/lib/core/analysis/DescriptiveAnalysisEngine";
import VariableAnalysisCard from "./VariableAnalysisCard";

interface AnalysisOverviewProps {
  project: ResearchProject;
  dataset?: Dataset;
}

export default function AnalysisOverview({ project, dataset }: AnalysisOverviewProps) {
  // ----------------------------------------------------------
  // P6.31 — recherche qualitative : jamais d'analyse quantitative
  // forcée. Le dataset issu du guide d'entretien reste intact.
  // ----------------------------------------------------------

  if (project.researchType === "qualitative") {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
          <BarChart3 className="h-3.5 w-3.5" /> Analyse descriptive
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Ce projet utilise une approche qualitative. L&apos;analyse statistique descriptive quantitative
          n&apos;est pas applicable à cet instrument.
        </p>
      </section>
    );
  }

  if (!dataset) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
          <BarChart3 className="h-3.5 w-3.5" /> Analyse descriptive
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Créez d&apos;abord le dataset ci-dessus pour accéder à l&apos;analyse descriptive.
        </p>
      </section>
    );
  }

  // ----------------------------------------------------------
  // P6.23 — dataset vide : jamais de statistique à "0", un appel
  // à l'action explicite à la place.
  // ----------------------------------------------------------

  if (dataset.rows.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
          <BarChart3 className="h-3.5 w-3.5" /> Analyse descriptive
        </p>
        <p className="mt-3 text-sm text-slate-500">Ajoutez des observations pour lancer l&apos;analyse.</p>
      </section>
    );
  }

  const analysis = buildDescriptiveAnalysis(project, dataset);
  const datasetQuality = checkDatasetQuality(dataset);
  const datasetQualityOk = datasetQuality.errorCount === 0;

  const remainingResults = analysis.variableResults.filter(
    (r) => !analysis.sampleProfile.some((p) => p.columnId === r.columnId)
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
            <BarChart3 className="h-3.5 w-3.5" /> Analyse descriptive
          </p>
          <h2 className="mt-1 text-lg font-bold text-acadia-navy">{project.title}</h2>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-6">
        <div>
          <span className="text-3xl font-extrabold text-acadia-blue">{analysis.sampleSize}</span>
          <span className="ml-2 text-sm text-slate-500">observation(s)</span>
        </div>
        <div>
          <span className="text-3xl font-extrabold text-acadia-blue">{dataset.columns.length}</span>
          <span className="ml-2 text-sm text-slate-500">variable(s)</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Badge ok={datasetQualityOk} label="Dataset Quality" />
        <Badge ok={analysis.status === "ready"} label="Analysis Readiness" />
      </div>

      {analysis.status === "partial" && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {analysis.analyzableCount} variable(s) analysée(s) — {analysis.errorCount} variable(s) nécessite(nt)
          une correction (voir le tableau du dataset).
        </p>
      )}

      {/* PROFIL DE L'ÉCHANTILLON (P6.14) */}
      <div className="mt-6">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Profil de l&apos;échantillon</p>
        {analysis.sampleProfile.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">
            Aucune variable sociodémographique identifiée dans cet instrument.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {analysis.sampleProfile.map((entry) => (
              <VariableAnalysisCard key={entry.columnId} result={entry.result} />
            ))}
          </div>
        )}
      </div>

      {/* STATISTIQUES PAR VARIABLE (P6.15/P6.16/P6.17) */}
      <div className="mt-6">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Statistiques descriptives</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {remainingResults.map((result) => (
            <VariableAnalysisCard key={result.columnId} result={result} />
          ))}
        </div>
      </div>

      {/* LECTURE DESCRIPTIVE GLOBALE (P6.20) */}
      <div className="mt-6 rounded-2xl bg-acadia-navy p-5 text-white">
        <p className="text-xs font-bold tracking-wider text-acadia-blue-light uppercase">
          Lecture descriptive ACADIA
        </p>
        <p className="mt-2 text-sm text-slate-200">
          Les résultats ci-dessus décrivent l&apos;échantillon collecté (n = {analysis.sampleSize}). Ils sont
          calculés de façon 100 % déterministe, sans appel à un modèle d&apos;intelligence artificielle.
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Ces statistiques sont descriptives : elles ne permettent pas, à elles seules, d&apos;établir une
          relation, une association ou une causalité entre les variables. Ces analyses appartiennent aux
          blocs suivants (analyse bivariée, économétrie).
        </p>
      </div>
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
