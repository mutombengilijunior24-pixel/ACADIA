"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { buttonClass, Notice } from "@/components/data/ui";
import { FramingStep } from "@/components/journey/ChainViews";
import { DomainStep } from "@/components/journey/OrchestrationViews";
import { StageNav } from "@/components/journey/StageNav";
import { SAVE_LABELS, useJourneyPersistence } from "@/components/journey/useJourneyPersistence";
import { buildChain, emptyChainDecisions, type ChainDecisions } from "@/lib/core/chain";
import { buildUnderstandingReport, emptyDecisions, validateResearchInput, type ResearchUnderstandingInput } from "@/lib/core/understanding";
import { hashKey } from "@/lib/core/understanding/text";
import {
  buildChapter,
  buildCriteria,
  companyLabel,
  computeFinance,
  criteriaKey as criteriaKeyOf,
  evaluateHypotheses,
  indicatorsKey as indicatorsKeyOf,
  indicatorTargets,
  interpretFinance,
  linkStructures,
  type ChapterDecisions,
  type CriteriaDecisions,
  type FinanceReportInput,
  type IndicatorChoices,
  DEMO_NOTICE,
  demoDossier,
  diagnose,
  financeReflexes,
  emptyDossier,
  FINANCE_SNAPSHOT_VERSION,
  FINANCE_STAGES,
  FINANCE_STEP_LABELS,
  financeStageOf,
  financeSteps,
  resolveAll,
  runChecks,
  setValue,
  sortedExercises,
  statementsKey,
  type FinanceDossier,
  type FinanceSnapshot,
  type FinanceStageId,
  type FinanceStepId,
} from "@/lib/core/finance";
import type { EngineHandoff } from "@/lib/core/journey/kinds";
import type { SessionSummary } from "@/lib/core/journey/persistence";
import { STEP_STATE_LABELS } from "@/lib/core/journey/steps";
import { specialtyOf, type DomainId, type SpecialtyId } from "@/lib/core/orchestrator";

import { DiagnosisView } from "./DiagnosisView";
import { ChapterView, CriteriaStep, ReasoningView } from "./ReasoningSteps";
import { FinanceResearchStep, FinanceVariablesNote, IndicatorPicker } from "./SubjectSteps";
import { ReviewStep, type Provenance } from "./ReviewStep";
import { SourceStep, type FinanceSource } from "./SourceStep";

export interface SavedFinanceSession {
  revision: number;
  title: string;
  snapshot: FinanceSnapshot;
}

type Field = { domain: DomainId | null; specialty: SpecialtyId | null; secondary: SpecialtyId[] };

/** Sujet enregistré (ou transmis par le parcours général), revalidé avant usage. */
function savedResearch(raw: unknown): ResearchUnderstandingInput | null {
  if (!raw || typeof raw !== "object") return null;
  const v = validateResearchInput(raw as Parameters<typeof validateResearchInput>[0]);
  return v.ok ? v.input : null;
}

const triState = (saved: string | null, current: string) => (saved ? (saved === current ? "confirmed" : "stale") : "none") as "none" | "confirmed" | "stale";

/**
 * Moteur « Gestion financière » : des états financiers de l'entreprise (SYSCOHADA révisé) à l'interprétation.
 * Tous les calculs sont faits dans le navigateur, sans IA ; seuls les chiffres validés et les décisions sont
 * enregistrés dans le compte (jamais le document d'origine).
 */
