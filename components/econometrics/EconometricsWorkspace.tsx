"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { buttonClass, Notice } from "@/components/data/ui";
import { FramingStep } from "@/components/journey/ChainViews";
import { DomainStep } from "@/components/journey/OrchestrationViews";
import { StageNav } from "@/components/journey/StageNav";
import { SAVE_LABELS, useJourneyPersistence } from "@/components/journey/useJourneyPersistence";
import { buildChain, emptyChainDecisions, type ChainDecisions } from "@/lib/core/chain";
import {
  analyzeModel,
  availableVariables,
  buildChapter,
  buildDefenseKit,
  buildModels,
  DEMO_NOTICE,
  ECON_SNAPSHOT_VERSION,
  ECON_STAGES,
  ECON_STEP_LABELS,
  econSteps,
  evaluateHypotheses,
  macroLinks,
  measureOf,
  modelsKey,
  refKey,
  type EconReportInput,
  type EconSnapshot,
  type EconStageId,
  type EconStepId,
  type HypothesisMapping,
  type MacroDataset,
  type Mappings,
  type ModelSettings,
  type ModelSettingsMap,
  type VariableRef,
} from "@/lib/core/econometrics";
import type { EngineHandoff } from "@/lib/core/journey/kinds";
import type { SessionSummary } from "@/lib/core/journey/persistence";
import { STEP_STATE_LABELS } from "@/lib/core/journey/steps";
import { specialtyOf, type DomainId, type SpecialtyId } from "@/lib/core/orchestrator";
import { buildUnderstandingReport, emptyDecisions, validateResearchInput, type ResearchUnderstandingInput } from "@/lib/core/understanding";
import { hashKey } from "@/lib/core/understanding/text";

import { DataStep, emptyEconDataset, type EconSource } from "./DataStep";
import { PresentationView } from "./PresentationView";
import { ChapterView, ReasoningView } from "./ReasoningSteps";
import { EconResearchStep, EconVariablesNote, ModelStep } from "./SubjectSteps";

export interface SavedEconSession {
  revision: number;
  title: string;
  snapshot: EconSnapshot;
}

type Field = { domain: DomainId | null; specialty: SpecialtyId | null; secondary: SpecialtyId[] };

function savedResearch(raw: unknown): ResearchUnderstandingInput | null {
  if (!raw || typeof raw !== "object") return null;
  const v = validateResearchInput(raw as Parameters<typeof validateResearchInput>[0]);
  return v.ok ? v.input : null;
}

const triState = (saved: string | null, current: string) => (saved ? (saved === current ? "confirmed" : "stale") : "none") as "none" | "confirmed" | "stale";
const DEFAULT_SETTINGS: ModelSettings = { transform: "niveau", controls: [] };

/**
 * Moteur « Économétrie et macroéconomie » : des séries temporelles (au moins 5 périodes) au chapitre de
 * résultats. Agrégats, tests et estimations sont calculés dans le navigateur, sans IA ; seules les séries
 * validées et les décisions de l'étudiant sont enregistrées.
 */
