"use client";

import { CircleSlash, GitCompareArrows, Sigma } from "lucide-react";

import { VariableCard } from "@/components/data/DescriptivePanel";
import { ReportView } from "@/components/data/InferentialPanel";
import { buttonClass, Metric, Notice, Pill, Section } from "@/components/data/ui";
import { ExportBar } from "@/components/export/ExportBar";
import { fmt, fmtP, type AnalysisReport } from "@/lib/core/analysis/inferential";
import { journeyDocument, journeySheets } from "@/lib/core/export/reports";
import { traceLines, type ResultTrace } from "@/lib/core/orchestrator";
import type { ChainInterpretation, HypothesisAssessment, ResearchChain } from "@/lib/core/chain";
import { chainJourneyDocument, chainJourneySheets } from "@/lib/core/export/chainReports";

import { ChainSynthesis, DescriptiveLevel, InferentialLevel, InterpretationLevel } from "./ResultsChain";
import { cleanHeader, isIllustrative, OBJECTIVE_LABELS, VERDICT_LABELS, type Execution, type Interpretation, type ObjectiveStatus, type Paragraph } from "@/lib/core/journey";

const OBJECTIVE_TONE: Record<ObjectiveStatus, "green" | "blue" | "yellow" | "red"> = { tested: "green", described: "blue", partial: "yellow", not_addressed: "red" };

/** Lecture simple d'un test : comparaison des groupes si elle existe, sinon la description du tableau ou des moyennes. */
const simpleReading = (r: AnalysisReport) => r.interpretation.find((l) => l.startsWith("En comparant")) ?? r.interpretation.find((l) => !l.startsWith("Attention") && !/observation\(s\) (complète|utilisée)/.test(l)) ?? r.interpretation[0];

function Origin({ origin }: { origin: Paragraph["origin"] }) {
  return <Pill tone={origin === "calcul" ? "blue" : "neutral"}>{origin === "calcul" ? "Calcul automatique" : "Règles ACADIA"}</Pill>;
}