export default function FinanceWorkspace({ sessionId, initial, handoff = null }: { sessionId: string | null; initial: SavedFinanceSession | null; handoff?: EngineHandoff | null }) {
  const snap = initial?.snapshot ?? null;
  const [field, setField] = useState<Field>(() => (snap?.field ?? handoff?.field ?? { domain: "management", specialty: "finance", secondary: [] }) as Field);
  // Ouvert depuis le parcours général après confirmation du domaine : le domaine est déjà confirmé.
  const [fieldConfirmed, setFieldConfirmed] = useState(() => snap?.fieldConfirmed ?? !!handoff);
  const [research, setResearch] = useState<ResearchUnderstandingInput | null>(() => savedResearch(snap?.research ?? handoff?.research ?? null));
  const [chainDecisions, setChainDecisions] = useState<ChainDecisions>(() => (snap?.chainDecisions as ChainDecisions | undefined) ?? emptyChainDecisions());
  const [framingConfirmedKey, setFramingConfirmedKey] = useState<string | null>(() => snap?.framingConfirmedKey ?? null);
  const [indicatorChoices, setIndicatorChoices] = useState<IndicatorChoices>(() => snap?.indicatorChoices ?? {});
  const [indicatorsConfirmedKey, setIndicatorsConfirmedKey] = useState<string | null>(() => snap?.indicatorsConfirmedKey ?? null);
  const [criteriaDecisions, setCriteriaDecisions] = useState<CriteriaDecisions>(() => (snap?.criteriaDecisions as CriteriaDecisions | undefined) ?? {});
  const [criteriaConfirmedKey, setCriteriaConfirmedKey] = useState<string | null>(() => snap?.criteriaConfirmedKey ?? null);
  const [reasoningSeenKey, setReasoningSeenKey] = useState<string | null>(() => snap?.reasoningSeenKey ?? null);
  const [chapterDecisions, setChapterDecisions] = useState<ChapterDecisions>(() => snap?.chapterDecisions ?? {});
  const [chapterKey, setChapterKey] = useState<string | null>(() => snap?.chapterKey ?? null);
  const [source, setSource] = useState<FinanceSource | null>(() => snap?.source ?? null);
  const [dossier, setDossier] = useState<FinanceDossier>(() => (snap?.dossier as FinanceDossier | undefined) ?? emptyDossier());
  const [provenance, setProvenance] = useState<Provenance | null>(() => snap?.provenance ?? null);
  const [attested, setAttested] = useState(() => snap?.attested ?? false);
  const [acceptedGaps, setAcceptedGaps] = useState<Record<string, string>>(() => snap?.acceptedGaps ?? {});
  const [validatedKey, setValidatedKey] = useState<string | null>(() => snap?.validatedKey ?? null);
  const [diagnosisSeenKey, setDiagnosisSeenKey] = useState<string | null>(() => snap?.diagnosisSeenKey ?? null);
  const [view, setView] = useState<FinanceStepId | null>(() => (snap?.view as FinanceStepId | null) ?? null);

  const key = statementsKey(dossier);
  const resolved = useMemo(() => resolveAll(dossier), [dossier]);
  const checks = useMemo(() => runChecks(dossier), [dossier]);
  const review = validatedKey ? (validatedKey === key ? "validated" : "stale") : "none";
  // Indicateurs, verdict et réflexes : recalculés à partir des chiffres (jamais enregistrés comme des faits).
  const computation = useMemo(() => computeFinance(dossier), [dossier]);
  const diagnosis = useMemo(() => diagnose(computation, dossier), [computation, dossier]);
  const reflexes = useMemo(() => financeReflexes(computation, dossier, { provenance: provenance?.kind ?? null, acceptedGaps: Object.keys(acceptedGaps).length }), [computation, dossier, provenance, acceptedGaps]);
  const diagnosisState = diagnosisSeenKey ? (diagnosisSeenKey === key ? "seen" : "stale") : "none";
  const exercisesSorted = sortedExercises(dossier.exercises);
  const company = companyLabel(dossier.company.name);

  // Sujet de recherche → chaîne de cohérence → variables financières → indicateurs → critères → raisonnement.
  const report = useMemo(() => (research ? buildUnderstandingReport(research, emptyDecisions()) : null), [research]);
  const chain = useMemo(() => (research && report ? buildChain({ research, report, decisions: chainDecisions }) : null), [research, report, chainDecisions]);
  const framingKey = chain ? hashKey({ rows: chain.rows.map((r) => [r.questionId, r.objectiveId, r.hypothesisId]), statements: chain.statements.map((s) => s.text) }) : "";
  const framingState = triState(framingConfirmedKey, framingKey);
  const links = useMemo(() => (chain && research ? linkStructures(chain, research.title) : []), [chain, research]);
  const targets = useMemo(() => indicatorTargets(links), [links]);
  const indKey = indicatorsKeyOf(targets, indicatorChoices) + framingKey;
  const indicatorsState = triState(indicatorsConfirmedKey, indKey);
  const criteria = useMemo(() => buildCriteria(links, targets, indicatorChoices, criteriaDecisions), [links, targets, indicatorChoices, criteriaDecisions]);
  const critKey = criteriaKeyOf(criteria, key) + indKey;
  const criteriaState = triState(criteriaConfirmedKey, critKey);
  const results = useMemo(() => evaluateHypotheses(links, criteria, computation, dossier), [links, criteria, computation, dossier]);
  const reasoning = useMemo(() => interpretFinance({ links, results, computation, diagnosis, reflexes, dossier, mainQuestion: research?.mainQuestion ?? "", company }), [links, results, computation, diagnosis, reflexes, dossier, research, company]);
  const reasoningState = reasoningSeenKey ? (reasoningSeenKey === critKey ? "seen" : "stale") : "none";
  const chapter = useMemo(() => buildChapter({ dossier, computation, diagnosis, links, results, reasoning, targets, choices: indicatorChoices, reflexes, provenance: provenance?.kind ?? null, company, acceptedGaps: Object.keys(acceptedGaps).length }, chapterDecisions), [dossier, computation, diagnosis, links, results, reasoning, targets, indicatorChoices, reflexes, provenance, company, acceptedGaps, chapterDecisions]);
  const chapterNowKey = hashKey({ critKey, chapterDecisions });
  const reportState = chapterKey ? (chapterKey === chapterNowKey ? "done" : "stale") : "none";

  const journey = financeSteps({
    domain: fieldConfirmed,
    source: source !== null,
    review,
    diagnosis: diagnosisState,
    research: !!research,
    framing: framingState,
    indicators: indicatorsState,
    criteria: criteriaState,
    reasoning: reasoningState,
    report: reportState,
  });
  const active: FinanceStepId = view && journey.steps.find((s) => s.id === view && s.state !== "todo") ? view : journey.current;
  const activeStage = financeStageOf(active);
  const isDemo = source === "demo" || provenance?.kind === "fictifs";
  const exercises = sortedExercises(dossier.exercises);

  // Toute modification d'un chiffre retire l'attestation : elle porte sur les chiffres vérifiés.
  const changeDossier = (next: FinanceDossier) => {
    setDossier(next);
    if (statementsKey(next) !== key) setAttested(false);
  };

  const snapshot: FinanceSnapshot = useMemo(
    () => ({
      engine: "finance",
      version: FINANCE_SNAPSHOT_VERSION,
      field,
      fieldConfirmed,
      source,
      dossier,
      provenance,
      attested,
      acceptedGaps,
      validatedKey,
      diagnosisSeenKey,
      research: research as unknown as Record<string, unknown> | null,
      chainDecisions,
      framingConfirmedKey,
      indicatorChoices,
      indicatorsConfirmedKey,
      criteriaDecisions,
      criteriaConfirmedKey,
      reasoningSeenKey,
      chapterDecisions,
      chapterKey,
      view,
    }),
    [field, fieldConfirmed, source, dossier, provenance, attested, acceptedGaps, validatedKey, diagnosisSeenKey, research, chainDecisions, framingConfirmedKey, indicatorChoices, indicatorsConfirmedKey, criteriaDecisions, criteriaConfirmedKey, reasoningSeenKey, chapterDecisions, chapterKey, view],
  );
  const summary: SessionSummary = {
    stageLabel: activeStage.label,
    progress: journey.stages.filter((s) => s.state === "done").length,
    verdicts: [
      ...(diagnosis && review === "validated" ? [{ label: "État de l'entreprise", verdict: diagnosis.headline.slice(0, 80) }] : []),
      ...(criteriaState === "confirmed" ? reasoning.readings.filter((r) => r.verdict !== "not_examined").slice(0, 8).map((r) => ({ label: r.title, verdict: r.verdictLabel.slice(0, 80) })) : []),
    ],
    dataFile: null,
    detail: dossier.company.name ? `${dossier.company.name}${exercises.length ? ` · ${exercises[0].label}${exercises.length > 1 ? `–${exercises.at(-1)!.label}` : ""}` : ""}` : null,
  };
  const persistence = useJourneyPersistence({
    sessionId,
    revision: initial?.revision ?? 0,
    kind: "finance",
    snapshot,
    title: (typeof research?.title === "string" && research.title ? research.title : dossier.company.name ? `Analyse financière — ${dossier.company.name}` : initial?.title || "Analyse financière").slice(0, 200),
    stage: journey.current,
    summary,
    enabled: fieldConfirmed,
    paused: false,
  });

  const reportInput: FinanceReportInput = { dossier, computation, diagnosis, reflexes, results, reasoning, chapter, checks, provenance, acceptedGaps, title: research?.title || `Analyse financière — ${dossier.company.name}`, mainQuestion: research?.mainQuestion ?? "", isDemo };

  const goToStage = (stageId: string) => {
    const stage = FINANCE_STAGES.find((s) => s.id === (stageId as FinanceStageId))!;
    const target = stage.steps.find((id) => journey.steps.find((s) => s.id === id)?.state !== "done") ?? stage.steps[0];
    setView(target);
  };

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-500 px-5 py-5 text-white shadow-lg shadow-emerald-900/10 sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Gestion financière</p>
        <h1 className="relative mt-1 text-xl font-extrabold leading-tight sm:text-3xl">Des états financiers de l&apos;entreprise à l&apos;interprétation</h1>
        <p className="relative mt-2 max-w-3xl text-sm leading-relaxed text-emerald-50">Bilan, compte de résultat et flux de trésorerie (SYSCOHADA révisé). Vous validez chaque chiffre ; les calculs sont faits dans votre navigateur, sans IA ; votre travail est enregistré dans votre compte.</p>
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
        label="Étapes du moteur Gestion financière"
        stages={journey.stages}
        activeStageId={activeStage.id}
        nextAction={journey.nextAction}
        onGo={goToStage}
        goCurrent={active !== journey.current ? { label: `Aller à « ${financeStageOf(journey.current).label} »`, onClick: () => setView(journey.current) } : null}
      />

      <section aria-label={FINANCE_STEP_LABELS[active]} className="space-y-5">
        {activeStage.steps.length > 1 ? (
          <nav aria-label={`Sous-étapes : ${activeStage.label}`} className="flex flex-wrap gap-2">
            {activeStage.steps.map((id, i) => {
              const state = journey.steps.find((x) => x.id === id)!.state;
              return state === "todo" ? (
                <span key={id} className="inline-flex min-h-9 items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-500">
                  {i + 1}. {FINANCE_STEP_LABELS[id]} · {STEP_STATE_LABELS[state]}
                </span>
              ) : (
                <button key={id} type="button" onClick={() => setView(id)} aria-current={active === id ? "step" : undefined} className={`inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold ring-1 ${active === id ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}>
                  {i + 1}. {FINANCE_STEP_LABELS[id]} · {STEP_STATE_LABELS[state]}
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
            continueLabel="Continuer : mes états financiers"
            onChange={setField}
            onConfirm={() => {
              setFieldConfirmed(true);
              setView("source");
            }}
            notice={
              field.specialty && specialtyOf(field.specialty)?.engine !== "finance" ? (
                <Notice
                  tone="info"
                  title="Votre étude ne repose pas sur des états financiers ?"
                  action={
                    <Link href="/dashboard/journey" className={buttonClass.secondary}>
                      Ouvrir le parcours général
                    </Link>
                  }
                >
                  Ce moteur analyse les états financiers d&apos;une entreprise. Pour une enquête par questionnaire ou des entretiens, ouvrez le parcours général (nouvelle interprétation).
                </Notice>
              ) : null
            }
          />
        ) : null}

        {active === "source" ? (
          <SourceStep
            source={source}
            hasValues={Object.values(dossier.values).some((v) => Object.keys(v).length > 0)}
            onChoose={(next) => {
              setSource(next);
              if (next === "demo") {
                changeDossier(demoDossier());
                setProvenance({ kind: "fictifs", description: "Entreprise imaginaire fournie par ACADIA pour la démonstration." });
                setAcceptedGaps({});
              }
              setView("review");
            }}
          />
        ) : null}

        {active === "review" ? (
          <ReviewStep
            dossier={dossier}
            resolved={resolved}
            checks={checks}
            acceptedGaps={acceptedGaps}
            provenance={provenance}
            attested={attested}
            validated={review === "validated"}
            stale={review === "stale"}
            onDossier={changeDossier}
            onValue={(exerciseId, code, value) => changeDossier(setValue(dossier, exerciseId, code, value, "saisie"))}
            onAccept={(gapKey, justification) =>
              setAcceptedGaps((current) => {
                const next = { ...current };
                if (justification) next[gapKey] = justification;
                else delete next[gapKey];
                return next;
              })
            }
            onProvenance={setProvenance}
            onAttested={setAttested}
            onValidate={() => {
              setValidatedKey(key);
              setView("diagnosis");
            }}
          />
        ) : null}

        {active === "diagnosis" && diagnosis ? (
          <DiagnosisView
            computation={computation}
            diagnosis={diagnosis}
            reflexes={reflexes}
            dossier={dossier}
            seen={diagnosisState === "seen"}
            stale={diagnosisState === "stale"}
            onConfirm={() => {
              setDiagnosisSeenKey(key);
              setView("research");
            }}
          />
        ) : null}

        {active === "research" ? (
          <FinanceResearchStep
            report={report}
            analyzed={research}
            company={company}
            from={exercisesSorted[0]?.label ?? ""}
            to={exercisesSorted.at(-1)?.label ?? ""}
            onAnalyze={(input) => setResearch(input)}
            onContinue={() => setView("framing")}
          />
        ) : null}

        {active === "framing" && chain ? (
          <FramingStep
            title="4. Mon sujet : la cohérence de ma recherche"
            continueLabel="Continuer : les indicateurs"
            chain={chain}
            confirmed={framingState === "confirmed"}
            stale={framingState === "stale"}
            variablesNote={<FinanceVariablesNote links={links} />}
            onChange={(rowId, patchRow) => setChainDecisions((d) => ({ ...d, rows: { ...d.rows, [rowId]: { ...d.rows[rowId], ...patchRow } } }))}
            onConfirm={() => {
              setChainDecisions((d) => ({ ...d, rows: Object.fromEntries(chain.rows.map((r) => [r.id, { ...d.rows[r.id], confirmed: true }])) }));
              setFramingConfirmedKey(framingKey);
              setView("indicators");
            }}
          />
        ) : null}

        {active === "indicators" ? (
          <IndicatorPicker
            links={links}
            targets={targets}
            choices={indicatorChoices}
            computation={computation}
            confirmed={indicatorsState === "confirmed"}
            stale={indicatorsState === "stale"}
            onChange={(targetKey, ids) =>
              setIndicatorChoices((c) => {
                const next = { ...c };
                if (ids === null) delete next[targetKey];
                else next[targetKey] = ids;
                return next;
              })
            }
            onConfirm={() => {
              setIndicatorsConfirmedKey(indKey);
              setView("criteria");
            }}
          />
        ) : null}

        {active === "criteria" ? (
          <CriteriaStep
            links={links}
            criteria={criteria}
            decisions={criteriaDecisions}
            exercises={exercisesSorted.length}
            confirmed={criteriaState === "confirmed"}
            stale={criteriaState === "stale"}
            onDecision={(id, decision) =>
              setCriteriaDecisions((d) => {
                const next = { ...d };
                if (decision === null) delete next[id];
                else next[id] = decision;
                return next;
              })
            }
            onConfirm={() => {
              setCriteriaConfirmedKey(critKey);
              setView("reasoning");
            }}
          />
        ) : null}

        {active === "reasoning" ? (
          <ReasoningView
            reasoning={reasoning}
            results={results}
            computation={computation}
            dossier={dossier}
            seen={reasoningState === "seen"}
            stale={reasoningState === "stale"}
            onConfirm={() => {
              setReasoningSeenKey(critKey);
              setView("report");
            }}
          />
        ) : null}

        {active === "report" ? (
          <ChapterView
            chapter={chapter}
            decisions={chapterDecisions}
            onDecisions={setChapterDecisions}
            report={reportInput}
            done={reportState === "done"}
            stale={reportState === "stale"}
            onDone={() => setChapterKey(chapterNowKey)}
            fileBase={`acadia-analyse-financiere${isDemo ? "-FICTIF" : ""}`}
          />
        ) : null}
      </section>
    </div>
  );
}