export default function EconometricsWorkspace({ sessionId, initial, handoff = null }: { sessionId: string | null; initial: SavedEconSession | null; handoff?: EngineHandoff | null }) {
  const snap = initial?.snapshot ?? null;
  const [field, setField] = useState<Field>(() => (snap?.field ?? handoff?.field ?? { domain: "economics", specialty: null, secondary: [] }) as Field);
  const [fieldConfirmed, setFieldConfirmed] = useState(() => snap?.fieldConfirmed ?? !!handoff);
  const [source, setSource] = useState<EconSource | null>(() => snap?.source ?? null);
  const [dataset, setDataset] = useState<MacroDataset>(() => (snap?.dataset as MacroDataset | undefined) ?? emptyEconDataset());
  const [datasetConfirmedKey, setDatasetConfirmedKey] = useState<string | null>(() => snap?.datasetConfirmedKey ?? null);
  const [presentationSeenKey, setPresentationSeenKey] = useState<string | null>(() => snap?.presentationSeenKey ?? null);
  const [research, setResearch] = useState<ResearchUnderstandingInput | null>(() => savedResearch(snap?.research ?? handoff?.research ?? null));
  const [chainDecisions, setChainDecisions] = useState<ChainDecisions>(() => (snap?.chainDecisions as ChainDecisions | undefined) ?? emptyChainDecisions());
  const [framingConfirmedKey, setFramingConfirmedKey] = useState<string | null>(() => snap?.framingConfirmedKey ?? null);
  const [mappings, setMappings] = useState<Mappings>(() => (snap?.mappings as Mappings | undefined) ?? {});
  const [modelSettings, setModelSettings] = useState<ModelSettingsMap>(() => (snap?.modelSettings as ModelSettingsMap | undefined) ?? {});
  const [modelConfirmedKey, setModelConfirmedKey] = useState<string | null>(() => snap?.modelConfirmedKey ?? null);
  const [reasoningSeenKey, setReasoningSeenKey] = useState<string | null>(() => snap?.reasoningSeenKey ?? null);
  const [chapterKey, setChapterKey] = useState<string | null>(() => snap?.chapterKey ?? null);
  const [view, setView] = useState<EconStepId | null>(() => (snap?.view as EconStepId | null) ?? null);

  // Données : leur empreinte date chaque confirmation (une série modifiée rend la suite « à revoir »).
  const datasetKey = useMemo(() => hashKey(dataset), [dataset]);
  const dataState = triState(datasetConfirmedKey, datasetKey);
  const presentationState = triState(presentationSeenKey, datasetKey);

  // Sujet → chaîne de cohérence → relations économiques.
  const report = useMemo(() => (research ? buildUnderstandingReport(research, emptyDecisions()) : null), [research]);
  const chain = useMemo(() => (research && report ? buildChain({ research, report, decisions: chainDecisions }) : null), [research, report, chainDecisions]);
  const framingKey = chain ? hashKey({ rows: chain.rows.map((r) => [r.questionId, r.objectiveId, r.hypothesisId]), statements: chain.statements.map((s) => s.text) }) : "";
  const framingState = triState(framingConfirmedKey, framingKey);
  const links = useMemo(() => (chain ? macroLinks(chain) : []), [chain]);

  // Variables de chaque hypothèse : le choix de l'étudiant, sinon la mesure proposée d'après le sujet.
  const effectiveMappings = useMemo(() => {
    const known = new Set(availableVariables(dataset).map((v) => refKey(v.ref)));
    const valid = (r: VariableRef | null | undefined) => (r && known.has(refKey(r)) ? r : null);
    return Object.fromEntries(
      links
        .filter((l) => l.hypothesis)
        .map((l) => {
          const saved = mappings[l.rowId];
          const m: HypothesisMapping = saved
            ? { dependent: valid(saved.dependent), independent: valid(saved.independent), sign: saved.sign }
            : { dependent: measureOf(l.effect, dataset), independent: measureOf(l.cause, dataset), sign: l.expectedSign };
          return [l.rowId, m];
        }),
    ) as Mappings;
  }, [links, mappings, dataset]);
  const models = useMemo(() => buildModels(dataset, links, effectiveMappings, modelSettings), [dataset, links, effectiveMappings, modelSettings]);
  const keyOf = (list: typeof models) => hashKey({ framingKey, datasetKey, mappings: effectiveMappings, models: modelsKey(list) });
  const modelKey = keyOf(models);
  const modelState = triState(modelConfirmedKey, modelKey);

  // Analyses et verdicts : recalculés à partir des séries (jamais enregistrés comme des faits).
  const analyses = useMemo(() => Object.fromEntries(models.map((m) => [m.key, analyzeModel(dataset, m.spec)])), [models, dataset]);
  const results = useMemo(() => evaluateHypotheses(dataset, links, effectiveMappings, models, analyses), [dataset, links, effectiveMappings, models, analyses]);
  const reasoningState = triState(reasoningSeenKey, modelKey);
  const chapter = useMemo(() => buildChapter(dataset, models, analyses, results), [dataset, models, analyses, results]);
  const defense = useMemo(() => buildDefenseKit(models, analyses, results, dataset.periods), [models, analyses, results, dataset.periods]);
  const reportState = triState(chapterKey, modelKey);

  const journey = econSteps({ domain: fieldConfirmed, data: dataState, presentation: presentationState, research: !!research, framing: framingState, model: modelState, reasoning: reasoningState, report: reportState });
  const active: EconStepId = view && journey.steps.find((s) => s.id === view && s.state !== "todo") ? view : journey.current;
  const stageOf = (id: EconStepId) => ECON_STAGES.find((s) => s.steps.includes(id))!;
  const activeStage = stageOf(active);
  const isDemo = dataset.fictitious;
  const first = dataset.periods[0];
  const last = dataset.periods.at(-1);

  const snapshot: EconSnapshot = useMemo(
    () => ({
      engine: "econometrie",
      version: ECON_SNAPSHOT_VERSION,
      field,
      fieldConfirmed,
      source,
      dataset,
      datasetConfirmedKey,
      presentationSeenKey,
      research: research as unknown as Record<string, unknown> | null,
      chainDecisions,
      framingConfirmedKey,
      mappings,
      modelSettings,
      modelConfirmedKey,
      reasoningSeenKey,
      chapterKey,
      view,
    }),
    [field, fieldConfirmed, source, dataset, datasetConfirmedKey, presentationSeenKey, research, chainDecisions, framingConfirmedKey, mappings, modelSettings, modelConfirmedKey, reasoningSeenKey, chapterKey, view],
  );
  const summary: SessionSummary = {
    stageLabel: activeStage.label,
    progress: journey.stages.filter((s) => s.state === "done").length,
    verdicts: modelState === "confirmed" ? results.filter((r) => r.verdict !== "not_examined").slice(0, 8).map((r, i) => ({ label: `H${i + 1}. ${r.hypothesis ?? r.statement}`.slice(0, 80), verdict: r.verdictLabel.slice(0, 80) })) : [],
    dataFile: null,
    detail: dataset.periods.length ? `${dataset.economy || "Économie à préciser"} · ${first}–${last} · ${dataset.series.length} série(s)${isDemo ? " · FICTIF" : ""}` : null,
  };
  const persistence = useJourneyPersistence({
    sessionId,
    revision: initial?.revision ?? 0,
    kind: "econometrie",
    snapshot,
    title: (typeof research?.title === "string" && research.title ? research.title : dataset.economy ? `Analyse économétrique — ${dataset.economy}` : initial?.title || "Analyse économétrique").slice(0, 200),
    stage: journey.current,
    summary,
    enabled: fieldConfirmed,
    paused: false,
  });

  const reportInput: EconReportInput = { dataset, models, analyses, results, chapter, title: research?.title || `Analyse économétrique — ${dataset.economy || "économie étudiée"}`, mainQuestion: research?.mainQuestion ?? "" };

  const goToStage = (stageId: string) => {
    const stage = ECON_STAGES.find((s) => s.id === (stageId as EconStageId))!;
    const target = stage.steps.find((id) => journey.steps.find((s) => s.id === id)?.state !== "done") ?? stage.steps[0];
    setView(target);
  };

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-800 via-blue-700 to-sky-600 px-5 py-5 text-white shadow-lg shadow-indigo-900/10 sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Économétrie et macroéconomie</p>
        <h1 className="relative mt-1 text-xl font-extrabold leading-tight sm:text-3xl">Des séries macroéconomiques au chapitre de résultats</h1>
        <p className="relative mt-2 max-w-3xl text-sm leading-relaxed text-sky-50">Économie monétaire, du développement, rurale ou générale : présentation organisée des données, agrégats, stationnarité, estimation, tests de validation et verdict sur chaque hypothèse. Les calculs sont faits dans votre navigateur, sans IA ; votre travail est enregistré dans votre compte.</p>
        <p className="relative mt-3 inline-flex flex-wrap items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25" role="status" aria-label="État de la sauvegarde">
          {SAVE_LABELS[persistence.status]}
          {persistence.status === "conflict" ? (
            <button type="button" className="underline" onClick={() => window.location.reload()}>
              Recharger la dernière version
            </button>
          ) : null}
        </p>
      </header>

      {isDemo ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-center text-sm font-bold uppercase tracking-wide text-amber-900" role="note">
          {DEMO_NOTICE}
        </p>
      ) : null}

      <StageNav
        label="Étapes du moteur Économétrie et macroéconomie"
        stages={journey.stages}
        activeStageId={activeStage.id}
        nextAction={journey.nextAction}
        onGo={goToStage}
        goCurrent={active !== journey.current ? { label: `Aller à « ${stageOf(journey.current).label} »`, onClick: () => setView(journey.current) } : null}
      />

      <section aria-label={ECON_STEP_LABELS[active]} className="space-y-5">
        {activeStage.steps.length > 1 ? (
          <nav aria-label={`Sous-étapes : ${activeStage.label}`} className="flex flex-wrap gap-2">
            {activeStage.steps.map((id, i) => {
              const state = journey.steps.find((x) => x.id === id)!.state;
              return state === "todo" ? (
                <span key={id} className="inline-flex min-h-9 items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-500">
                  {i + 1}. {ECON_STEP_LABELS[id]} · {STEP_STATE_LABELS[state]}
                </span>
              ) : (
                <button key={id} type="button" onClick={() => setView(id)} aria-current={active === id ? "step" : undefined} className={`inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold ring-1 ${active === id ? "bg-indigo-700 text-white ring-indigo-700" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}>
                  {i + 1}. {ECON_STEP_LABELS[id]} · {STEP_STATE_LABELS[state]}
                </button>
              );
            })}
          </nav>
        ) : null}

        {active === "domain" ? (
          <DomainStep
            domain={field.domain}
            specialty={field.specialty}
            secondary={field.secondary}
            confirmed={fieldConfirmed}
            continueLabel="Continuer : mes séries temporelles"
            onChange={setField}
            onConfirm={() => {
              setFieldConfirmed(true);
              setView("data");
            }}
            notice={
              field.specialty && specialtyOf(field.specialty)?.engine === "finance" ? (
                <Notice
                  tone="info"
                  title="Vous analysez les états financiers d'une entreprise ?"
                  action={
                    <Link href="/dashboard/journey?moteur=finance" className={buttonClass.secondary}>
                      Ouvrir le moteur Gestion financière
                    </Link>
                  }
                >
                  Le moteur « Gestion financière » est fait pour le bilan, le compte de résultat et les flux de trésorerie.
                </Notice>
              ) : (
                <Notice
                  tone="info"
                  title="Votre étude repose sur une enquête ?"
                  action={
                    <Link href="/dashboard/journey" className={buttonClass.secondary}>
                      Ouvrir le parcours général
                    </Link>
                  }
                >
                  Ce moteur analyse des séries temporelles (au moins 5 périodes : années, trimestres ou mois). Pour un questionnaire auprès de ménages, d&apos;exploitations ou d&apos;entreprises, ouvrez le parcours général (nouvelle interprétation).
                </Notice>
              )
            }
          />
        ) : null}

        {active === "data" ? (
          <DataStep
            dataset={dataset}
            source={source}
            onSource={(next, data) => {
              setSource(next);
              setDataset(data);
            }}
            onChange={setDataset}
            confirmed={dataState === "confirmed"}
            stale={dataState === "stale"}
            onConfirm={() => {
              setDatasetConfirmedKey(datasetKey);
              setView("presentation");
            }}
          />
        ) : null}

        {active === "presentation" ? (
          <PresentationView
            dataset={dataset}
            seen={presentationState === "confirmed"}
            stale={presentationState === "stale"}
            onConfirm={() => {
              setPresentationSeenKey(datasetKey);
              setView("research");
            }}
          />
        ) : null}

        {active === "research" ? <EconResearchStep report={report} analyzed={research} dataset={dataset} onAnalyze={(input) => setResearch(input)} onContinue={() => setView("framing")} /> : null}

        {active === "framing" && chain ? (
          <FramingStep
            title="4. Mon sujet : la cohérence de ma recherche"
            continueLabel="Continuer : mon modèle économétrique"
            chain={chain}
            confirmed={framingState === "confirmed"}
            stale={framingState === "stale"}
            variablesNote={<EconVariablesNote links={links} />}
            onChange={(rowId, patchRow) => setChainDecisions((d) => ({ ...d, rows: { ...d.rows, [rowId]: { ...d.rows[rowId], ...patchRow } } }))}
            onConfirm={() => {
              setChainDecisions((d) => ({ ...d, rows: Object.fromEntries(chain.rows.map((r) => [r.id, { ...d.rows[r.id], confirmed: true }])) }));
              setFramingConfirmedKey(framingKey);
              setView("model");
            }}
          />
        ) : null}

        {active === "model" ? (
          <ModelStep
            dataset={dataset}
            links={links}
            mappings={effectiveMappings}
            models={models}
            settings={modelSettings}
            confirmed={modelState === "confirmed"}
            stale={modelState === "stale"}
            onMapping={(rowId, patchMapping) => setMappings((m) => ({ ...m, [rowId]: { ...effectiveMappings[rowId], ...patchMapping } }))}
            onSettings={(key, patchSettings) => setModelSettings((s) => ({ ...s, [key]: { ...(s[key] ?? DEFAULT_SETTINGS), ...patchSettings } }))}
            onConfirm={() => {
              setModelConfirmedKey(modelKey);
              setView("reasoning");
            }}
          />
        ) : null}

        {active === "reasoning" ? (
          <ReasoningView
            dataset={dataset}
            models={models}
            analyses={analyses}
            results={results}
            seen={reasoningState === "confirmed"}
            stale={reasoningState === "stale"}
            onReestimate={(key, transform) => {
              // Re-spécification proposée par le raisonnement : l'étudiant l'a demandée, le modèle reste validé.
              const next = { ...modelSettings, [key]: { ...(modelSettings[key] ?? DEFAULT_SETTINGS), transform } };
              setModelSettings(next);
              setModelConfirmedKey(keyOf(buildModels(dataset, links, effectiveMappings, next)));
              setView("reasoning");
            }}
            onConfirm={() => {
              setReasoningSeenKey(modelKey);
              setView("report");
            }}
          />
        ) : null}

        {active === "report" ? <ChapterView chapter={chapter} defense={defense} report={reportInput} done={reportState === "confirmed"} stale={reportState === "stale"} onDone={() => setChapterKey(modelKey)} fileBase={`acadia-analyse-econometrique${isDemo ? "-FICTIF" : ""}`} /> : null}
      </section>
    </div>
  );
}
