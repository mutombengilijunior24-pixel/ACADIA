"use client";

import { ArrowDown, ArrowUp, BookOpen, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";

import { buttonClass, inputClass, Notice, Pill, Section, type Tone } from "@/components/data/ui";
import { ExportBar } from "@/components/export/ExportBar";
import {
  CRITERION_STATUS_LABELS,
  financeDocument,
  financeSheets,
  INDICATOR_BY_ID,
  MECHANISM_LABELS,
  type ChapterDecisions,
  type ChapterPlan,
  type Criterion,
  type CriteriaDecisions,
  type CriterionDecision,
  type CriterionStatus,
  type FinanceComputation,
  type FinanceDossier,
  type FinanceReasoning,
  defenseOf,
  type FinanceReportInput,
  type HypothesisResult,
  type LinkStructure,
} from "@/lib/core/finance";
import type { ChainVerdict } from "@/lib/core/chain";

import { CalculationDetail, ReflexCard } from "./DiagnosisView";

const KIND_LABELS: Record<Criterion["kind"], string> = { level: "Niveau", trend: "Tendance", comovement: "Évolution conjointe", mechanism: "Mécanisme comptable" };
const SCOPE_LABELS: Record<Criterion["scope"], string> = { dernier: "au dernier exercice", tous: "à chaque exercice", majorite: "à la majorité des exercices" };
const VERDICT_TONE: Record<ChainVerdict, Tone> = { supported: "green", partially_supported: "yellow", not_supported: "neutral", contrary: "red", inconclusive: "neutral", not_examined: "neutral" };
const STATUS_TONE: Record<CriterionStatus, Tone> = { respecte: "green", non_respecte: "yellow", contraire: "red", non_verifiable: "neutral" };

/** Étape « Critères de vérification » : chaque hypothèse traduite en critères explicites, modifiables. */
export function CriteriaStep({ links, criteria, decisions, exercises, confirmed, stale, onDecision, onConfirm }: { links: LinkStructure[]; criteria: Criterion[]; decisions: CriteriaDecisions; exercises: number; confirmed: boolean; stale: boolean; onDecision: (id: string, decision: CriterionDecision | null) => void; onConfirm: () => void }) {
  const enabled = criteria.filter((c) => c.enabled).length;
  return (
    <Section
      title="5. Le raisonnement d'ACADIA : les critères de vérification"
      description={`Avec ${exercises} exercice(s), un test statistique n'aurait pas de sens : ACADIA vérifie si vos indicateurs vont dans le sens de chaque hypothèse, selon des critères explicites. Vérifiez-les : vous pouvez en retirer, changer la portée ou le seuil.`}
      action={confirmed ? <Pill tone="green">Validés par vous</Pill> : stale ? <Pill tone="yellow">À revoir</Pill> : <Pill tone="neutral">Proposés</Pill>}
    >
      <div className="space-y-4">
        {links.map((link, i) => {
          const list = criteria.filter((c) => c.rowId === link.rowId);
          return (
            <article key={link.rowId} className="rounded-2xl border border-slate-200 p-4" aria-label={`Critères du lien ${i + 1}`}>
              <p className="text-sm">
                <span className="font-bold text-slate-900">Lien {i + 1}</span> — « {link.statement} »
              </p>
              {list.length ? (
                <ul className="mt-3 space-y-2">
                  {list.map((c) => (
                    <li key={c.id} className={`rounded-xl p-3 text-sm ring-1 ${c.enabled ? "bg-white ring-slate-200" : "bg-slate-50 opacity-70 ring-slate-100"}`}>
                      <label className="flex items-start gap-3">
                        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={c.enabled} onChange={(e) => onDecision(c.id, { ...decisions[c.id], enabled: e.target.checked })} />
                        <span className="min-w-0">
                          <Pill tone="blue">{KIND_LABELS[c.kind]}</Pill> <span className="text-slate-900">{c.label}</span>
                          {c.mechanism ? <span className="mt-1 block text-xs text-slate-600">{MECHANISM_LABELS[c.mechanism]}</span> : null}
                        </span>
                      </label>
                      {c.enabled && (c.kind === "level" || c.mechanism === "levier") ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 pl-7 text-xs text-slate-700">
                          <label className="flex items-center gap-1">
                            Portée
                            <select className={`${inputClass} min-h-8 w-auto py-0 text-xs`} value={c.scope} onChange={(e) => onDecision(c.id, { ...decisions[c.id], scope: e.target.value as Criterion["scope"] })}>
                              {(Object.keys(SCOPE_LABELS) as Criterion["scope"][]).map((s) => (
                                <option key={s} value={s}>
                                  {SCOPE_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          </label>
                          {c.kind === "level" ? (
                            <label className="flex items-center gap-1">
                              Seuil (vide = repère usuel)
                              <select className={`${inputClass} min-h-8 w-auto py-0 text-xs`} value={c.threshold?.op ?? ">="} onChange={(e) => onDecision(c.id, { ...decisions[c.id], threshold: { op: e.target.value as ">=" | "<=", value: c.threshold?.value ?? 0 } })} aria-label="Sens du seuil">
                                <option value=">=">au moins</option>
                                <option value="<=">au plus</option>
                              </select>
                              <input
                                type="number"
                                step="any"
                                className={`${inputClass} min-h-8 w-24 py-0 text-xs`}
                                value={c.threshold?.value ?? ""}
                                aria-label="Valeur du seuil"
                                onChange={(e) => onDecision(c.id, { ...decisions[c.id], threshold: e.target.value === "" ? null : { op: c.threshold?.op ?? ">=", value: Number(e.target.value) } })}
                              />
                              <span className="text-slate-500">{INDICATOR_BY_ID[c.indicators[0]]?.unit === "pct" ? "(proportion : 0,2 = 20 %)" : ""}</span>
                            </label>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-amber-900">Aucun critère : cet énoncé ne cite pas de notion financière mesurable. Reformulez-le à l&apos;étape « Mon sujet ».</p>
              )}
            </article>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass.primary} disabled={!enabled} onClick={onConfirm}>
            {confirmed ? "Voir le raisonnement d'ACADIA" : "Valider ces critères et lancer le raisonnement"}
          </button>
          {Object.keys(decisions).length ? (
            <button type="button" className={buttonClass.ghost} onClick={() => Object.keys(decisions).forEach((id) => onDecision(id, null))}>
              <RotateCcw size={14} aria-hidden /> Rétablir les critères proposés
            </button>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

/** Étape « Raisonnement d'ACADIA » : la confrontation hypothèse par hypothèse. */
export function ReasoningView({ reasoning, results, computation, dossier, seen, stale, onConfirm }: { reasoning: FinanceReasoning; results: HypothesisResult[]; computation: FinanceComputation; dossier: FinanceDossier; seen: boolean; stale: boolean; onConfirm: () => void }) {
  return (
    <div className="space-y-5">
      {stale ? <Notice tone="stale" title="Éléments modifiés depuis votre lecture">Le raisonnement a été recalculé : relisez-le, puis confirmez à nouveau.</Notice> : null}
      <Section title="5. Le raisonnement d'ACADIA" description="Chaque hypothèse confrontée aux chiffres de l'entreprise : ce qui l'en rapproche, ce qui l'en éloigne, le mécanisme comptable et une conclusion prudente. Règles explicites, sans IA.">
        {reasoning.mainAnswer ? (
          <div className="mb-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-950" role="status" aria-label="Réponse à la question principale">
            <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">Réponse à votre question</p>
            <p className="mt-1">{reasoning.mainAnswer}</p>
          </div>
        ) : null}
        <div className="space-y-4">
          {reasoning.readings.map((r) => {
            const result = results.find((x) => x.link.rowId === r.rowId);
            return (
              <article key={r.rowId} className="rounded-2xl border border-slate-200 p-4" aria-label={r.title}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-900">
                    {r.title} : « {r.statement} »
                  </h3>
                  <Pill tone={VERDICT_TONE[r.verdict]}>{r.verdictLabel}</Pill>
                </div>
                {r.approaches.length ? (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-emerald-800">Ce qui rapproche les chiffres de l&apos;hypothèse</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
                      {r.approaches.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {r.distances.length ? (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-rose-800">Ce qui l&apos;en éloigne</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
                      {r.distances.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {r.unverifiable.length ? (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-slate-700">Non vérifiable avec ces états</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {r.unverifiable.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {r.mechanism ? (
                  <p className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950">
                    <span className="font-semibold">Mécanisme comptable : </span>
                    {r.mechanism}
                  </p>
                ) : null}
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-900">{r.conclusion}</p>
                {result?.results.length ? (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-slate-600">Détail des critères et des calculs</summary>
                    <ul className="mt-2 space-y-1">
                      {result.results.map((x) => (
                        <li key={x.criterion.id} className="flex flex-wrap gap-2">
                          <Pill tone={STATUS_TONE[x.status]}>{CRITERION_STATUS_LABELS[x.status]}</Pill>
                          <span className="min-w-0 flex-1 text-slate-700">{x.criterion.label}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      {[...new Set([...result.results.flatMap((x) => x.criterion.indicators), ...(result.results.some((x) => x.criterion.mechanism === "levier") ? ["effet_levier"] : []), ...(result.results.some((x) => x.criterion.mechanism === "bfr_tresorerie") ? ["fr", "bf"] : [])])].map((id) => (
                        <CalculationDetail key={id} id={id} computation={computation} dossier={dossier} />
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      </Section>
      {reasoning.companyState.length ? (
        <Section title="L'état de l'entreprise au regard de votre sujet" description="Les dimensions du diagnostic qui concernent directement votre sujet.">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-800">
            {reasoning.companyState.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {reasoning.reflexes.length ? (
        <Section title="Les réflexes du financier pour votre sujet" description="À vérifier dans les documents de l'entreprise avant de rédiger : ils peuvent nuancer vos conclusions.">
          <ul className="space-y-2">
            {reasoning.reflexes.map((r) => (
              <ReflexCard key={r.id} reflex={r} />
            ))}
          </ul>
        </Section>
      ) : null}
      <Section title="Angles d'interprétation" description="Pistes de la littérature et du contexte pour discuter vos résultats : à vérifier dans votre revue de littérature (citez les auteurs d'après leurs publications).">
        <ul className="space-y-2">
          {reasoning.angles.map((a) => (
            <li key={a.title} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm">
              <BookOpen size={18} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden />
              <span>
                <span className="font-semibold text-slate-900">{a.title}. </span>
                <span className="text-slate-700">{a.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-900">Limites</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {reasoning.limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </Section>
      <button type="button" className={buttonClass.primary} onClick={onConfirm}>
        <CheckCircle2 size={18} aria-hidden /> {seen ? "Continuer : mon chapitre de résultats" : "J'ai lu le raisonnement — continuer : mon chapitre"}
      </button>
    </div>
  );
}

/** Étape « Mon chapitre de résultats » : plan proposé (modifiable) et rapport Word / Excel. */
export function ChapterView({ chapter, decisions, onDecisions, report, done, stale, onDone, fileBase }: { chapter: ChapterPlan; decisions: ChapterDecisions; onDecisions: (next: ChapterDecisions) => void; report: FinanceReportInput; done: boolean; stale: boolean; onDone: () => void; fileBase: string }) {
  const ids = chapter.sections.map((s) => s.id);
  const defense = defenseOf(report);
  const move = (index: number, delta: number) => {
    const next = [...ids];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onDecisions({ ...decisions, order: next });
  };
  return (
    <div className="space-y-5">
      {stale ? <Notice tone="stale" title="Résultats modifiés depuis votre plan">Le plan et le rapport ont été mis à jour : vérifiez-les, puis retenez à nouveau le plan.</Notice> : null}
      <Section
        title="6. Mon chapitre de résultats"
        description="Un plan de chapitre construit à partir de votre recherche et des résultats : pour chaque section, son but, les tableaux et figures à présenter et une proposition de rédaction chiffrée, à reformuler avec vos mots."
        action={done ? <Pill tone="green">Plan retenu</Pill> : <Pill tone="neutral">Proposé</Pill>}
      >
        <p className="mb-3 font-semibold text-slate-900">Chapitre : {chapter.title}</p>
        <ol className="space-y-2">
          {chapter.sections.map((s, i) => (
            <li key={s.id} className="rounded-xl ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center gap-2 p-3">
                <span className="min-w-0 flex-1 font-semibold text-slate-900">
                  Section {i + 1}. {s.title}
                </span>
                <button type="button" className={buttonClass.ghost} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Monter : ${s.title}`}>
                  <ArrowUp size={16} aria-hidden />
                </button>
                <button type="button" className={buttonClass.ghost} disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label={`Descendre : ${s.title}`}>
                  <ArrowDown size={16} aria-hidden />
                </button>
                <button type="button" className={buttonClass.ghost} onClick={() => onDecisions({ ...decisions, removed: [...(decisions.removed ?? []), s.id] })} aria-label={`Retirer : ${s.title}`}>
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
              <details className="border-t border-slate-100 px-3 pb-3 text-sm">
                <summary className="cursor-pointer py-2 text-slate-600">{s.purpose}</summary>
                {s.contents.length ? (
                  <>
                    <p className="font-semibold text-slate-800">À présenter</p>
                    <ul className="list-disc pl-5 text-slate-700">
                      {s.contents.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {s.draft.length ? (
                  <>
                    <p className="mt-2 font-semibold text-slate-800">Proposition de rédaction (à reformuler)</p>
                    <ul className="list-disc space-y-1 pl-5 text-slate-700">
                      {s.draft.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </details>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={buttonClass.primary} onClick={onDone}>
            <CheckCircle2 size={18} aria-hidden /> {done ? "Plan retenu" : "Retenir ce plan"}
          </button>
          {decisions.order || decisions.removed?.length ? (
            <button type="button" className={buttonClass.ghost} onClick={() => onDecisions({})}>
              <RotateCcw size={14} aria-hidden /> Rétablir le plan proposé
            </button>
          ) : null}
        </div>
      </Section>
      <Section title="Préparer ma soutenance" description="Pour comprendre votre travail et le défendre à voix haute, même sans formation comptable : l'essentiel à dire, les questions probables du jury avec des réponses appuyées sur vos chiffres, et un lexique en mots simples. Ces éléments figurent aussi dans le rapport Word.">
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4" aria-label="L'essentiel à dire à l'oral">
            <p className="text-sm font-bold text-emerald-950">L&apos;essentiel à dire à l&apos;oral</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-800">
              {defense.pitch.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Les questions probables du jury</p>
            <ul className="mt-2 space-y-2">
              {defense.questions.map((q) => (
                <li key={q.question}>
                  <details className="rounded-xl ring-1 ring-slate-200">
                    <summary className="cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">{q.question}</summary>
                    <p className="px-3 pb-3 text-sm leading-relaxed text-slate-700">{q.answer}</p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
          <details className="rounded-xl bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-900">Lexique : les mots de l&apos;analyse financière, en clair ({defense.glossary.length})</summary>
            <dl className="mt-2 space-y-2">
              {defense.glossary.map((g) => (
                <div key={g.term}>
                  <dt className="font-semibold text-slate-900">{g.term}</dt>
                  <dd className="text-slate-700">{g.plain}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </Section>
      <ExportBar title="Télécharger mon rapport" fileBase={fileBase} sheets={() => financeSheets(report)} document={(palette) => financeDocument(report, palette)} />
    </div>
  );
}
