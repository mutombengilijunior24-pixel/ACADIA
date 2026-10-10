"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ArrowLeft, Check, CircleDot, Loader2, RotateCcw } from "lucide-react";

import { FileDropZone, FileSummary, PreviewStep } from "@/components/data/ImportStep";
import { buttonClass, Notice, Section } from "@/components/data/ui";
import { importFlowReducer, initialImportFlow } from "@/lib/core/data/flow";
import { importFile } from "@/lib/core/data/importer";
import { profileDataset } from "@/lib/core/data/profile";
import type { ImportOptions, StatisticalType } from "@/lib/core/data/types";
import { buildUnderstanding } from "@/lib/core/data/understanding";
import {
  checkConsistency,
  detectConditionalQuestions,
  provenanceWarning,
  declareProvenance,
  effectiveSkipRules,
  inferSkipRules,
  isIllustrative,
  provenanceFor,
  PROVENANCE_KINDS,
  UNDECLARED,
  type ProvenanceRegistry,
  type SkipDecisions,
  PROVENANCE_LABELS,
  type DataProvenance,
  analyzeStructure,
  coverObjectives,
  itemStatus,
  populationGaps,
  STAGES,
  stageOf,
  STEP_ORDER,
  STEP_PURPOSE,
  STEP_STATE_LABELS,
  buildCartography,
  buildInterpretation,
  buildPlan,
  diagnoseData,
  emptyMappingDecisions,
  emptyPlanDecisions,
  executePlan,
  executionKey,
  journeySteps,
  linkQuestions,
  parseQuestionnaire,
  questionsFromAcadia,
  STEP_LABELS,
  type Execution,
  type InstrumentKind,
  type InstrumentQuestion,
  type MappingDecisions,
  type PlanDecisions,
  type StepId,
} from "@/lib/core/journey";
import type { GeneratedQuestionnaire } from "@/lib/core/questionnaire/QuestionnaireTypes";
import { buildUnderstandingReport, emptyDecisions, type ResearchUnderstandingInput } from "@/lib/core/understanding";
import { excludedRows } from "@/lib/core/data/preparation";
import { applyRouting, buildTrace, classify, datasetView, orchestrate, type ClassificationOverrides, type DomainId, type SpecialtyId } from "@/lib/core/orchestrator";
import { hashKey } from "@/lib/core/understanding/text";

import { InstrumentStep, QualityStep, ResearchStep } from "./EarlySteps";
import { PlanStep, VariablesStep } from "./AnalysisSteps";
import { ClassificationPanel, DomainStep, OrchestrationPanel } from "./OrchestrationViews";
import { ResultsStep } from "./ResultsView";

export interface InstrumentState {
  kind: InstrumentKind | null;
  mode: "text" | "acadia" | "headers";
  text: string;
  acadia: { key: string; questionnaire: GeneratedQuestionnaire } | null;
}

