"use client";

// ============================================================
// ACADIA — CHAÎNE SCIENTIFIQUE (P15, Partie 6)
//
// Vue compacte à 3 états (✓ / ⚠ / ○) de la chaîne Problématique →
// Objectifs → Cadre théorique → Hypothèses → Variables →
// Indicateurs → Questionnaire → Méthodologie. Chaque état est
// dérivé de données déjà réelles (aucun nouveau calcul
// scientifique, aucun "100 % scientifique" affiché).
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { TheoreticalFrameworkEntry } from "@/lib/core/research/TheoreticalFrameworkTypes";
import type { InstrumentRecord } from "@/contexts/ResearchContext";
import { buildMethodologyRecommendation } from "@/lib/core/methodology/MethodologyRecommendationEngine";

type ChainState = "done" | "warning" | "not_started";

interface ChainStage {
  label: string;
  state: ChainState;
  note?: string;
}

const SYMBOL: Record<ChainState, string> = { done: "✓", warning: "⚠", not_started: "○" };
const COLOR: Record<ChainState, string> = {
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  not_started: "border-slate-200 bg-slate-50 text-slate-400",
};

function computeChain(
  project: ResearchProject,
  theoryEntries: TheoreticalFrameworkEntry[],
  instrument: InstrumentRecord | undefined
): ChainStage[] {
  const hasPrincipal = project.hypotheses.some((h) => h.role === "general" && h.status !== "rejected");

  const operationalized = project.variables.filter((v) => (v.dimensions?.length ?? 0) > 0);
  const variablesState: ChainState =
    project.variables.length === 0 ? "not_started" : operationalized.length === project.variables.length ? "done" : "warning";

  const dimensions = project.variables.flatMap((v) => v.dimensions ?? []);
  const dimensionsWithIndicators = dimensions.filter((d) => (d.indicators?.length ?? 0) > 0);
  const indicatorsState: ChainState =
    dimensions.length === 0
      ? "not_started"
      : dimensionsWithIndicators.length === dimensions.length
      ? "done"
      : "warning";
  const missingIndicatorCount = dimensions.length - dimensionsWithIndicators.length;

  const methodologyRecommendation = buildMethodologyRecommendation(project);
  const methodologyState: ChainState =
    project.methodology.status === "accepted"
      ? "done"
      : methodologyRecommendation.readinessPercent > 0
      ? "warning"
      : "not_started";

  return [
    { label: "Problématique", state: project.problem?.statement ? "done" : "not_started" },
    { label: "Objectifs", state: project.objectives.length > 0 ? "done" : "not_started" },
    { label: "Cadre théorique", state: theoryEntries.length > 0 ? "done" : "not_started" },
    { label: "Hypothèses", state: hasPrincipal ? "done" : "not_started" },
    { label: "Variables", state: variablesState },
    {
      label: "Indicateurs",
      state: indicatorsState,
      note: indicatorsState === "warning" ? `${missingIndicatorCount} dimension(s) sans indicateur` : undefined,
    },
    {
      label: "Questionnaire",
      state: instrument?.questionnaire || instrument?.interviewGuide ? "done" : "not_started",
      note: !instrument ? "questionnaire non généré" : undefined,
    },
    {
      label: "Méthodologie",
      state: methodologyState,
      note: methodologyState !== "done" ? "dépend des choix restants (échantillonnage, collecte...)" : undefined,
    },
  ];
}

export default function ScientificChainStrip({
  project,
  theoryEntries,
  instrument,
}: {
  project: ResearchProject;
  theoryEntries: TheoreticalFrameworkEntry[];
  instrument: InstrumentRecord | undefined;
}) {
  const stages = computeChain(project, theoryEntries, instrument);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Chaîne scientifique</p>
      <p className="mt-1 text-2xs text-slate-400">
        État structurel réel de chaque maillon — jamais « 100 % scientifique ».
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {stages.map((stage) => (
          <div
            key={stage.label}
            className={`rounded-2xl border px-3.5 py-2.5 text-xs font-semibold ${COLOR[stage.state]}`}
            title={stage.note}
          >
            <span className="mr-1.5">{SYMBOL[stage.state]}</span>
            {stage.label}
            {stage.note && <span className="ml-1.5 font-normal opacity-80">— {stage.note}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
