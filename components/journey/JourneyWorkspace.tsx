"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { gunzipSync } from "fflate";
import { ArrowLeft, Check, CircleDot, Loader2, RotateCcw } from "lucide-react";

import { FileDropZone, FileSummary, PreviewStep } from "@/components/data/ImportStep";
import { buttonClass, Notice, Section } from "@/components/data/ui";
import { importFlowReducer, initialImportFlow } from "@/lib/core/data/flow";
import { importFile } from "@/lib/core/data/importer";
import { profileDataset } from "@/lib/core/data/profile";
import type { ImportOptions, PreparationOperation, StatisticalType } from "@/lib/core/data/types";
import { replayOperations, sha256Hex, SNAPSHOT_VERSION, type JourneySnapshot, type SessionSummary } from "@/lib/core/journey/persistence";
import { CHAIN_VERDICT_LABELS } from "@/lib/core/chain";
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
import { buildUnderstandingReport, emptyDecisions, validateResearchInput, type ResearchUnderstandingInput } from "@/lib/core/understanding";
import { excludedRows } from "@/lib/core/data/preparation";
import { applyRouting, buildTrace, classify, datasetView, orchestrate, specialtyOf, type ClassificationOverrides, type DomainId, type SpecialtyId } from "@/lib/core/orchestrator";
import type { EngineHandoff } from "@/lib/core/journey/kinds";
import { hashKey } from "@/lib/core/understanding/text";
import { assessChain, buildChain, buildChainPlan, emptyChainDecisions, interpretChain, type ChainDecisions } from "@/lib/core/chain";

import { InstrumentStep, QualityStep, ResearchStep } from "./EarlySteps";
import { PlanStep, VariablesStep } from "./AnalysisSteps";
import { ClassificationPanel, DomainStep, OrchestrationPanel } from "./OrchestrationViews";
import { CoherenceMatrix, FramingStep } from "./ChainViews";
import { ResultsStep } from "./ResultsView";
import { SAVE_LABELS, useJourneyPersistence } from "./useJourneyPersistence";

export interface InstrumentState {
  kind: InstrumentKind | null;
  mode: "text" | "acadia" | "headers";
  text: string;
  acadia: { key: string; questionnaire: GeneratedQuestionnaire } | null;
}

/** Interprétation enregistrée, chargée avant le montage du parcours (reprise). */
export interface SavedSession {
  revision: number;
  title: string;
  snapshot: JourneySnapshot;
  file: { name: string | null; size: number | null; sha256: string | null } | null;
}

/** Recherche enregistrée, revalidée avant d'être réutilisée. */
function savedResearch(raw: unknown): ResearchUnderstandingInput | null {
  if (!raw) return null;
  const v = validateResearchInput(raw);
  return v.ok ? v.input : null;
}

