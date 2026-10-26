"use client";

import { useState } from "react";
import { Plus, RotateCcw, Sparkles, X } from "lucide-react";

import { buttonClass, inputClass, Notice, Pill, Section } from "@/components/data/ui";
import { ResearchStep, type ResearchForm } from "@/components/journey/EarlySteps";
import {
  ambiguousCredit,
  chosenIndicators,
  conceptsOf,
  DEMO_RESEARCH,
  FAMILY_LABELS,
  financeProposals,
  formatValue,
  INDICATORS,
  INDICATOR_BY_ID,
  type FamilyId,
  type FinanceComputation,
  type IndicatorChoices,
  type IndicatorTarget,
  type LinkStructure,
} from "@/lib/core/finance";
import type { ResearchUnderstandingInput, UnderstandingReport } from "@/lib/core/understanding";

const KIND_LABELS = { question: "Question", objective: "Objectif", hypothesis: "Hypothèse" } as const;
const FIELD_OF = { question: "specificQuestions", objective: "specificObjectives", hypothesis: "hypotheses" } as const;

/** Exemple adapté à l'entreprise et aux exercices du dossier (le sujet fictif SOKAMA sinon). */
function exampleFor(company: string, from: string, to: string): Partial<ResearchForm> {
  const swap = (s: string) => s.replaceAll("SOKAMA SARL", company).replaceAll("2021", from).replaceAll("2023", to);
  return Object.fromEntries(Object.entries(DEMO_RESEARCH).map(([k, v]) => [k, k === "population" ? company : swap(v)]));
}