export default function JourneyWorkspace() {
  // 0. Domaine et spécialité : perspective scientifique, modifiable sans perdre les données.
  const [field, setField] = useState<{ domain: DomainId | null; specialty: SpecialtyId | null; secondary: SpecialtyId[] }>({ domain: null, specialty: null, secondary: [] });
  const [fieldConfirmed, setFieldConfirmed] = useState(false);
  // Corrections de la classification par l'utilisateur (type de données, unité, structure).
  const [overrides, setOverrides] = useState<ClassificationOverrides>({});
  // 1. Recherche (moteur de compréhension)
  const [research, setResearch] = useState<ResearchUnderstandingInput | null>(null);
  // 2. Instrument
  const [instrument, setInstrument] = useState<InstrumentState>({ kind: null, mode: "headers", text: "", acadia: null });
  const [instrumentConfirmed, setInstrumentConfirmed] = useState(false);
  // 3. Données (même flux que l'onglet Données)
  const [data, dispatch] = useReducer(importFlowReducer, initialImportFlow);
  const fileRef = useRef<File | null>(null);
  const readToken = useRef(0);
  // 4–8. Décisions
  const [qualityConfirmed, setQualityConfirmed] = useState(false);
  const [mappingDecisions, setMappingDecisions] = useState<MappingDecisions>(emptyMappingDecisions);
  const [mappingConfirmedKey, setMappingConfirmedKey] = useState<string | null>(null);
  const [planDecisions, setPlanDecisions] = useState<PlanDecisions>(emptyPlanDecisions);
  const [alpha, setAlpha] = useState(0.05);
  const [independence, setIndependence] = useState(false);
  const [planValidatedKey, setPlanValidatedKey] = useState<string | null>(null);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [view, setView] = useState<StepId | null>(null);
  // Provenance DÉCLARÉE par l'utilisateur, rattachée à l'identifiant d'import du jeu de données (mémoire de session).
  const [provenances, setProvenances] = useState<ProvenanceRegistry>({});
  const [skipDecisions, setSkipDecisions] = useState<SkipDecisions>({});
  const [skipValues, setSkipValues] = useState<Record<string, string[]>>({});
  const [structuralChoice, setStructuralChoice] = useState<Record<number, boolean>>({});

  const report = useMemo(() => (research ? buildUnderstandingReport(research, emptyDecisions()) : null), [research]);
  const prepared = data.step === "prepared" ? data : null;
  const profile = useMemo(() => (prepared ? profileDataset(prepared.dataset, prepared.preparation) : null), [prepared]);
  const variables = useMemo(() => (prepared && profile ? buildUnderstanding({ dataset: prepared.dataset, profile, preparation: prepared.preparation }).variables : null), [prepared, profile]);
  const structure = useMemo(() => (prepared && profile && variables ? analyzeStructure(prepared.dataset, profile, variables) : null), [prepared, profile, variables]);
  // Questions conditionnelles : « Non concernée » retirée du dénominateur par défaut (décision réversible).
  const questions: InstrumentQuestion[] = useMemo(
    () => (instrument.kind !== "questionnaire" ? [] : instrument.mode === "text" ? parseQuestionnaire(instrument.text) : instrument.mode === "acadia" && instrument.acadia ? questionsFromAcadia(instrument.acadia.questionnaire) : []),
    [instrument],
  );
  const links = useMemo(() => (structure ? linkQuestions(questions, structure) : []), [questions, structure]);
  const declaredProvenance = provenanceFor(provenances, prepared?.dataset.importId);
  const provenance: DataProvenance = declaredProvenance ?? UNDECLARED;
  const setProvenance = (value: DataProvenance) => prepared && setProvenances((r) => declareProvenance(r, prepared.dataset.importId, value));
  // Conditions de passage : consignes de l'instrument (confirmées) et intitulés (proposées, à confirmer).
  const skipRules = useMemo(
    () => (prepared && structure ? effectiveSkipRules(inferSkipRules({ dataset: prepared.dataset, preparation: prepared.preparation, structure, questions, links }), skipDecisions, skipValues) : []),
    [prepared, structure, questions, links, skipDecisions, skipValues],
  );
  const conditionals = useMemo(() => (prepared && structure ? detectConditionalQuestions(prepared.dataset, prepared.preparation, structure, skipRules) : []), [prepared, structure, skipRules]);
  const structural = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const q of conditionals) if (q.notApplicableValues.length && structuralChoice[q.column] !== false) map[q.column] = q.notApplicableValues;
    return map;
  }, [conditionals, structuralChoice]);
  const consistency = useMemo(() => (prepared && structure ? checkConsistency(prepared.dataset, prepared.preparation, structure, skipRules) : []), [prepared, structure, skipRules]);
  // Population ciblée ↔ échantillon : signalé, jamais d'exclusion automatique.
  const gaps = useMemo(() => (prepared && structure && research ? populationGaps({ population: research.population, dataset: prepared.dataset, preparation: prepared.preparation, structure }) : []), [prepared, structure, research]);
  const diagnosis = useMemo(
    () => (prepared && profile && structure && variables ? diagnoseData(prepared.dataset, prepared.preparation, profile, structure, variables, { conditionals, structural, consistency, populationGaps: gaps }) : null),
    [prepared, profile, structure, variables, conditionals, structural, consistency, gaps],
  );
  const cartography = useMemo(() => (report && structure ? buildCartography({ report, structure, questions, links, decisions: mappingDecisions }) : null), [report, structure, questions, links, mappingDecisions]);

  // Empreinte de la cartographie : concepts → colonnes + types des colonnes clés.
  const mappingKey = useMemo(() => {
    if (!cartography || !variables) return null;
    const keys = cartography.units.filter((u) => u.role === "key").map((u) => u.unit.primaryColumn);
    return hashKey([cartography.concepts.map((c) => [c.conceptKey, c.unitId]), keys.map((k) => [k, variables.find((v) => v.column === k)?.effectiveType])]);
  }, [cartography, variables]);
  const mappingState: "none" | "confirmed" | "stale" = !mappingConfirmedKey ? "none" : mappingConfirmedKey === mappingKey ? "confirmed" : "stale";

  const mainQuestion = research?.mainQuestion || research?.title || "";
  // Fiche de classification et routage des moteurs (orchestrateur central).
  const sheet = useMemo(
    () =>
      classify({
        domain: field.domain,
        specialty: field.specialty,
        secondary: field.secondary,
        research,
        instrument: instrumentConfirmed ? instrument.kind : null,
        data: prepared && variables ? datasetView(prepared.dataset, prepared.preparation, variables, structure) : null,
        provenance: declaredProvenance,
        preparation: prepared && diagnosis ? { qualityConfirmed, rowsUsed: diagnosis.rowsUsed, uncertainTypes: diagnosis.uncertainTypes, excludedRows: excludedRows(prepared.preparation).size } : null,
        overrides,
      }),
    [field, research, instrument.kind, instrumentConfirmed, prepared, variables, structure, declaredProvenance, diagnosis, qualityConfirmed, overrides],
  );
  const routing = useMemo(() => orchestrate(sheet), [sheet]);
  const rawPlan = useMemo(
    () => (report && cartography && structure && prepared && variables ? buildPlan({ report, cartography, structure, dataset: prepared.dataset, preparation: prepared.preparation, variables, instrument: instrument.kind, mainQuestion }) : null),
    [report, cartography, structure, prepared, variables, instrument.kind, mainQuestion],
  );
  const plan = useMemo(() => (rawPlan ? applyRouting(rawPlan, routing) : null), [rawPlan, routing]);
  const planKey = plan ? hashKey([plan.items.map((i) => [i.id, i.feasible, i.columns, i.method]), planDecisions, independence, alpha, mappingKey]) : null;
  const planState: "none" | "validated" | "stale" = !planValidatedKey ? "none" : planValidatedKey === planKey ? "validated" : "stale";
  const execKey = plan && prepared ? executionKey(plan, planDecisions, prepared.preparation, { alpha, independence, mappingKey, structural }) : null;
  // Jamais de résultats d'un autre jeu de données : seuls ceux du fichier courant sont considérés.
  const currentExecution = execution && prepared && execution.datasetId === prepared.dataset.importId ? execution : null;
  const resultsState: "none" | "fresh" | "stale" = !currentExecution ? "none" : currentExecution.key === execKey && planState === "validated" ? "fresh" : "stale";
  const trace = useMemo(() => (currentExecution && prepared ? buildTrace({ execution: currentExecution, preparation: prepared.preparation, sheet, routing, provenance: declaredProvenance, planKey: planValidatedKey, independence }) : null), [currentExecution, prepared, sheet, routing, declaredProvenance, planValidatedKey, independence]);
  const interpretation = useMemo(() => (currentExecution && plan && report ? buildInterpretation(currentExecution, plan, report, mainQuestion, research ? { problem: research.problem, generalObjective: research.generalObjective, specificObjectives: research.specificObjectives } : undefined, { provenance, consistency, populationGaps: gaps }) : null), [currentExecution, plan, report, mainQuestion, research, provenance, consistency, gaps]);
  // Couverture des objectifs par les analyses retenues, visible AVANT le calcul.
  const planObjectives = useMemo(() => {
    if (!plan || !research || !report) return [];
    const objectives = [...(research.generalObjective ? [{ text: research.generalObjective, kind: "général" as const }] : []), ...research.specificObjectives.map((text) => ({ text, kind: "spécifique" as const }))];
    const analyses = plan.items.filter((i) => i.feasible && itemStatus(i, planDecisions) === "accepted").map((i) => ({ title: i.title, level: i.level, variables: i.variables }));
    return coverObjectives(objectives, analyses, report.variables.map((v) => v.name));
  }, [plan, research, report, planDecisions]);

  const journey = journeySteps({
    domain: fieldConfirmed && !!field.specialty,
    research: !!research,
    instrument: instrumentConfirmed,
    data: !!prepared,
    quality: qualityConfirmed && !!prepared,
    mapping: mappingState,
    plan: planState,
    results: resultsState,
  });
  const active = view && journey.steps.find((s) => s.id === view && s.state !== "todo") ? view : journey.current;

  // --- Données --------------------------------------------------------
  const read = async (file: File, options: ImportOptions) => {
    const token = ++readToken.current;
    dispatch({ type: "read_started", options });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await importFile(file.name, bytes, options);
    if (token === readToken.current) dispatch({ type: "read_finished", result });
  };
  const resetDownstream = () => {
    setQualityConfirmed(false);
    setMappingDecisions(emptyMappingDecisions());
    setMappingConfirmedKey(null);
    setPlanDecisions(emptyPlanDecisions());
    setPlanValidatedKey(null);
    setExecution(null);
    setRunError(null);
    setIndependence(false);
    setSkipDecisions({});
    setSkipValues({});
    setStructuralChoice({});
    setOverrides({});
  };
  const onFile = (file: File) => {
    fileRef.current = file;
    resetDownstream();
    dispatch({ type: "select_file", file: { name: file.name, size: file.size, lastModified: file.lastModified } });
    void read(file, {});
  };
  const replaceFile = () => {
    readToken.current += 1;
    fileRef.current = null;
    resetDownstream();
    dispatch({ type: "reset" });
    setView("data");
  };

  const confirmMapping = (keyTypes: Record<number, StatisticalType>) => {
    if (!variables) return;
    // Les questions de contexte décrites gardent le type affiché (déjà utilisable) : la confirmation de l'utilisateur le valide.
    const ANALYSIS: StatisticalType[] = ["nominal", "ordinal", "quantitative_discrete", "quantitative_continuous"];
    const contextTypes = Object.fromEntries(
      (cartography?.units ?? [])
        .filter((u) => u.role === "context" && u.unit.primaryColumn !== null)
        .map((u) => [u.unit.primaryColumn!, variables.find((v) => v.column === u.unit.primaryColumn)?.effectiveType])
        .filter((entry): entry is [number, StatisticalType] => ANALYSIS.includes(entry[1] as StatisticalType)),
    );
    const types: Record<number, StatisticalType> = { ...contextTypes, ...keyTypes };
    // Confirmation explicite des types des colonnes clés (opérations réversibles de la préparation).
    for (const [column, type] of Object.entries(types)) {
      const meta = variables.find((v) => v.column === Number(column));
      if (meta && (meta.confirmed?.statisticalType !== type || !meta.analysisReady)) dispatch({ type: "operation", input: { type: "set_statistical_type", column: Number(column), statisticalType: type } });
    }
    setMappingDecisions((d) => {
      const concepts = { ...d.concepts };
      for (const c of cartography?.concepts ?? []) concepts[c.conceptKey] = { unitId: c.unitId, confirmed: true, manual: d.concepts[c.conceptKey]?.manual };
      return { ...d, concepts };
    });
    // Empreinte calculée avec les types choisis : c'est celle qu'aura la cartographie une fois ces types appliqués.
    if (cartography) {
      const keys = cartography.units.filter((u) => u.role === "key").map((u) => u.unit.primaryColumn);
      setMappingConfirmedKey(hashKey([cartography.concepts.map((c) => [c.conceptKey, c.unitId]), keys.map((k) => [k, (k !== null && types[k]) || variables.find((v) => v.column === k)?.effectiveType])]));
    }
    setView("plan");
  };

  // Calcul : état « en cours » affiché, puis résultats ou erreur explicite (jamais de résultat de remplacement).
  const runPlan = () => {
    if (!plan || !prepared || !variables || !planKey || !execKey) return;
    setPlanValidatedKey(planKey);
    setRunning(true);
    setRunError(null);
    setView("results");
    window.setTimeout(() => {
      try {
        const result = executePlan({ plan, decisions: planDecisions, dataset: prepared.dataset, preparation: prepared.preparation, variables, alpha, independenceConfirmed: independence, key: execKey, structural });
        setExecution(result);
      } catch (e) {
        setRunError(e instanceof Error ? e.message : String(e));
      } finally {
        setRunning(false);
      }
    }, 30);
  };
  // Barre d'étapes défilante (téléphone) : l'étape affichée reste visible.
  const stepsRef = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    const list = stepsRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-step="${stageOf(active).id}"]`);
    if (list && item && list.scrollWidth > list.clientWidth) list.scrollTo({ left: item.offsetLeft - list.offsetLeft - 8, behavior: "smooth" });
  }, [active]);
  const activeStage = stageOf(active);
  const doneCount = journey.stages.filter((s) => s.state === "done").length;
  const activeIndex = STAGES.findIndex((s) => s.id === activeStage.id);
  const goToStage = (stageId: string) => {
    const stage = journey.stages.find((s) => s.id === stageId)!;
    const target = stage.steps.find((id) => ["current", "stale"].includes(journey.steps.find((x) => x.id === id)!.state)) ?? stage.steps.find((id) => journey.steps.find((x) => x.id === id)!.state !== "todo") ?? stage.steps[0];
    setView(target);
  };
  const previous = STEP_ORDER.slice(0, STEP_ORDER.indexOf(active)).reverse().find((id) => journey.steps.find((s) => s.id === id)?.state !== "todo");

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-sky-500 px-5 py-5 text-white shadow-lg shadow-indigo-900/10 sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-indigo-100">Parcours guidé</p>
        <h1 className="relative mt-1 text-xl font-extrabold leading-tight sm:text-3xl">De votre question de recherche aux résultats</h1>
        <p className="relative mt-2 max-w-3xl text-sm leading-relaxed text-indigo-50">Six étapes ; vous confirmez chaque décision. Calculs effectués dans votre navigateur, sans IA ; données perdues au rechargement de la page.</p>
      </header>

      <nav aria-label="Étapes du parcours" className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center gap-3 px-1">
          <p className="text-sm font-semibold text-slate-900">
            Étape {activeIndex + 1} sur {STAGES.length} · {activeStage.label}
          </p>
          <div className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all" style={{ width: `${(doneCount / STAGES.length) * 100}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums text-slate-500">{doneCount} / {STAGES.length} confirmées</span>
        </div>
        <ol ref={stepsRef} className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-6 lg:overflow-visible">
          {journey.stages.map((step, index) => {
            const isActive = activeStage.id === step.id;
            const tone = isActive ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-600/20" : step.state === "done" ? "bg-emerald-50 text-emerald-900 hover:bg-emerald-100" : step.state === "stale" ? "bg-amber-50 text-amber-900 hover:bg-amber-100" : step.state === "current" ? "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200 hover:bg-indigo-100" : "bg-slate-50 text-slate-500";
            const content = (
              <>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isActive ? "bg-white/25 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`} aria-hidden>
                  {step.state === "done" ? <Check size={14} /> : step.state === "stale" ? <RotateCcw size={13} /> : step.state === "current" && !isActive ? <CircleDot size={14} /> : index + 1}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-sm font-semibold">{step.label}</span>
                  <span className={`block text-[11px] font-medium ${isActive ? "text-indigo-100" : "opacity-75"}`}>{STEP_STATE_LABELS[step.state]}</span>
                </span>
              </>
            );
            return (
              <li key={step.id} data-step={step.id} className="min-w-[9.5rem] snap-start lg:min-w-0">
                {step.state === "todo" ? (
                  <div className={`flex min-h-14 w-full items-center gap-2 rounded-xl px-2.5 ${tone}`} title="Étape disponible après les étapes précédentes">
                    {content}
                  </div>
                ) : (
                  <button type="button" aria-current={isActive ? "step" : undefined} onClick={() => goToStage(step.id)} className={`flex min-h-14 w-full items-center gap-2 rounded-xl px-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${tone}`}>
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-sm text-indigo-950 sm:flex-row sm:items-center sm:justify-between" role="status">
          <p className="min-w-0 sm:flex-1">
            <span className="font-semibold">Prochaine action : </span>
            {journey.nextAction}
          </p>
          {active !== journey.current ? (
            <button type="button" className={buttonClass.secondary} onClick={() => setView(journey.current)}>
              Aller à « {stageOf(journey.current).label} »
            </button>
          ) : null}
        </div>
      </nav>

      {prepared && provenanceWarning(provenance) && active !== "results" ? (
        <p className={`rounded-2xl border p-3 text-sm font-medium ${isIllustrative(provenance.kind) ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`} role="note">
          {declaredProvenance ? <span className="font-bold">{PROVENANCE_LABELS[provenance.kind]} — </span> : null}
          {provenanceWarning(provenance)}
        </p>
      ) : null}
      <section aria-label={STEP_LABELS[active]} className="space-y-5">
        <p className="sr-only">{STEP_PURPOSE[active]}</p>
        {activeStage.steps.length > 1 ? (
          <nav aria-label={`Sous-étapes : ${activeStage.label}`} className="flex flex-wrap gap-2">
            {activeStage.steps.map((id, i) => {
              const state = journey.steps.find((x) => x.id === id)!.state;
              return state === "todo" ? (
                <span key={id} className="inline-flex min-h-9 items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-500">
                  {i + 1}. {STEP_LABELS[id]} · {STEP_STATE_LABELS[state]}
                </span>
              ) : (
                <button key={id} type="button" onClick={() => setView(id)} aria-current={active === id ? "step" : undefined} className={`inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold ring-1 ${active === id ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}>
                  {i + 1}. {STEP_LABELS[id]} · {STEP_STATE_LABELS[state]}
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
            onChange={setField}
            onConfirm={() => {
              setFieldConfirmed(true);
              setView("research");
            }}
          />
        ) : null}
        {active === "research" ? (
          <ResearchStep
            report={report}
            onAnalyze={(input) => {
              setResearch(input);
              setView("research");
            }}
            onContinue={() => setView("instrument")}
            analyzed={research}
          />
        ) : null}
        {active === "instrument" ? (
          <InstrumentStep
            instrument={instrument}
            questions={questions}
            onChange={(next) => {
              setInstrument(next);
              setInstrumentConfirmed(false);
            }}
            confirmed={instrumentConfirmed}
            onConfirm={() => {
              setInstrumentConfirmed(true);
              setView("data");
            }}
          />
        ) : null}
        {active === "data" ? (
          <Section title="3. Mes données : votre fichier" description="Fichier CSV ou Excel exporté de votre outil de collecte. Le fichier est lu dans votre navigateur : il n'est envoyé nulle part.">
            <div className="space-y-4">
              {data.step === "empty" ? <FileDropZone onFile={onFile} /> : null}
              {data.step === "reading" || data.step === "preview" ? (
                <PreviewStep
                  state={data}
                  onOptions={(options) => fileRef.current && void read(fileRef.current, options)}
                  onReplace={replaceFile}
                  onConfirm={() => {
                    dispatch({ type: "confirm" });
                    setView("quality");
                  }}
                />
              ) : null}
              {prepared ? (
                <div className="space-y-4">
                  <Notice tone="success" title="Fichier importé">
                    <FileSummary file={prepared.file} format={prepared.dataset.format} />
                  </Notice>
                  <ProvenanceChoice value={declaredProvenance} onChange={setProvenance} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={buttonClass.primary} onClick={() => setView("quality")}>
                      Continuer : qualité des données
                    </button>
                    <button type="button" className={buttonClass.secondary} onClick={replaceFile}>
                      Importer un autre fichier
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </Section>
        ) : null}
        {active === "quality" && prepared ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <ProvenanceChoice value={declaredProvenance} onChange={setProvenance} />
          </div>
        ) : null}
        {active === "quality" && prepared ? <ClassificationPanel sheet={sheet} overrides={overrides} onOverrides={setOverrides} /> : null}
        {active === "quality" && prepared && diagnosis && profile ? (
          <QualityStep
            diagnosis={diagnosis}
            dataset={prepared.dataset}
            profile={profile}
            preparation={prepared.preparation}
            confirmed={qualityConfirmed}
            onAction={(action) => {
              if (action.type === "toggle_structural") setStructuralChoice((c) => ({ ...c, [action.column]: action.enable }));
              else if (action.type === "exclude_rows") dispatch({ type: "operation", input: { type: "exclude_rows", rows: action.rows, reason: action.label ? `décision dans le parcours guidé : ${action.label.toLowerCase()}` : "doublons confirmés dans le parcours guidé" } });
              else dispatch({ type: "operation", input: { type: "declare_missing_codes", column: action.column, values: action.values } });
            }}
            consistency={consistency}
            skipRules={skipRules}
            onSkipDecision={(id, value) => setSkipDecisions((d) => ({ ...d, [id]: value }))}
            onSkipValues={(id, values) => setSkipValues((d) => ({ ...d, [id]: values }))}
            provenanceDeclared={!!declaredProvenance}
            onUndo={(operationId) => dispatch({ type: "undo", operationId })}
            onConfirm={() => {
              setQualityConfirmed(true);
              setView("variables");
            }}
          />
        ) : null}
        {active === "variables" && cartography && variables && structure ? (
          <VariablesStep
            cartography={cartography}
            variables={variables}
            structure={structure}
            questions={questions}
            mappingState={mappingState}
            onAssign={(conceptKey, unitId) => setMappingDecisions((d) => ({ ...d, concepts: { ...d.concepts, [conceptKey]: { unitId, confirmed: false, manual: true } } }))}
            onUnitRole={(unitId, role) => setMappingDecisions((d) => ({ ...d, unitRoles: { ...d.unitRoles, [unitId]: role } }))}
            onConfirm={confirmMapping}
          />
        ) : null}
        {active === "plan" ? <OrchestrationPanel routing={routing} /> : null}
        {active === "plan" && plan ? (
          <PlanStep
            plan={plan}
            decisions={planDecisions}
            onDecisions={setPlanDecisions}
            alpha={alpha}
            onAlpha={setAlpha}
            independence={independence}
            onIndependence={setIndependence}
            planState={planState}
            onValidate={runPlan}
            objectives={planObjectives}
          />
        ) : null}
        {active === "results" ? (
          running ? (
            <Section title="6. Résultats et interprétation">
              <p className="flex items-center gap-2 text-sm text-slate-700" role="status">
                <Loader2 size={18} className="animate-spin text-indigo-600" aria-hidden /> Calcul en cours…
              </p>
            </Section>
          ) : runError ? (
            <Notice
              tone="error"
              title="Les calculs n'ont pas pu être effectués"
              action={
                <button type="button" className={buttonClass.secondary} onClick={() => setView("plan")}>
                  Revoir le plan
                </button>
              }
            >
              {runError} Aucun résultat n&apos;est affiché à la place.
            </Notice>
          ) : currentExecution && interpretation ? (
            <ResultsStep execution={currentExecution} interpretation={interpretation} trace={trace} perspective={routing.perspective} question={mainQuestion} stale={resultsState === "stale"} onRerun={runPlan} onEditPlan={() => setView("plan")} />
          ) : (
            <Notice tone="info" title="Pas encore de résultats">
              Validez le plan d&apos;analyse pour lancer les calculs.
            </Notice>
          )
        ) : null}
        {previous ? (
          <div className="border-t border-slate-200 pt-4">
            <button type="button" className={buttonClass.ghost} onClick={() => setView(previous)}>
              <ArrowLeft size={16} aria-hidden /> Étape précédente : {STEP_LABELS[previous]}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** Provenance des données : déclarée par l'utilisateur pour CE fichier, jamais devinée. */
function ProvenanceChoice({ value, onChange }: { value: DataProvenance | null; onChange: (value: DataProvenance) => void }) {
  const current = value ?? { kind: null, description: "" };
  return (
    <fieldset id="provenance" className="w-full scroll-mt-24 rounded-2xl bg-slate-50 p-3 text-sm">
      <legend className="mb-1 px-1 font-semibold text-slate-800">D&apos;où viennent ces données ? {value ? null : <span className="font-normal text-rose-700">(à indiquer pour ce fichier)</span>}</legend>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {PROVENANCE_KINDS.map((kind) => (
          <label key={kind} className="flex min-h-10 items-center gap-2">
            <input type="radio" name="provenance" className="h-4 w-4" checked={current.kind === kind} onChange={() => onChange({ kind, description: current.description })} />
            {PROVENANCE_LABELS[kind]}
          </label>
        ))}
      </div>
      <label className="mt-2 block px-1">
        <span className="mb-1 block text-xs font-medium text-slate-600">Précision facultative (ex. « enquête terrain, mars 2025, 50 entrepreneures »)</span>
        <input
          className="block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          value={current.description}
          maxLength={300}
          disabled={!value}
          onChange={(e) => value && onChange({ kind: value.kind, description: e.target.value })}
        />
      </label>
      <p className="mt-1 px-1 text-xs text-slate-500">
        Cette provenance est déclarée par vous et n&apos;est pas vérifiée par ACADIA ; elle figure dans tous les rapports. Elle vaut pour ce fichier uniquement (un nouvel import la redemandera) et n&apos;est conservée que pendant cette session.
      </p>
    </fieldset>
  );
}