function Paragraphs({ items }: { items: Paragraph[] }) {
  if (!items.length) return <p className="text-sm text-slate-500">Rien à signaler.</p>;
  return (
    <ul className="space-y-2 text-sm text-slate-700">
      {items.map((p) => (
        <li key={p.text} className="flex flex-wrap items-start gap-2">
          <Origin origin={p.origin} />
          <span className="min-w-0 flex-1 break-words">{p.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Trois niveaux à ne jamais confondre : association observée, hypothèse compatible, causalité (non démontrée). */
function EvidenceLadder({ report, verdict }: { report: AnalysisReport; verdict: string | null }) {
  const association = !report.reliable ? { text: "Non concluante", detail: "Les conditions d'application du test ne sont pas réunies.", tone: "border-amber-400" } : report.significant ? { text: "Mise en évidence", detail: `p ${fmtP(report.pValue)} au seuil α = ${fmt(report.alpha)}, dans cet échantillon.`, tone: "border-indigo-500" } : { text: "Non mise en évidence", detail: `p ${fmtP(report.pValue)} : l'absence de relation n'est pas prouvée pour autant.`, tone: "border-slate-400" };
  return (
    <ol className="grid gap-2 md:grid-cols-3" aria-label="Portée du résultat">
      <li className={`rounded-xl border-l-4 bg-white p-3 ring-1 ring-slate-200 ${association.tone}`}>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Sigma size={14} aria-hidden /> 1. Association statistique
        </p>
        <p className="mt-1 font-semibold text-slate-900">{association.text}</p>
        <p className="mt-0.5 text-xs text-slate-600">{association.detail}</p>
      </li>
      <li className="rounded-xl border-l-4 border-emerald-500 bg-white p-3 ring-1 ring-slate-200">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <GitCompareArrows size={14} aria-hidden /> 2. Votre hypothèse
        </p>
        <p className="mt-1 font-semibold text-slate-900">{verdict ?? "Aucune hypothèse rattachée"}</p>
        <p className="mt-0.5 text-xs text-slate-600">Un test ne prouve pas une hypothèse : il dit si les données sont compatibles avec elle.</p>
      </li>
      <li className="rounded-xl border-l-4 border-rose-400 bg-white p-3 ring-1 ring-slate-200">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <CircleSlash size={14} aria-hidden /> 3. Relation de cause à effet
        </p>
        <p className="mt-1 font-semibold text-slate-900">Non démontrée</p>
        <p className="mt-0.5 text-xs text-slate-600">Une enquête par questionnaire montre des associations ; d&apos;autres facteurs peuvent les expliquer.</p>
      </li>
    </ol>
  );
}

function RelationSummary({ title, report, verdict }: { title: string; report: AnalysisReport; verdict: string | null }) {
  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 font-bold text-slate-900">{title}</h3>
        <Pill tone={report.reliable ? "green" : "red"}>{report.reliable ? "Conditions d'application satisfaites" : "Conditions non satisfaites"}</Pill>
      </div>
      <p className="text-xs text-slate-500">{report.methodLabel}</p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label="Observations" value={report.data.n} hint={report.data.rowsDropped ? `${report.data.rowsDropped} ligne(s) incomplète(s) écartée(s)` : "aucune ligne écartée"} />
        <Metric label="Statistique" value={`${report.statistic.name} = ${fmt(report.statistic.value)}`} hint={`ddl ${report.statistic.df}`} />
        <Metric label="Valeur p" value={`p ${fmtP(report.pValue)}`} hint={`seuil α = ${fmt(report.alpha)}`} />
        <Metric label="Taille d'effet" value={report.effect ? `${report.effect.name} = ${fmt(report.effect.value)}` : "—"} hint={report.effect ? `ampleur ${report.effect.magnitude}` : "non calculée"} />
      </div>
      <p className="text-sm leading-relaxed text-slate-800">
        <span className="font-semibold">Lecture simple : </span>
        {simpleReading(report)}
      </p>
      <EvidenceLadder report={report} verdict={verdict} />
    </article>
  );
}

export function ResultsStep({
  execution,
  interpretation,
  question,
  stale,
  onRerun,
  onEditPlan,
  trace,
  perspective,
  chain,
  assessments,
  chainInterpretation,
}: {
  chain?: ResearchChain | null;
  assessments?: HypothesisAssessment[];
  chainInterpretation?: ChainInterpretation | null;
  trace: ResultTrace | null;
  perspective: string | null;
  execution: Execution;
  interpretation: Interpretation;
  question: string;
  stale: boolean;
  onRerun: () => void;
  onEditPlan: () => void;
}) {
  const relations = execution.items.filter((e) => e.kind === "relation");
  const descriptives = execution.items.filter((e) => e.kind === "descriptive");
  const verdictFor = (hypotheses: string[]) => {
    const h = interpretation.hypotheses.find((x) => hypotheses.includes(x.text));
    return h ? VERDICT_LABELS[h.verdict] : null;
  };
  const provenance = interpretation.provenance;
  const context = { perspective, trace: trace ? traceLines(trace) : undefined };
  const staleNotice = stale ? (
    <Notice
      tone="stale"
      action={
        <button type="button" className={buttonClass.secondary} onClick={onRerun}>
          Relancer les calculs
        </button>
      }
    >
      Les données, les variables ou le plan ont changé depuis ces calculs : ces résultats sont périmés et ne doivent pas être utilisés tels quels.
    </Notice>
  ) : null;
  const traceSection = trace ? (
    <Section title="Traçabilité" description="À quoi ces résultats sont rattachés : s'il change, les résultats sont signalés périmés.">
      <details>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Voir la source, la version des données, les décisions, les moteurs et les paramètres</summary>
        <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
          {traceLines(trace).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-medium text-slate-800">{k}</dt>
              <dd className="break-words text-slate-600">{v}</dd>
            </div>
          ))}
        </dl>
      </details>
    </Section>
  ) : null;

  // Résultats organisés par la chaîne de cohérence : synthèse, puis les trois niveaux.
  if (chain && chainInterpretation) {
    const reportInput = { question, execution, interpretation, chain, assessments: assessments ?? [], chainInterpretation, context };
    const failed = execution.items.filter((e) => e.kind === "relation" && !e.outcome.ok);
    return (
      <div className="space-y-5">
        {staleNotice}
        <Section title="6. Résultats et interprétation" description="La synthèse d'abord, puis les trois niveaux : interprétation descriptive, statistique inférentielle et interprétation rattachée à votre recherche.">
          <div className="space-y-4">
            <div className="rounded-xl bg-indigo-50/70 p-3 text-sm text-indigo-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Question étudiée</p>
              <p className="mt-0.5 font-medium">« {question} »</p>
            </div>
            <p className={`rounded-xl border p-3 text-sm ${isIllustrative(provenance.value.kind) ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-700"}`} role="note">
              <span className="font-semibold">{provenance.statement}</span> {provenance.warning}
            </p>
            {perspective ? (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <span className="font-semibold">Perspective d&apos;interprétation : </span>
                {perspective}
              </p>
            ) : null}
            <ChainSynthesis chain={chain} assessments={assessments ?? []} interpretation={chainInterpretation} />
            {failed.map((e) =>
              e.kind === "relation" && !e.outcome.ok ? (
                <Notice key={e.item.id} tone="error" title={`${e.item.title} : calcul non effectué`} action={<button type="button" className={buttonClass.secondary} onClick={onEditPlan}>Revoir le plan</button>}>
                  {e.outcome.reason}
                </Notice>
              ) : null,
            )}
          </div>
        </Section>
        {!stale ? <ExportBar fileBase="acadia-rapport" title="Télécharger le rapport complet" sheets={() => chainJourneySheets(reportInput)} document={(palette) => chainJourneyDocument({ ...reportInput, palette })} /> : null}
        <DescriptiveLevel chain={chain} execution={execution} />
        <InferentialLevel chain={chain} execution={execution} assessments={assessments ?? []} />
        <InterpretationLevel interpretation={chainInterpretation} limits={[...new Set([...chainInterpretation.limits, ...interpretation.limits])]} />
        {traceSection}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {stale ? (
        <Notice
          tone="stale"
          action={
            <button type="button" className={buttonClass.secondary} onClick={onRerun}>
              Relancer les calculs
            </button>
          }
        >
          Les données, les variables ou le plan ont changé depuis ces calculs : ces résultats sont périmés et ne doivent pas être utilisés tels quels.
        </Notice>
      ) : null}

      <Section title="6. Résultats et interprétation" description="La synthèse d'abord ; les tableaux, graphiques, formules et conditions détaillées se trouvent plus bas.">
        <div className="space-y-4">
          <div className="rounded-xl bg-indigo-50/70 p-3 text-sm text-indigo-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Question étudiée</p>
            <p className="mt-0.5 font-medium">« {question} »</p>
          </div>
          <p className={`rounded-xl border p-3 text-sm ${isIllustrative(provenance.value.kind) ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-700"}`} role="note">
            <span className="font-semibold">{provenance.statement}</span> {provenance.warning}
          </p>
          {perspective ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <span className="font-semibold">Perspective d&apos;interprétation : </span>
              {perspective}
            </p>
          ) : null}
          {execution.multipleTesting ? (
            <Notice tone="warning" title="Comparaisons multiples">
              {execution.multipleTesting}
            </Notice>
          ) : null}
          {relations.length ? (
            relations.map((e) =>
              e.kind === "relation" && e.outcome.ok ? (
                <RelationSummary key={e.item.id} title={e.item.title} report={e.outcome.report} verdict={verdictFor(e.item.hypotheses)} />
              ) : e.kind === "relation" && !e.outcome.ok ? (
                <Notice key={e.item.id} tone="error" title={`${e.item.title} : calcul non effectué`} action={<button type="button" className={buttonClass.secondary} onClick={onEditPlan}>Revoir le plan</button>}>
                  {e.outcome.reason}
                </Notice>
              ) : null,
            )
          ) : (
            <Notice tone="info" title="Aucun test de relation">
              Le plan validé ne comporte que des analyses descriptives : elles présentent les variables sans tester de relation.
            </Notice>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="mb-2 font-bold text-slate-900">Réponse à la question</h3>
              <Paragraphs items={interpretation.answer} />
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="mb-2 font-bold text-slate-900">Conclusion prudente</h3>
              <Paragraphs items={interpretation.conclusion} />
            </div>
          </div>
        </div>
      </Section>

      {!stale ? <ExportBar fileBase="acadia-rapport" title="Télécharger le rapport complet" sheets={() => journeySheets({ question, execution, interpretation, context })} document={(palette) => journeyDocument({ question, execution, interpretation, palette, context })} /> : null}

      {interpretation.framework.objectives.length || interpretation.framework.problem ? (
        <Section title="Objectifs de la recherche" description="Un objectif n'est « examiné » que si une analyse porte réellement sur ce qu'il vise.">
          {interpretation.framework.problem ? <Paragraphs items={[interpretation.framework.problem]} /> : null}
          <ul className="mt-3 space-y-2 text-sm">
            {interpretation.framework.objectives.map((o) => (
              <li key={o.text} className="rounded-xl p-3 ring-1 ring-slate-200">
                <p className="flex flex-wrap items-center gap-2">
                  <Pill tone={OBJECTIVE_TONE[o.status]}>{OBJECTIVE_LABELS[o.status]}</Pill>
                  <span className="min-w-0 font-medium text-slate-900">
                    Objectif {o.kind} : {o.text}
                  </span>
                </p>
                <p className="mt-1 break-words text-slate-600">{o.detail}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Résultats détaillés" description="Tableaux, graphiques, formules, hypothèses statistiques et conditions d'application.">
        <div className="space-y-3">
          {relations.map((e, index) =>
            e.kind === "relation" && e.outcome.ok ? (
              <details key={e.item.id} className="group rounded-xl ring-1 ring-slate-200" open={index === 0}>
                <summary className="cursor-pointer list-none rounded-xl px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50">
                  <span className="mr-2 inline-block transition group-open:rotate-90" aria-hidden>
                    ›
                  </span>
                  {e.item.title}
                </summary>
                <div className="px-2 pb-2 sm:px-3">
                  <ReportView report={e.outcome.report} />
                </div>
              </details>
            ) : null,
          )}
          {descriptives.map((e) =>
            e.kind === "descriptive" ? (
              <details key={e.item.id} className="group rounded-xl ring-1 ring-slate-200">
                <summary className="cursor-pointer list-none rounded-xl px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50">
                  <span className="mr-2 inline-block transition group-open:rotate-90" aria-hidden>
                    ›
                  </span>
                  {e.item.title}
                </summary>
                <div className="space-y-3 px-3 pb-3">
                  {e.blocked ? (
                    <Notice tone="error" title="Description non calculée">
                      {e.blocked}
                    </Notice>
                  ) : null}
                  {e.structural.map((s) => (
                    <Notice key={s.column} tone="info" title="Question conditionnelle">
                      Pourcentages calculés sur les seuls répondants éligibles ; {s.count} réponse(s) « {s.values.join(" / ")} » hors dénominateur.
                    </Notice>
                  ))}
                  {e.results.map((result) => (
                    <VariableCard key={result.column} result={result.kind === "ordinal" ? { ...result, header: cleanHeader(result.header), meanAvailable: false } : { ...result, header: cleanHeader(result.header) }} meanEnabled={false} onToggleMean={() => undefined} />
                  ))}
                  {e.skipped.map((s) => (
                    <p key={s.column} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      « {s.header} » non décrite : {s.reason}
                    </p>
                  ))}
                </div>
              </details>
            ) : null,
          )}
        </div>
      </Section>

      {trace ? (
        <Section title="Traçabilité" description="À quoi ces résultats sont rattachés : s'il change, les résultats sont signalés périmés.">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Voir la source, la version des données, les décisions, les moteurs et les paramètres</summary>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
              {traceLines(trace).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-medium text-slate-800">{k}</dt>
                  <dd className="break-words text-slate-600">{v}</dd>
                </div>
              ))}
            </dl>
          </details>
        </Section>
      ) : null}

      <Section title="Interprétation complète" description="Interprétation déterministe, par règles : aucune assistance IA n'a été utilisée.">
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 font-bold text-slate-900">A. Ce que montrent les données</h3>
            <Paragraphs items={interpretation.data} />
          </div>
          <div>
            <h3 className="mb-2 font-bold text-slate-900">B. Ce que signifient les résultats</h3>
            <Paragraphs items={interpretation.meaning} />
          </div>
          <div>
            <h3 className="mb-2 font-bold text-slate-900">C. Rapport avec les hypothèses</h3>
            {interpretation.hypotheses.length ? (
              <ul className="space-y-2 text-sm">
                {interpretation.hypotheses.map((h) => (
                  <li key={h.text} className="rounded-xl border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">« {h.text} »</p>
                    <p className="mt-1">
                      <Pill tone={h.verdict === "compatible" ? "green" : h.verdict === "unreliable" || h.verdict === "contrary" ? "red" : "neutral"}>{VERDICT_LABELS[h.verdict]}</Pill>
                    </p>
                    <p className="mt-1 text-slate-700">{h.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Aucune hypothèse formulée.</p>
            )}
            <p className="mt-2 text-xs text-slate-500">Les tests portent sur l&apos;hypothèse nulle statistique (absence de relation), pas directement sur l&apos;hypothèse de recherche.</p>
          </div>
          <div>
            <h3 className="mb-2 font-bold text-slate-900">D. Réponse à la question de recherche</h3>
            <Paragraphs items={interpretation.answer} />
          </div>
          <div>
            <h3 className="mb-2 font-bold text-slate-900">E. Limites</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {interpretation.limits.map((l) => (
                <li key={l} className="break-words">
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-bold text-slate-900">F. Conclusion</h3>
            <Paragraphs items={interpretation.conclusion} />
          </div>
        </div>
      </Section>
    </div>
  );
}
