"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { buttonClass, inputClass, Notice, Pill, Section } from "@/components/data/ui";
import { QUESTION_SIDE_LABELS, statementOf, type ChainRow, type QuestionSide, type ResearchChain, type StatementKind } from "@/lib/core/chain";
import { cleanHeader } from "@/lib/core/journey";

const CONFIDENCE: Record<ChainRow["confidence"], { label: string; tone: "green" | "yellow" | "neutral" }> = {
  high: { label: "Lien sûr", tone: "green" },
  medium: { label: "Lien probable", tone: "yellow" },
  low: { label: "Lien à vérifier", tone: "neutral" },
};

const KIND_LABEL: Record<StatementKind, string> = { question: "Question", objective: "Objectif", hypothesis: "Hypothèse" };

function StatementSelect({ chain, kind, value, onChange, label }: { chain: ResearchChain; kind: StatementKind; value: string | null; onChange: (id: string | null) => void; label: string }) {
  const options = chain.statements.filter((s) => s.kind === kind);
  return (
    <label className="block min-w-0 text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select className={`${inputClass} truncate`} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} aria-label={label}>
        <option value="">— Aucun(e) —</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {KIND_LABEL[kind]} {s.index + 1}
            {s.origin === "engine" ? " (proposée par ACADIA)" : ""} : {s.text.slice(0, 110)}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ================================================================= */
/* 2 bis. Cohérence de ma recherche                                    */
/* ================================================================= */

export function FramingStep({
  chain,
  confirmed,
  stale,
  onChange,
  onConfirm,
  title = "2. Mon sujet : la cohérence de ma recherche",
  continueLabel = "Continuer : mes données",
  variablesNote,
}: {
  chain: ResearchChain;
  confirmed: boolean;
  stale: boolean;
  onChange: (rowId: string, patch: { questionId?: string | null; objectiveId?: string | null; hypothesisId?: string | null }) => void;
  onConfirm: () => void;
  title?: string;
  continueLabel?: string;
  /** Remplace le bloc « Variables et indicateurs proposés » (moteur dédié). */
  variablesNote?: ReactNode;
}) {
  const variableName = (key: string) => chain.variables.find((v) => v.key === key)?.name ?? key;
  return (
    <Section
      title={title}
      description="Du problème à la vérification : chaque question de recherche appelle un objectif, puis une réponse provisoire (hypothèse), elle-même vérifiée par des variables. ACADIA a relié vos énoncés ; vérifiez, corrigez si besoin, puis validez."
      action={confirmed ? <Pill tone="green">Validée par vous</Pill> : stale ? <Pill tone="yellow">À revoir</Pill> : <Pill tone="neutral">Proposée</Pill>}
    >
      <div className="space-y-4">
        {chain.problem.trim() ? (
          <div className="rounded-xl bg-indigo-50/70 p-3 text-sm text-indigo-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Problème de départ</p>
            <p className="mt-0.5">{chain.problem}</p>
          </div>
        ) : null}
        {chain.rows.length ? (
          <ol className="space-y-3">
            {chain.rows.map((row, index) => {
              const hypothesis = statementOf(chain, row.hypothesisId);
              return (
                <li key={row.id} className="rounded-2xl border border-slate-200 p-4" aria-label={`Lien ${index + 1}`}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Lien {index + 1}</span>
                    <Pill tone={CONFIDENCE[row.confidence].tone}>{CONFIDENCE[row.confidence].label}</Pill>
                    {row.descriptive ? <Pill tone="blue">Objectif descriptif</Pill> : null}
                    {hypothesis?.origin === "engine" ? <Pill tone="yellow">Hypothèse proposée par ACADIA</Pill> : null}
                  </div>
                  <div className="grid items-end gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
                    <StatementSelect chain={chain} kind="question" value={row.questionId} label="Question de recherche" onChange={(id) => onChange(row.id, { questionId: id })} />
                    <ArrowRight className="mx-auto hidden text-slate-400 lg:mb-3 lg:block" size={18} aria-hidden />
                    <StatementSelect chain={chain} kind="objective" value={row.objectiveId} label="Objectif" onChange={(id) => onChange(row.id, { objectiveId: id })} />
                    <ArrowRight className="mx-auto hidden text-slate-400 lg:mb-3 lg:block" size={18} aria-hidden />
                    <StatementSelect chain={chain} kind="hypothesis" value={row.hypothesisId} label="Hypothèse (réponse provisoire)" onChange={(id) => onChange(row.id, { hypothesisId: id })} />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <p className="rounded-xl bg-slate-50 p-2">
                      <span className="font-semibold text-slate-800">Variable indépendante (VI) : </span>
                      {row.independent.length ? row.independent.map(variableName).join(", ") : <span className="text-slate-500">{row.descriptive ? "sans objet (objectif descriptif)" : "non identifiée"}</span>}
                    </p>
                    <p className="rounded-xl bg-slate-50 p-2">
                      <span className="font-semibold text-slate-800">Variable dépendante (VD) : </span>
                      {row.dependent.length ? row.dependent.map(variableName).join(", ") : <span className="text-slate-500">{row.descriptive ? "sans objet (objectif descriptif)" : "non identifiée"}</span>}
                    </p>
                  </div>
                  {row.reasons.length ? (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-slate-600">Pourquoi ACADIA propose ce lien</summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600">
                        {row.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <Notice tone="info" title="Aucun énoncé à relier">
            Ajoutez vos questions spécifiques, vos objectifs et vos hypothèses à l&apos;étape précédente : ACADIA les reliera.
          </Notice>
        )}
        {variablesNote !== undefined ? variablesNote : chain.variables.length ? (
          <div className="rounded-xl border border-slate-200 p-3 text-sm">
            <p className="font-semibold text-slate-900">Variables et indicateurs proposés</p>
            <ul className="mt-2 space-y-1.5">
              {chain.variables.map((v) => (
                <li key={v.key}>
                  <span className="font-medium text-slate-900">{v.side === "dependent" ? "VD" : "VI"} — {v.name}</span>
                  {v.suggestedIndicators.length ? <span className="block text-xs text-slate-600">Indicateurs possibles : {v.suggestedIndicators.slice(0, 5).join(" ; ")}</span> : <span className="block text-xs text-slate-500">Indicateurs : ce seront les questions de votre questionnaire qui la mesurent (étape Vérification).</span>}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {chain.issues.length ? (
          <Notice tone="warning" title="À compléter">
            <ul className="list-disc space-y-0.5 pl-5">
              {chain.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </Notice>
        ) : null}
        <button type="button" className={buttonClass.primary} onClick={onConfirm}>
          {confirmed ? continueLabel : "Valider cette chaîne et continuer"}
        </button>
      </div>
    </Section>
  );
}

/* ================================================================= */
/* 4 bis. Matrice de cohérence : ce que mesure chaque question          */
/* ================================================================= */

const encode = (side: QuestionSide, key: string | null) => (key ? `var:${key}` : side);

export function CoherenceMatrix({ chain, onAssign }: { chain: ResearchChain; onAssign: (unitId: string, side: QuestionSide, variableKey: string | null) => void }) {
  const groups: Array<{ title: string; items: ResearchChain["assignments"] }> = [
    ...chain.variables.map((v) => ({ title: `${v.side === "dependent" ? "Variable dépendante (VD)" : "Variable indépendante (VI)"} — ${v.name}`, items: chain.assignments.filter((a) => a.variableKey === v.key) })),
    { title: "Profil des répondants", items: chain.assignments.filter((a) => a.side === "profile") },
    { title: "Autres questions", items: chain.assignments.filter((a) => a.side === "other") },
  ];
  const decode = (value: string): { side: QuestionSide; key: string | null } => {
    if (value.startsWith("var:")) {
      const key = value.slice(4);
      return { side: chain.variables.find((v) => v.key === key)?.side ?? "other", key };
    }
    return { side: value as QuestionSide, key: null };
  };
  return (
    <Section title="4. Vérification : la matrice de cohérence" description="Chaque question de votre questionnaire est rattachée à ce qu'elle mesure : un indicateur de la VI, un indicateur de la VD, le profil des répondants, ou autre chose. Les questions de la VI seront croisées avec celles de la VD. Corrigez si besoin.">
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 text-sm font-bold text-slate-900">
              {group.title} <span className="font-normal text-slate-500">({group.items.length} question{group.items.length > 1 ? "s" : ""})</span>
            </h3>
            {group.items.length ? (
              <ul className="space-y-2">
                {group.items.map((a) => (
                  <li key={a.unitId} className="grid gap-2 rounded-xl p-3 ring-1 ring-slate-200 md:grid-cols-[1fr_16rem] md:items-start">
                    <div className="min-w-0 text-sm">
                      <p className="break-words font-medium text-slate-900">{cleanHeader(a.text)}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                        <Pill tone={a.origin === "user" ? "green" : a.confidence === "high" ? "blue" : a.confidence === "medium" ? "yellow" : "neutral"}>{a.origin === "user" ? "Choisi par vous" : a.confidence === "high" ? "Proposé (sûr)" : a.confidence === "medium" ? "Proposé (probable)" : "Proposé (à vérifier)"}</Pill>
                        <span className="min-w-0 break-words">{a.reason}</span>
                      </p>
                      {a.variableKey && a.indicator !== a.text && a.indicator !== "—" ? <p className="mt-0.5 text-xs text-slate-500">Indicateur reconnu : {a.indicator}</p> : null}
                    </div>
                    <select className={inputClass} value={encode(a.side, a.variableKey)} onChange={(e) => { const { side, key } = decode(e.target.value); onAssign(a.unitId, side, key); }} aria-label={`Ce que mesure : ${cleanHeader(a.text)}`}>
                      {chain.variables.map((v) => (
                        <option key={v.key} value={`var:${v.key}`}>
                          {v.side === "dependent" ? "VD" : "VI"} — {v.name}
                        </option>
                      ))}
                      <option value="profile">{QUESTION_SIDE_LABELS.profile}</option>
                      <option value="other">{QUESTION_SIDE_LABELS.other}</option>
                    </select>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{group.title.startsWith("Variable") ? "Aucune question ne la mesure encore : rattachez-en une ci-dessous, sinon elle ne pourra pas être vérifiée." : "Aucune."}</p>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