export default function JourneyWorkspace({ sessionId = null, initial = null, onSwitchEngine }: { sessionId?: string | null; initial?: SavedSession | null; onSwitchEngine?: (handoff: EngineHandoff) => void } = {}) {
  const snap = initial?.snapshot ?? null;
  // Spécialité à moteur dédié (Gestion financière) choisie alors qu'une interprétation existe déjà : confirmation.
  const [switchPrompt, setSwitchPrompt] = useState(false);
  // 0. Domaine et spécialité : perspective scientifique, modifiable sans perdre les données.
  const [field, setField] = useState<{ domain: DomainId | null; specialty: SpecialtyId | null; secondary: SpecialtyId[] }>(() => (snap ? (snap.field as { domain: DomainId | null; specialty: SpecialtyId | null; secondary: SpecialtyId[] }) : { domain: null, specialty: null, secondary: [] }));
  const [fieldConfirmed, setFieldConfirmed] = useState(() => snap?.fieldConfirmed ?? false);
  // Corrections de la classification par l'utilisateur (type de données, unité, structure).
  const [overrides, setOverrides] = useState<ClassificationOverrides>(() => (snap?.overrides as ClassificationOverrides) ?? {});
  // 1. Recherche (moteur de compréhension)
  const [research, setResearch] = useState<ResearchUnderstandingInput | null>(() => savedResearch(snap?.research));
  // 2. Instrument
  const [instrument, setInstrument] = useState<InstrumentState>(() => (snap ? ({ ...snap.instrument, kind: snap.instrument.kind as InstrumentKind | null, acadia: snap.instrument.acadia as InstrumentState["acadia"] }) : { kind: null, mode: "headers", text: "", acadia: null }));
  const [instrumentConfirmed, setInstrumentConfirmed] = useState(() => snap?.instrumentConfirmed ?? false);
  // 3. Données (même flux que l'onglet Données)
  const [data, dispatch] = useReducer(importFlowReducer, initialImportFlow);
  const fileRef = useRef<File | null>(null);
  const readToken = useRef(0);
  // Octets du fichier importé et options de lecture : pour la copie privée et la reprise à l'identique.
  const fileBytesRef = useRef<Uint8Array | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>(() => (snap?.data?.importOptions as ImportOptions) ?? {});
  const [fileSha, setFileSha] = useState<string | null>(snap?.data?.sha256 ?? null);
  const [keepFile, setKeepFile] = useState(true);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const uploadedFor = useRef<string | null>(null);
  // Reprise : fichier conservé (relu automatiquement) ou à réimporter.
  const [restore, setRestore] = useState<{ status: "idle" | "loading" | "needs_file" | "mismatch" | "done"; message?: string }>(() => (snap?.data ? { status: initial?.file ? "loading" : "needs_file" } : { status: "idle" }));
  // 4–8. Décisions
  const [qualityConfirmed, setQualityConfirmed] = useState(() => snap?.qualityConfirmed ?? false);
  const [mappingDecisions, setMappingDecisions] = useState<MappingDecisions>(() => (snap?.mappingDecisions as MappingDecisions) ?? emptyMappingDecisions());
  const [mappingConfirmedKey, setMappingConfirmedKey] = useState<string | null>(() => snap?.mappingConfirmedKey ?? null);
  const [planDecisions, setPlanDecisions] = useState<PlanDecisions>(() => (snap ? ({ ...emptyPlanDecisions(), ...(snap.planDecisions as Partial<PlanDecisions>) }) : emptyPlanDecisions()));
  const [alpha, setAlpha] = useState(() => snap?.alpha ?? 0.05);
  const [independence, setIndependence] = useState(() => snap?.independence ?? false);
  const [planValidatedKey, setPlanValidatedKey] = useState<string | null>(() => snap?.planValidatedKey ?? null);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [view, setView] = useState<StepId | null>(() => (snap?.view as StepId | null) ?? null);
  // Provenance DÉCLARÉE par l'utilisateur, rattachée à l'identifiant d'import du jeu de données (mémoire de session).
  const [provenances, setProvenances] = useState<ProvenanceRegistry>({});
  const [skipDecisions, setSkipDecisions] = useState<SkipDecisions>(() => (snap?.skipDecisions as SkipDecisions) ?? {});
  const [skipValues, setSkipValues] = useState<Record<string, string[]>>(() => snap?.skipValues ?? {});
  const [structuralChoice, setStructuralChoice] = useState<Record<number, boolean>>(() => (snap?.structuralChoice as Record<number, boolean>) ?? {});
  // Chaîne de cohérence : corrections de l'utilisateur et empreinte de la chaîne validée.
  const [chainDecisions, setChainDecisions] = useState<ChainDecisions>(() => (snap?.chainDecisions as ChainDecisions) ?? emptyChainDecisions());
  const [framingConfirmedKey, setFramingConfirmedKey] = useState<string | null>(() => snap?.framingConfirmedKey ?? null);

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

  // Chaîne de cohérence : question → objectif → hypothèse → variables → questions du questionnaire.
  const chain = useMemo(() => (research && report ? buildChain({ research, report, structure, cartography, questions, links, decisions: chainDecisions }) : null), [research, report, structure, cartography, questions, links, chainDecisions]);
  const framingKey = chain ? hashKey(chain.rows.map((r) => [r.questionId, r.objectiveId, r.hypothesisId, r.independent, r.dependent])) : null;
  const framingState: "none" | "confirmed" | "stale" = !framingConfirmedKey ? "none" : framingConfirmedKey === framingKey ? "confirmed" : "stale";

  // Empreinte de la cartographie : concepts → colonnes, rattachement de chaque question + types des colonnes décrites.
  const mappingKey = useMemo(() => {
    if (!cartography || !variables) return null;
    const keys = cartography.units.filter((u) => u.role === "key").map((u) => u.unit.primaryColumn);
    return hashKey([cartography.concepts.map((c) => [c.conceptKey, c.unitId]), keys.map((k) => [k, variables.find((v) => v.column === k)?.effectiveType]), (chain?.assignments ?? []).map((a) => [a.unitId, a.side, a.variableKey])]);
  }, [cartography, variables, chain]);
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
    () =>
      report && cartography && structure && prepared && variables
        ? chain
          ? buildChainPlan({ chain, report, cartography, structure, dataset: prepared.dataset, preparation: prepared.preparation, variables, instrument: instrument.kind, mainQuestion })
          : buildPlan({ report, cartography, structure, dataset: prepared.dataset, preparation: prepared.preparation, variables, instrument: instrument.kind, mainQuestion })
        : null,
    [report, cartography, structure, prepared, variables, instrument.kind, mainQuestion, chain],
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
  // Niveaux 2 et 3 : évaluation de chaque hypothèse sur tous ses croisements, puis interprétation rattachée.
  const assessments = useMemo(() => (chain && currentExecution ? assessChain(chain, currentExecution) : []), [chain, currentExecution]);
  const chainInterpretation = useMemo(() => (chain && currentExecution ? interpretChain(chain, currentExecution, assessments, mainQuestion) : null), [chain, currentExecution, assessments, mainQuestion]);
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
    framing: framingState,
    instrument: instrumentConfirmed,
    data: !!prepared,
    quality: qualityConfirmed && !!prepared,
    mapping: mappingState,
    plan: planState,
    results: resultsState,
  });
  const chosen = view && journey.steps.find((s) => s.id === view && s.state !== "todo") ? view : journey.current;
  // Reprise : tant que le fichier n'est pas relu, les étapes qui dépendent des données renvoient à « Mes données »
  // (réimport demandé) ; la vue enregistrée revient d'elle-même une fois le fichier relu.
  const awaitingFile = restore.status === "loading" || restore.status === "needs_file" || restore.status === "mismatch";
  const active: StepId = awaitingFile && STEP_ORDER.indexOf(chosen) > STEP_ORDER.indexOf("data") ? "data" : chosen;

  // --- Données --------------------------------------------------------
  const read = async (file: File, options: ImportOptions) => {
    const token = ++readToken.current;
    dispatch({ type: "read_started", options });
    setImportOptions(options);
    const bytes = new Uint8Array(await file.arrayBuffer());
    fileBytesRef.current = bytes;
    setFileSha(await sha256Hex(bytes));
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
    uploadedFor.current = null;
    setFileNotice(null);
    if (restore.status !== "idle" && restore.status !== "done") setRestore({ status: "idle" });
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
    const described = new Set([...(cartography?.units ?? []).filter((u) => u.role === "context").map((u) => u.unit.id), ...(chain?.assignments ?? []).map((a) => a.unitId)]);
    const contextTypes = Object.fromEntries(
      (structure?.units ?? [])
        .filter((u) => described.has(u.id) && u.kind !== "technical")
        .flatMap((u) => (u.primaryColumn !== null ? [u.primaryColumn] : u.columns))
        .map((column) => [column, variables.find((v) => v.column === column)?.effectiveType])
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
      setMappingConfirmedKey(hashKey([cartography.concepts.map((c) => [c.conceptKey, c.unitId]), keys.map((k) => [k, (k !== null && types[k]) || variables.find((v) => v.column === k)?.effectiveType]), (chain?.assignments ?? []).map((a) => [a.unitId, a.side, a.variableKey])]));
    }
    setView("plan");
  };

  // --- Sauvegarde dans le compte -------------------------------------
  const snapshot = useMemo<JourneySnapshot>(
    () => ({
      version: SNAPSHOT_VERSION,
      field,
      fieldConfirmed,
      overrides: overrides as Record<string, unknown>,
      research: research as unknown as Record<string, unknown> | null,
      chainDecisions: chainDecisions as unknown as JourneySnapshot["chainDecisions"],
      framingConfirmedKey,
      instrument: { kind: instrument.kind, mode: instrument.mode, text: instrument.text, acadia: instrument.acadia },
      instrumentConfirmed,
      // Pendant la reprise, l'état du fichier enregistré est conservé tel quel.
      data: prepared && fileSha
        ? { file: prepared.file, importOptions: importOptions as Record<string, unknown>, sha256: fileSha, columnCount: prepared.dataset.columnCount, rowCount: prepared.dataset.rowCount, operations: prepared.preparation.operations as JourneySnapshot["data"] extends infer D ? (D extends { operations: infer O } ? O : never) : never }
        : restore.status !== "idle" && restore.status !== "done" ? (snap?.data ?? null) : null,
      provenance: declaredProvenance ?? (restore.status !== "idle" && restore.status !== "done" ? (snap?.provenance ?? null) : null),
      qualityConfirmed,
      skipDecisions,
      skipValues,
      structuralChoice: structuralChoice as Record<string, boolean>,
      mappingDecisions: mappingDecisions as unknown as JourneySnapshot["mappingDecisions"],
      mappingConfirmedKey,
      planDecisions: planDecisions as unknown as Record<string, unknown>,
      alpha,
      independence,
      planValidatedKey,
      hadResults: !!execution || (snap?.hadResults ?? false),
      view,
    }),
    [field, fieldConfirmed, overrides, research, chainDecisions, framingConfirmedKey, instrument, instrumentConfirmed, prepared, fileSha, importOptions, restore.status, snap, declaredProvenance, qualityConfirmed, skipDecisions, skipValues, structuralChoice, mappingDecisions, mappingConfirmedKey, planDecisions, alpha, independence, planValidatedKey, execution, view],
  );
  const summary: SessionSummary = {
    stageLabel: STEP_LABELS[journey.current],
    progress: journey.stages.filter((s) => s.state === "done").length,
    verdicts: assessments.map((a) => ({ label: a.label, verdict: CHAIN_VERDICT_LABELS[a.verdict] })),
    dataFile: (prepared?.file.name ?? snap?.data?.file.name ?? null)?.slice(0, 260) ?? null,
  };
  const persistence = useJourneyPersistence({
    sessionId,
    revision: initial?.revision ?? 0,
    snapshot,
    title: (research?.title || prepared?.file.name || initial?.title || "Interprétation sans titre").slice(0, 200),
    stage: journey.current,
    summary,
    enabled: fieldConfirmed || !!research,
    paused: restore.status === "loading",
  });

  // Reprise : relit le fichier, vérifie son empreinte, puis rejoue les décisions de préparation.
  const restoreFrom = async (bytes: Uint8Array, meta: { name: string; size: number; lastModified: number }) => {
    const saved = snap?.data;
    if (!saved) return;
    const result = await importFile(meta.name, bytes, saved.importOptions as ImportOptions);
    if (!result.ok) {
      setRestore({ status: "needs_file", message: "Le fichier n'a pas pu être relu : réimportez-le." });
      return;
    }
    const { preparation, dropped } = replayOperations(saved.operations as unknown as PreparationOperation[], result.dataset);
    fileBytesRef.current = bytes;
    setFileSha(saved.sha256);
    setImportOptions(saved.importOptions as ImportOptions);
    dispatch({ type: "restore", file: meta, dataset: result.dataset, preparation });
    if (snap?.provenance) setProvenances((r) => declareProvenance(r, result.dataset.importId, snap.provenance as DataProvenance));
    uploadedFor.current = result.dataset.importId;
    setRestore({ status: "done", message: dropped ? `${dropped} décision(s) de préparation ne correspondaient plus au fichier et n'ont pas été rejouées.` : undefined });
  };
  const restoreStarted = useRef(false);
  useEffect(() => {
    if (restoreStarted.current || restore.status !== "loading" || !sessionId || !snap?.data) return;
    restoreStarted.current = true;
    void (async () => {
      try {
        const res = await fetch(`/api/journey/sessions/${sessionId}/file`, { cache: "no-store" });
        if (!res.ok) throw new Error("indisponible");
        const raw = new Uint8Array(await res.arrayBuffer());
        const bytes = res.headers.get("X-Acadia-Format") === "csv-gzip" ? gunzipSync(raw) : raw;
        if ((await sha256Hex(bytes)) !== snap.data!.sha256) throw new Error("empreinte");
        await restoreFrom(bytes, snap.data!.file);
      } catch {
        setRestore({ status: "needs_file", message: "Votre fichier n'a pas pu être récupéré automatiquement : réimportez-le pour retrouver vos données." });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restore.status, sessionId]);
  // Réimport à la reprise : même fichier (empreinte identique) → décisions rejouées ; sinon, l'utilisateur choisit.
  const onResumeFile = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if ((await sha256Hex(bytes)) === snap?.data?.sha256) {
      await restoreFrom(bytes, { name: file.name, size: file.size, lastModified: file.lastModified });
      return;
    }
    fileRef.current = file;
    setRestore({ status: "mismatch", message: `« ${file.name} » n'est pas le fichier enregistré (« ${snap?.data?.file.name} ») : son contenu est différent.` });
  };

  // Copie privée du fichier dans le compte (avec consentement), une fois par import.
  useEffect(() => {
    if (!prepared || !keepFile || !persistence.sessionId || !fileBytesRef.current || !fileSha) return;
    if (uploadedFor.current === prepared.dataset.importId) return;
    uploadedFor.current = prepared.dataset.importId;
    const format = prepared.dataset.format === "xlsx" ? "xlsx" : "csv";
    void persistence.uploadFile(fileBytesRef.current, prepared.file.name, format, fileSha).then((r) => setFileNotice(r.ok ? "Copie privée de votre fichier conservée dans votre compte." : (r.message ?? null)));
  }, [prepared, keepFile, persistence, fileSha]);

  // Reprise : les résultats enregistrés ne sont pas stockés comme des faits ; ils sont recalculés par les mêmes moteurs.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !snap?.hadResults || execution || running) return;
    if (snap.data && restore.status !== "done") return;
    if (!plan || !prepared || !variables || !planKey || !execKey || planKey !== planValidatedKey) return;
    autoRan.current = true;
    try {
      // Recalcul unique à la reprise (les résultats enregistrés ne sont jamais réaffichés sans être recalculés).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExecution(executePlan({ plan, decisions: planDecisions, dataset: prepared.dataset, preparation: prepared.preparation, variables, alpha, independenceConfirmed: independence, key: execKey, structural }));
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    }
  }, [snap, execution, running, restore.status, plan, prepared, variables, planKey, execKey, planValidatedKey, planDecisions, alpha, independence, structural]);

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
        <p className="relative mt-2 max-w-3xl text-sm leading-relaxed text-indigo-50">Six étapes ; vous confirmez chaque décision. Calculs effectués dans votre navigateur, sans IA ; votre travail est enregistré dans votre compte.</p>
        <p className="relative mt-3 inline-flex flex-wrap items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25" role="status" aria-label="État de la sauvegarde">
          {SAVE_LABELS[persistence.status]}
          {persistence.status === "conflict" ? <button type="button" className="underline" onClick={() => window.location.reload()}>Recharger la dernière version</button> : null}
        </p>
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
            onChange={(next) => {
              setField(next);
              setSwitchPrompt(false);
            }}
            onConfirm={() => {
              // Moteur dédié : il s'ouvre dans une NOUVELLE interprétation ; celle-ci reste enregistrée telle quelle.
              if (onSwitchEngine && field.specialty && specialtyOf(field.specialty)?.engine === "finance") {
                if (!persistence.sessionId) onSwitchEngine({ engine: "finance", field, research: research as unknown as Record<string, unknown> | null });
                else setSwitchPrompt(true);
                return;
              }
              setFieldConfirmed(true);
              setView("research");
            }}
            notice={
              switchPrompt && onSwitchEngine ? (
                <Notice
                  tone="info"
                  title="Ouvrir le moteur « Gestion financière »"
                  action={
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={buttonClass.primary} onClick={() => onSwitchEngine({ engine: "finance", field, research: research as unknown as Record<string, unknown> | null })}>
                        Ouvrir le moteur Gestion financière
                      </button>
                      <button type="button" className={buttonClass.ghost} onClick={() => setSwitchPrompt(false)}>
                        Rester dans le parcours actuel
                      </button>
                    </div>
                  }
                >
                  Votre interprétation actuelle reste enregistrée telle quelle ; une nouvelle interprétation « Gestion financière » sera créée avec votre domaine et votre sujet.
                </Notice>
              ) : field.specialty && specialtyOf(field.specialty)?.engine === "finance" && onSwitchEngine ? (
                <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Gestion financière : ACADIA ouvre son moteur dédié aux états financiers (bilan, compte de résultat, flux de trésorerie).</p>
              ) : field.specialty && specialtyOf(field.specialty)?.alternativeEngine === "econometrie" && onSwitchEngine ? (
                // Proposé, jamais imposé : une enquête auprès des ménages reste au parcours général.
                <Notice
                  tone="info"
                  title="Vos données sont-elles des séries temporelles ?"
                  action={
                    <button type="button" className={buttonClass.secondary} onClick={() => onSwitchEngine({ engine: "econometrie", field, research: research as unknown as Record<string, unknown> | null })}>
                      Ouvrir le moteur Économétrie et macroéconomie
                    </button>
                  }
                >
                  Inflation, PIB, masse monétaire, taux de change, production agricole… observés sur au moins 5 années (ou trimestres, ou mois) : le moteur « Économétrie et macroéconomie » mène la démarche complète (agrégats, stationnarité, estimation, cointégration). Pour une enquête par questionnaire (ménages, exploitations, entreprises), continuez ce parcours.
                  {persistence.sessionId ? " Votre interprétation actuelle reste enregistrée telle quelle." : ""}
                </Notice>
              ) : null
            }
          />
        ) : null}
        {active === "research" ? (
          <ResearchStep
            report={report}
            onAnalyze={(input) => {
              setResearch(input);
              setView("research");
            }}
            onContinue={() => setView("framing")}
            analyzed={research}
          />
        ) : null}
        {active === "framing" && chain ? (
          <FramingStep
            chain={chain}
            confirmed={framingState === "confirmed"}
            stale={framingState === "stale"}
            onChange={(rowId, patch) => setChainDecisions((d) => ({ ...d, rows: { ...d.rows, [rowId]: { ...d.rows[rowId], ...patch } } }))}
            onConfirm={() => {
              setChainDecisions((d) => ({ ...d, rows: Object.fromEntries(chain.rows.map((r) => [r.id, { ...d.rows[r.id], confirmed: true }])) }));
              setFramingConfirmedKey(framingKey);
              setView("instrument");
            }}
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
              {restore.status === "needs_file" || restore.status === "mismatch" ? (
                <Notice tone={restore.status === "mismatch" ? "warning" : "info"} title={restore.status === "mismatch" ? "Ce n'est pas le même fichier" : `Reprise : réimportez « ${snap?.data?.file.name ?? "votre fichier"} »`}>
                  <p>{restore.message ?? "Vos décisions sont enregistrées ; votre fichier de données n'a pas été conservé. Réimportez-le : s'il est identique, ACADIA rejoue toutes vos décisions."}</p>
                  {restore.status === "mismatch" ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className={buttonClass.secondary} onClick={() => fileRef.current && onFile(fileRef.current)}>
                        Utiliser ce nouveau fichier (décisions sur les données à refaire)
                      </button>
                      <button type="button" className={buttonClass.ghost} onClick={() => setRestore({ status: "needs_file" })}>
                        Choisir un autre fichier
                      </button>
                    </div>
                  ) : null}
                </Notice>
              ) : null}
              {restore.status === "needs_file" && data.step === "empty" ? <FileDropZone onFile={(file) => void onResumeFile(file)} /> : null}
              {restore.status === "loading" ? (
                <p className="flex items-center gap-2 text-sm text-slate-700" role="status">
                  <Loader2 size={18} className="animate-spin text-indigo-600" aria-hidden /> Récupération de votre fichier…
                </p>
              ) : null}
              {data.step === "empty" && restore.status !== "needs_file" && restore.status !== "loading" && restore.status !== "mismatch" ? <FileDropZone onFile={onFile} /> : null}
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={keepFile} onChange={(e) => setKeepFile(e.target.checked)} />
                <span>Conserver une copie privée de mon fichier dans mon compte, pour reprendre plus tard sans le réimporter (supprimée avec l&apos;interprétation).</span>
              </label>
              {fileNotice ? <p className="text-xs text-slate-600">{fileNotice}</p> : null}
              {restore.status === "done" && restore.message ? <Notice tone="warning">{restore.message}</Notice> : null}
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
        {active === "variables" && chain && structure ? <CoherenceMatrix chain={chain} onAssign={(unitId, side, variableKey) => setChainDecisions((d) => ({ ...d, assignments: { ...d.assignments, [unitId]: { side, variableKey } } }))} /> : null}
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
            <ResultsStep execution={currentExecution} interpretation={interpretation} chain={chain} assessments={assessments} chainInterpretation={chainInterpretation} trace={trace} perspective={routing.perspective} question={mainQuestion} stale={resultsState === "stale"} onRerun={runPlan} onEditPlan={() => setView("plan")} />
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
