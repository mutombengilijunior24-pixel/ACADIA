"use client";

import { useState } from "react";

import { VariableCard } from "@/components/data/DescriptivePanel";
import { ReportView } from "@/components/data/InferentialPanel";
import { Notice, Pill, Section } from "@/components/data/ui";
import { fmt, fmtP } from "@/lib/core/analysis/inferential";
import { CHAIN_VERDICT_LABELS, readingOf, statementOf, type ChainInterpretation, type ChainVerdict, type CrossingEvidence, type HypothesisAssessment, type ResearchChain } from "@/lib/core/chain";
import { cleanHeader, type Execution, type Paragraph } from "@/lib/core/journey";

export const VERDICT_TONE: Record<ChainVerdict, "green" | "yellow" | "neutral" | "red" | "blue"> = {
  supported: "green",
  partially_supported: "yellow",
  not_supported: "neutral",
  contrary: "red",
  inconclusive: "red",
  not_examined: "neutral",
};

const CONDITIONS: Record<CrossingEvidence["conditions"], { label: string; tone: "green" | "yellow" | "red" }> = {
  satisfied: { label: "Conditions réunies", tone: "green" },
  fisher: { label: "Test exact de Fisher", tone: "yellow" },
  unreliable: { label: "Non concluant", tone: "red" },
};