/** Étape « Sujet de recherche » du moteur financier : formulaire commun + lecture financière et propositions d'ACADIA. */
export function FinanceResearchStep({ report, analyzed, onAnalyze, onContinue, company, from, to }: { report: UnderstandingReport | null; analyzed: ResearchUnderstandingInput | null; onAnalyze: (input: ResearchUnderstandingInput) => void; onContinue: () => void; company: string; from: string; to: string }) {
  return (
    <ResearchStep
      title="4. Mon sujet de recherche"
      example={exampleFor(company, from, to)}
      continueLabel="Continuer : la cohérence de ma recherche"
      report={report}
      analyzed={analyzed}
      onAnalyze={onAnalyze}
      onContinue={onContinue}
      assistant={({ form, append }) => {
        const subject = `${form.title} ${form.mainQuestion} ${form.problem} ${form.generalObjective}`;
        const existing = `${form.specificQuestions}\n${form.specificObjectives}\n${form.hypotheses}`;
        const concepts = conceptsOf(`${subject} ${existing}`);
        const proposals = financeProposals({ subject: `${subject} ${existing}`, existing }, { company, from, to });
        if (!subject.trim()) return null;
        return (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="flex items-center gap-2 font-semibold text-emerald-950">
              <Sparkles size={18} aria-hidden /> Lecture financière de votre sujet
            </p>
            {concepts.length ? (
              <ul className="space-y-1.5 text-sm">
                {concepts.map((c) => (
                  <li key={c.id}>
                    <span className="font-semibold text-slate-900">{c.label}</span>
                    <span className="text-slate-600"> — mesurée par : {c.indicators.slice(0, 4).map((id) => INDICATOR_BY_ID[id]?.label ?? id).join(" ; ")}</span>
                    {c.note ? <span className="block text-xs text-amber-900">{c.note}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-700">Aucune notion de gestion financière reconnue pour l&apos;instant (endettement, rentabilité, trésorerie, liquidité, solvabilité, crédit clients…).</p>
            )}
            {ambiguousCredit(`${subject} ${existing}`) ? <Notice tone="warning" title="« Crédit » : lequel ?">Précisez : crédit bancaire (emprunts), crédit clients (délais de paiement accordés), crédit fournisseurs, crédit-bail ou crédit de trésorerie. Chacun se mesure par des indicateurs différents.</Notice> : null}
            {proposals.length ? (
              <div>
                <p className="text-sm font-semibold text-slate-900">Propositions d&apos;ACADIA (à ajouter si elles correspondent à votre étude)</p>
                <ul className="mt-2 space-y-2">
                  {proposals.map((p) => (
                    <li key={`${p.kind}:${p.text}`} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-white p-2 text-sm ring-1 ring-emerald-100">
                      <span className="min-w-0 flex-1">
                        <Pill tone={p.kind === "hypothesis" ? "yellow" : p.kind === "objective" ? "blue" : "neutral"}>{KIND_LABELS[p.kind]}</Pill> <span className="text-slate-800">{p.text}</span>
                      </span>
                      <button type="button" className={buttonClass.ghost} onClick={() => append(FIELD_OF[p.kind], p.text)}>
                        <Plus size={16} aria-hidden /> Ajouter
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        );
      }}
    />
  );
}

/** Variables financières reconnues dans chaque lien (affichées sous la chaîne de cohérence). */
export function FinanceVariablesNote({ links }: { links: LinkStructure[] }) {
  if (!links.length) return null;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
      <p className="font-semibold text-slate-900">Ce que mesure chaque lien</p>
      <ul className="mt-2 space-y-1">
        {links.map((l, i) => (
          <li key={l.rowId}>
            <span className="font-medium">Lien {i + 1} : </span>
            {l.independent && l.dependent ? (
              <>
                variable explicative <span className="font-semibold">{l.independent.label}</span> → variable expliquée <span className="font-semibold">{l.dependent.label}</span>
              </>
            ) : l.described.length ? (
              <>objectif descriptif : {l.described.map((c) => c.label).join(", ")}</>
            ) : (
              <span className="text-amber-900">aucune notion financière reconnue : reformulez l&apos;énoncé (endettement, rentabilité, trésorerie…)</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-600">Vous choisirez les indicateurs de chaque variable à l&apos;étape suivante.</p>
    </div>
  );
}

function IndicatorChip({ id, computation, onRemove }: { id: string; computation: FinanceComputation; onRemove: () => void }) {
  const s = computation.series[id];
  const pts = s?.values.map((v, i) => ({ v: v.value, i })).filter((p) => p.v !== null) ?? [];
  const trend = pts.length > 1 ? `${formatValue(pts[0].v, s.def.unit)} → ${formatValue(pts.at(-1)!.v, s.def.unit)}` : pts.length ? formatValue(pts[0].v, s.def.unit) : "non calculable";
  return (
    <li className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
      <span className="min-w-0">
        <span className="block font-medium text-slate-900">{s?.def.label ?? id}</span>
        <span className="block text-xs text-slate-500">
          {s?.def.formulaLabel} · <span className="tabular-nums">{trend}</span>
        </span>
      </span>
      <button type="button" className="ml-auto rounded-full p-1 text-slate-500 hover:bg-slate-100" onClick={onRemove} aria-label={`Retirer ${s?.def.label ?? id}`}>
        <X size={16} aria-hidden />
      </button>
    </li>
  );
}

/** Étape « Indicateurs à analyser » : pour chaque variable, les indicateurs proposés, modifiables. */
export function IndicatorPicker({ links, targets, choices, computation, confirmed, stale, onChange, onConfirm }: { links: LinkStructure[]; targets: IndicatorTarget[]; choices: IndicatorChoices; computation: FinanceComputation; confirmed: boolean; stale: boolean; onChange: (key: string, ids: string[] | null) => void; onConfirm: () => void }) {
  const [adding, setAdding] = useState<Record<string, string>>({});
  const families = Object.keys(FAMILY_LABELS) as FamilyId[];
  const empty = targets.some((t) => !chosenIndicators(t, choices).length);
  return (
    <Section
      title="4. Mon sujet : les indicateurs de mes variables"
      description="Chaque variable de votre étude se mesure par des indicateurs financiers. ACADIA propose les plus usuels ; gardez-les, retirez-en ou ajoutez-en d'autres parmi tous les indicateurs de sa base."
      action={confirmed ? <Pill tone="green">Validés par vous</Pill> : stale ? <Pill tone="yellow">À revoir</Pill> : <Pill tone="neutral">Proposés</Pill>}
    >
      {!targets.length ? (
        <Notice tone="warning" title="Aucune variable financière reconnue">
          Revenez à votre sujet et formulez vos hypothèses ou objectifs avec des notions financières (endettement, rentabilité, trésorerie, liquidité, solvabilité, crédit clients…).
        </Notice>
      ) : (
        <div className="space-y-4">
          {links.map((link, i) => {
            const concepts = link.independent && link.dependent ? [link.independent, link.dependent] : link.described;
            return (
              <article key={link.rowId} className="rounded-2xl border border-slate-200 p-4" aria-label={`Lien ${i + 1}`}>
                <p className="text-sm text-slate-600">
                  <span className="font-bold text-slate-900">Lien {i + 1}</span> — {link.statementKind === "hypothesis" ? "Hypothèse" : link.statementKind === "objective" ? "Objectif" : "Question"} : « {link.statement} »
                </p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {concepts.map((concept) => {
                    const target = targets.find((t) => t.key === `concept:${concept.id}`)!;
                    const chosen = chosenIndicators(target, choices);
                    const role = link.independent?.id === concept.id ? "Variable explicative (VI)" : link.dependent?.id === concept.id ? "Variable expliquée (VD)" : "Notion décrite";
                    return (
                      <div key={concept.id} className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{role}</p>
                        <p className="font-semibold text-slate-900">{concept.label}</p>
                        {concept.note ? <p className="mt-1 text-xs text-amber-900">{concept.note}</p> : null}
                        <ul className="mt-2 space-y-1.5">
                          {chosen.map((id) => (
                            <IndicatorChip key={id} id={id} computation={computation} onRemove={() => onChange(target.key, chosen.filter((x) => x !== id))} />
                          ))}
                        </ul>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <select className={`${inputClass} min-w-0 flex-1`} value={adding[target.key] ?? ""} onChange={(e) => setAdding((a) => ({ ...a, [target.key]: e.target.value }))} aria-label={`Ajouter un indicateur : ${concept.label}`}>
                            <option value="">Ajouter un indicateur…</option>
                            {families.map((f) => (
                              <optgroup key={f} label={FAMILY_LABELS[f]}>
                                {INDICATORS.filter((d) => d.family === f && !chosen.includes(d.id)).map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={buttonClass.secondary}
                            disabled={!adding[target.key]}
                            onClick={() => {
                              onChange(target.key, [...chosen, adding[target.key]]);
                              setAdding((a) => ({ ...a, [target.key]: "" }));
                            }}
                          >
                            <Plus size={16} aria-hidden /> Ajouter
                          </button>
                          {choices[target.key] ? (
                            <button type="button" className={buttonClass.ghost} onClick={() => onChange(target.key, null)}>
                              <RotateCcw size={14} aria-hidden /> Proposition d&apos;ACADIA
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {!concepts.length ? <p className="text-sm text-amber-900">Aucune notion financière reconnue dans cet énoncé.</p> : null}
                </div>
              </article>
            );
          })}
          {empty ? <Notice tone="warning">Chaque variable doit garder au moins un indicateur.</Notice> : null}
          <button type="button" className={buttonClass.primary} disabled={empty} onClick={onConfirm}>
            {confirmed ? "Continuer : les critères de vérification" : "Valider ces indicateurs et continuer"}
          </button>
        </div>
      )}
    </Section>
  );
}
