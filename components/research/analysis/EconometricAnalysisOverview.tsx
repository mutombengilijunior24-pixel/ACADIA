"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical } from "lucide-react";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset, DatasetColumn } from "@/lib/core/dataset/DatasetTypes";
import {
  buildEconometricModel,
  computeEconometricReadiness,
  DEFAULT_ALPHA,
  isColumnEligibleForEconometrics,
} from "@/lib/core/analysis/EconometricModelEngine";
import type { EconometricModel } from "@/lib/core/analysis/EconometricModelTypes";
import { formatStat } from "@/lib/core/analysis/StatisticsMath";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";
import CoefficientsTable from "./CoefficientsTable";
import DiagnosticsPanel from "./DiagnosticsPanel";
import EconometricInfoTip from "./EconometricInfoTip";
import EconomicInterpretationOverview from "./EconomicInterpretationOverview";
import ScientificDiscussionOverview from "./ScientificDiscussionOverview";

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

interface EconometricAnalysisOverviewProps {
  project: ResearchProject;
  dataset?: Dataset;
}

export default function EconometricAnalysisOverview({ project, dataset }: EconometricAnalysisOverviewProps) {
  const eligibleColumns = (dataset?.columns ?? []).filter(isColumnEligibleForEconometrics);
  const eligibleYColumns = eligibleColumns.filter((c) => c.dataType !== "boolean" && c.measurementLevel !== "nominal");

  const defaultY = eligibleYColumns.find((c) => c.role === "dependent") ?? eligibleYColumns[0];
  const defaultPrincipal = eligibleColumns.filter((c) => c.role === "independent" && c.id !== defaultY?.id).map((c) => c.id);
  const defaultControls = eligibleColumns.filter((c) => c.role === "control" && c.id !== defaultY?.id).map((c) => c.id);

  const [yId, setYId] = useState<string>(defaultY?.id ?? "");
  const [principalIds, setPrincipalIds] = useState<string[]>(defaultPrincipal);
  const [controlIds, setControlIds] = useState<string[]>(defaultControls);
  const [model, setModel] = useState<EconometricModel | null>(null);
  const [estimatedAtDatasetVersion, setEstimatedAtDatasetVersion] = useState<string | null>(null);

  if (project.researchType === "qualitative") {
    return (
      <>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
            <FlaskConical className="h-3.5 w-3.5" /> Modèle économétrique
          </p>
          <p className="mt-3 text-sm text-slate-600">
            L&apos;analyse économétrique quantitative n&apos;est pas applicable à ce projet qualitatif dans sa
            configuration actuelle.
          </p>
        </section>
        <div className="mt-6">
          <ScientificDiscussionOverview project={project} dataset={dataset} model={null} />
        </div>
      </>
    );
  }

  if (!dataset || eligibleColumns.length < 2) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
          <FlaskConical className="h-3.5 w-3.5" /> Modèle économétrique
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Au moins deux variables exploitables (hors texte libre / date) sont nécessaires dans le dataset pour
          spécifier un modèle.
        </p>
      </section>
    );
  }

  // P8.53 — projet descriptif : aucun modèle imposé, construction manuelle uniquement.
  const hasHypotheticalRelation = project.variables.some((v) => v.role === "independent") && project.variables.some((v) => v.role === "dependent");

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function handleEstimate() {
    if (!dataset || !yId) return;
    const result = buildEconometricModel(project, dataset, yId, principalIds, controlIds, DEFAULT_ALPHA);
    setModel(result);
    setEstimatedAtDatasetVersion(dataset.updatedAt);
  }

  const readiness = model ? computeEconometricReadiness(model) : null;
  const xAvailable = eligibleColumns.filter((c) => c.id !== yId);
  const isStale = Boolean(model && dataset && estimatedAtDatasetVersion !== null && dataset.updatedAt !== estimatedAtDatasetVersion);

  return (
    <>
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
        <FlaskConical className="h-3.5 w-3.5" /> Modèle économétrique
      </p>
      <h2 className="mt-1 text-lg font-bold text-acadia-navy">{project.title}</h2>

      {!hasHypotheticalRelation && (
        <p className="mt-2 text-xs text-slate-500">
          Le projet ne contient pas actuellement de relation indépendante/dépendante validée. Vous pouvez
          néanmoins construire un modèle manuellement ci-dessous — cela ne modifie pas le caractère descriptif
          du projet.
        </p>
      )}

      {/* SÉLECTION DU MODÈLE */}
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Variable Y (expliquée)</span>
          <select
            value={yId}
            onChange={(e) => {
              setYId(e.target.value);
              setPrincipalIds((prev) => prev.filter((id) => id !== e.target.value));
              setControlIds((prev) => prev.filter((id) => id !== e.target.value));
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-acadia-blue focus:outline-none sm:max-w-md"
          >
            <option value="">— Sélectionner —</option>
            {eligibleYColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {columnOptionLabel(c)}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Variables X principales</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {xAvailable.map((c) => (
              <ChipToggle
                key={c.id}
                label={c.name}
                active={principalIds.includes(c.id)}
                onClick={() => toggle(principalIds, setPrincipalIds, c.id)}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Variables de contrôle</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {xAvailable
              .filter((c) => !principalIds.includes(c.id))
              .map((c) => (
                <ChipToggle
                  key={c.id}
                  label={c.name}
                  active={controlIds.includes(c.id)}
                  onClick={() => toggle(controlIds, setControlIds, c.id)}
                />
              ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ResearchPrimaryButton
          onClick={() => {
            handleEstimate();
          }}
          disabled={!yId || principalIds.length + controlIds.length === 0}
        >
          Estimer le modèle
        </ResearchPrimaryButton>
      </div>

      {model && readiness && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <ReadinessBadge level={readiness.level} label={readiness.label} />
            {isStale && (
              <span className="text-2xs text-amber-600">Les données ont changé depuis cette estimation. Veuillez réestimer le modèle.</span>
            )}
          </div>

          {model.status !== "ready" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              {model.warnings.map((w) => (
                <p key={w} className="flex items-start gap-1.5 text-sm text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                </p>
              ))}
            </div>
          ) : (
            <>
              {/* ÉQUATION */}
              <div className="overflow-x-auto rounded-2xl bg-slate-50/70 p-4">
                <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Équation estimée</p>
                <p className="mt-1 whitespace-nowrap font-mono text-xs text-acadia-navy">{model.equation}</p>
              </div>

              {model.warnings.length > 0 && (
                <div className="space-y-1">
                  {model.warnings.map((w) => (
                    <p key={w} className="flex items-start gap-1.5 text-2xs text-amber-600">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                    </p>
                  ))}
                </div>
              )}

              {/* RÉSUMÉ DU MODÈLE */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl bg-slate-50/70 p-4 text-sm text-slate-700">
                <span>
                  n = <strong className="text-acadia-navy">{model.validObservationCount}</strong>
                </span>
                <span className="inline-flex items-center">
                  R² = <strong className="ml-1 text-acadia-navy">{formatStat(model.r2)}</strong>
                  <EconometricInfoTip label="R²" text="Part de la variance de Y expliquée par le modèle dans l'échantillon — un R² élevé ne garantit pas que le modèle soit correctement spécifié." />
                </span>
                <span>
                  R² ajusté = <strong className="text-acadia-navy">{formatStat(model.adjustedR2)}</strong>
                </span>
                {model.fStatistic !== null && (
                  <span>
                    F({model.regressors.length}, {model.degreesOfFreedomResidual}) ={" "}
                    <strong className="text-acadia-navy">{formatStat(model.fStatistic)}</strong> (p = {formatStat(model.fPValue, 3)})
                  </span>
                )}
              </div>

              {model.hypothesisLinks.map((link) => (
                <div key={link.hypothesisId} className="rounded-2xl border border-slate-200/90 bg-white p-4">
                  <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Hypothèse {link.hypothesisId}</p>
                  <p className="mt-1 text-sm text-slate-700">{link.statement}</p>
                  <p className="mt-2 text-xs font-semibold text-acadia-blue">Statut : {link.note}</p>
                </div>
              ))}

              {/* COEFFICIENTS */}
              <CoefficientsTable intercept={model.intercept} coefficients={model.coefficients} />

              {/* DIAGNOSTICS */}
              {model.diagnostics && <DiagnosticsPanel diagnostics={model.diagnostics} />}

              {/* LECTURE ACADIA */}
              <div className="rounded-2xl bg-acadia-navy p-5 text-white">
                <p className="text-xs font-bold tracking-wider text-acadia-blue-light uppercase">Lecture ACADIA</p>
                <ul className="mt-2 space-y-1.5">
                  {model.interpretation.map((line) => (
                    <li key={line} className="flex items-start gap-1.5 text-sm text-slate-200">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-acadia-blue-light" /> {line}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-800">
                  <strong>Association conditionnelle ≠ causalité.</strong> Un coefficient significatif indique une
                  association « toutes choses égales par ailleurs » entre les variables incluses dans ce modèle,
                  jamais une preuve d&apos;effet causal. L&apos;interprétation économique approfondie fait
                  l&apos;objet du bloc suivant.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </section>

      {model && model.status === "ready" && (
        <>
          <div className="mt-6">
            <EconomicInterpretationOverview project={project} model={model} isStale={isStale} />
          </div>
          <div className="mt-6">
            <ScientificDiscussionOverview project={project} dataset={dataset} model={model} isStale={isStale} />
          </div>
        </>
      )}

      {/* Aucun modèle (pas encore estimé, ou projet descriptif sans relation) :
          P10 propose tout de même une discussion de repli fondée sur les
          statistiques descriptives déjà disponibles — jamais de causalité
          ni d'hypothèse inventée dans ce cas (voir ScientificDiscussionEngine). */}
      {(!model || model.status !== "ready") && dataset && dataset.rows.length > 0 && (
        <div className="mt-6">
          <ScientificDiscussionOverview project={project} dataset={dataset} model={null} />
        </div>
      )}
    </>
  );
}

function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

function ReadinessBadge({ level, label }: { level: "ready" | "to_review" | "impossible"; label: string }) {
  const styles =
    level === "ready"
      ? "bg-emerald-50 text-emerald-700"
      : level === "to_review"
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";
  const emoji = level === "ready" ? "🟢" : level === "to_review" ? "🟠" : "🔴";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>
      {emoji} {label}
    </span>
  );
}