export function ChainParagraphs({ items }: { items: Paragraph[] }) {
  return (
    <ul className="space-y-2 text-sm text-slate-700">
      {items.map((p) => (
        <li key={p.text} className="flex flex-wrap items-start gap-2">
          <Pill tone={p.origin === "calcul" ? "blue" : "neutral"}>{p.origin === "calcul" ? "Calcul" : "Règles ACADIA"}</Pill>
          <span className="min-w-0 flex-1 break-words">{p.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Synthèse placée en tête des résultats : verdict de chaque hypothèse et réponse à la question principale. */
export function ChainSynthesis({ chain, assessments, interpretation }: { chain: ResearchChain; assessments: HypothesisAssessment[]; interpretation: ChainInterpretation }) {
  return (
    <div className="space-y-3">
      {assessments.length ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {assessments.map((a) => {
            const h = statementOf(chain, a.hypothesisId);
            return (
              <li key={a.rowId} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{a.label}</p>
                {h ? <p className="mt-0.5 text-sm font-medium text-slate-900">« {h.text} »</p> : null}
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <Pill tone={VERDICT_TONE[a.verdict]}>{CHAIN_VERDICT_LABELS[a.verdict]}</Pill>
                  <span className="text-xs text-slate-600">
                    {a.significant} association(s) significative(s) sur {a.tests} croisement(s) interprétable(s){a.tests > 1 ? " (Holm)" : ""}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <Notice tone="info" title="Aucune hypothèse testée">
          Les résultats sont descriptifs : aucune hypothèse avec une VI et une VD mesurées par le questionnaire.
        </Notice>
      )}
      <ChainParagraphs items={interpretation.mainAnswer} />
    </div>
  );
}

const GROUP_ORDER = ["profile", "independent", "dependent", "other"] as const;

/** Niveau 1 : chaque question du questionnaire → un tableau → un graphique, groupés selon la chaîne. */
export function DescriptiveLevel({ chain, execution }: { chain: ResearchChain; execution: Execution }) {
  const items = execution.items.filter((e) => e.kind === "descriptive");
  const groups = GROUP_ORDER.flatMap((group) => {
    if (group === "independent" || group === "dependent")
      return chain.variables
        .filter((v) => v.side === group)
        .map((v) => ({ key: `${group}:${v.key}`, title: `${group === "dependent" ? "Variable dépendante (VD)" : "Variable indépendante (VI)"} — ${v.name}`, open: true, items: items.filter((e) => e.item.chain?.variableKey === v.key) }));
    return [{ key: group, title: group === "profile" ? "Profil des répondants" : "Autres questions du questionnaire", open: false, items: items.filter((e) => e.item.chain?.group === group) }];
  }).filter((g) => g.items.length);
  return (
    <Section title="Niveau 1 — Interprétation descriptive d'ACADIA" description="Chaque question de votre questionnaire devient un tableau, puis un graphique, avec sa lecture. Les questions sont regroupées selon ce qu'elles mesurent.">
      <div className="space-y-3">
        {groups.map((group) => (
          <details key={group.key} className="group rounded-xl ring-1 ring-slate-200" open={group.open}>
            <summary className="cursor-pointer list-none rounded-xl px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50">
              <span className="mr-2 inline-block transition group-open:rotate-90" aria-hidden>
                ›
              </span>
              {group.title} <span className="font-normal text-slate-500">({group.items.length} question{group.items.length > 1 ? "s" : ""})</span>
            </summary>
            <div className="space-y-4 px-3 pb-3">
              {group.items.map((e) =>
                e.kind === "descriptive" ? (
                  <article key={e.item.id} className="space-y-2" aria-label={e.item.title}>
                    {e.results.map((result) => (
                      <div key={result.column} className="space-y-2">
                        <p className="rounded-lg bg-indigo-50/60 p-2 text-sm text-indigo-950">
                          <span className="font-semibold">Lecture : </span>
                          {readingOf(result, e.structural.find((s) => s.column === result.column))}
                        </p>
                        <VariableCard result={result.kind === "ordinal" ? { ...result, header: cleanHeader(result.header), meanAvailable: false } : { ...result, header: cleanHeader(result.header) }} meanEnabled={false} onToggleMean={() => undefined} />
                      </div>
                    ))}
                    {e.skipped.map((s) => (
                      <p key={s.column} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                        « {cleanHeader(s.header)} » non décrite : {s.reason}
                      </p>
                    ))}
                  </article>
                ) : null,
              )}
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}

/** Niveau 2 : par hypothèse, matrice des croisements questions VI × questions VD. */
export function InferentialLevel({ chain, execution, assessments }: { chain: ResearchChain; execution: Execution; assessments: HypothesisAssessment[] }) {
  const [opened, setOpened] = useState<string | null>(null);
  const titleOf = (unitId: string) => {
    const item = execution.items.find((e) => e.item.chain?.unitId === unitId);
    return item ? item.item.title : (chain.assignments.find((a) => a.unitId === unitId)?.text ?? unitId);
  };
  if (!assessments.length) return null;
  return (
    <Section title="Niveau 2 — Statistique inférentielle" description="Pour chaque hypothèse, les questions qui mesurent la VI sont croisées avec celles qui mesurent la VD : tableau croisé, Chi², conditions d'application et intensité de l'association. Cliquez une case pour voir le tableau croisé détaillé.">
      <div className="space-y-6">
        {assessments.map((a) => {
          const h = statementOf(chain, a.hypothesisId);
          const ivs = [...new Set(a.crossings.map((c) => c.ivUnitId))];
          const dvs = [...new Set(a.crossings.map((c) => c.dvUnitId))];
          const cell = (iv: string, dv: string) => a.crossings.find((c) => c.ivUnitId === iv && c.dvUnitId === dv);
          const open = a.crossings.find((c) => c.itemId === opened);
          return (
            <div key={a.rowId} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-slate-900">
                  {a.label}
                  {h ? ` — « ${h.text} »` : ""}
                </h3>
                <Pill tone={VERDICT_TONE[a.verdict]}>{CHAIN_VERDICT_LABELS[a.verdict]}</Pill>
              </div>
              {a.tests > 1 ? (
                <p className="text-xs text-slate-600">
                  {a.tests} tests sur cette hypothèse : les p-values sont ajustées par la méthode de Holm (seuil de Bonferroni indicatif : {fmt(a.bonferroni ?? a.alpha, 4)}). Une case « significative » l&apos;est après ajustement.
                </p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border border-slate-200 bg-slate-50 p-2 text-left text-xs font-semibold text-slate-600">Questions de la VI ↓ / de la VD →</th>
                      {dvs.map((dv) => (
                        <th key={dv} className="min-w-44 border border-slate-200 bg-slate-50 p-2 text-left text-xs font-semibold text-slate-700">
                          {titleOf(dv)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ivs.map((iv) => (
                      <tr key={iv}>
                        <th className="border border-slate-200 bg-slate-50 p-2 text-left text-xs font-semibold text-slate-700">{titleOf(iv)}</th>
                        {dvs.map((dv) => {
                          const c = cell(iv, dv);
                          if (!c) return <td key={dv} className="border border-slate-200 p-2 text-xs text-slate-400">—</td>;
                          return (
                            <td key={dv} className={`border border-slate-200 p-0 align-top ${c.significant ? "bg-emerald-50" : ""}`}>
                              <button type="button" onClick={() => setOpened(opened === c.itemId ? null : c.itemId)} aria-expanded={opened === c.itemId} className="block w-full p-2 text-left text-xs hover:bg-indigo-50">
                                {c.report ? (
                                  <>
                                    <span className="block font-semibold text-slate-900">{c.significant ? "Association significative" : c.reliable ? "Pas d'association significative" : "Non concluant"}</span>
                                    <span className="block text-slate-700">{c.statistic}</span>
                                    {c.p !== null ? (
                                      <span className="block text-slate-700">
                                        p {c.pSource === "fisher" ? "(Fisher) " : ""}
                                        {fmtP(c.p)}
                                        {a.tests > 1 && c.pAdjusted !== null ? ` · p ajustée ${fmtP(c.pAdjusted)}` : ""}
                                      </span>
                                    ) : null}
                                    {c.effect ? <span className="block text-slate-700">{c.effect} ({c.magnitude})</span> : null}
                                    <span className="mt-1 inline-block">
                                      <Pill tone={CONDITIONS[c.conditions].tone}>{CONDITIONS[c.conditions].label}</Pill>
                                    </span>
                                  </>
                                ) : (
                                  <span className="block text-rose-700">{c.failure ?? "Calcul non effectué."}</span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {open?.report ? (
                <div className="rounded-xl ring-1 ring-indigo-200">
                  <ReportView report={open.report} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** Niveau 3 : chaque résultat relié à sa question, son objectif et son hypothèse. */
export function InterpretationLevel({ interpretation, limits }: { interpretation: ChainInterpretation; limits: string[] }) {
  return (
    <Section title="Niveau 3 — Ce que les résultats disent de votre recherche" description="Chaque résultat est rattaché à sa question de recherche, son objectif et son hypothèse : ce qui rapproche les données de l'hypothèse, et ce qui les en éloigne. Interprétation déterministe, sans IA.">
      <div className="space-y-4">
        {interpretation.rows.map((row, index) => (
          <article key={row.rowId} className="rounded-2xl border border-slate-200 p-4" aria-label={`Lien ${index + 1}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Lien {index + 1}</span>
              {row.verdict ? <Pill tone="blue">{row.verdict}</Pill> : <Pill tone="neutral">Objectif descriptif</Pill>}
            </div>
            <dl className="mb-3 grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
              {row.question ? (
                <>
                  <dt className="font-medium text-slate-500">Question</dt>
                  <dd className="text-slate-900">{row.question}</dd>
                </>
              ) : null}
              {row.objective ? (
                <>
                  <dt className="font-medium text-slate-500">Objectif</dt>
                  <dd className="text-slate-900">{row.objective}</dd>
                </>
              ) : null}
              {row.hypothesis ? (
                <>
                  <dt className="font-medium text-slate-500">Hypothèse</dt>
                  <dd className="text-slate-900">{row.hypothesis}</dd>
                </>
              ) : null}
            </dl>
            <ChainParagraphs items={row.paragraphs} />
          </article>
        ))}
        <div>
          <h3 className="mb-2 font-bold text-slate-900">Réponse à la question principale</h3>
          <ChainParagraphs items={interpretation.mainAnswer} />
        </div>
        {limits.length ? (
          <div>
            <h3 className="mb-2 font-bold text-slate-900">Limites</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {limits.map((l) => (
                <li key={l} className="break-words">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
