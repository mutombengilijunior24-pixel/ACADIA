"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { buttonClass, inputClass, Notice, Pill, Section } from "@/components/data/ui";
import { METHOD_LABELS, type MethodId } from "@/lib/core/analysis/inferential";
import { statisticalTypeLabel } from "@/lib/core/data/preparation";
import type { StatisticalType, VariableMetadata } from "@/lib/core/data/types";
import {
  ALIGNMENT_LABELS,
  defaultTwoByTwo,
  itemStatus,
  methodOf,
  OBJECTIVE_LABELS,
  possibleAnalyses,
  TIER_LABELS,
  orderedItems,
  type AnalysisPlan,
  type Cartography,
  type CrossPreview,
  type TwoByTwoChoice,
  type FileStructure,
  type InstrumentQuestion,
  type ObjectiveCoverage,
  type PlanDecisions,
  type UnitRole,
} from "@/lib/core/journey";

const ANALYSIS_TYPES: StatisticalType[] = ["nominal", "ordinal", "quantitative_discrete", "quantitative_continuous"];
const ROLE_TEXT: Record<UnitRole, { label: string; tone: "blue" | "neutral" | "yellow" | "green" }> = {
  key: { label: "Variable clé", tone: "blue" },
  context: { label: "Contexte", tone: "green" },
  other: { label: "Hors champ", tone: "neutral" },
  technical: { label: "Technique", tone: "yellow" },
};

/* ================================================================= */
/* 5. Variables et questions                                           */
/* ================================================================= */

export function VariablesStep({
  cartography,
  variables,
  structure,
  questions,
  mappingState,
  onAssign,
  onUnitRole,
  onConfirm,
}: {
  cartography: Cartography;
  variables: VariableMetadata[];
  structure: FileStructure;
  questions: InstrumentQuestion[];
  mappingState: "none" | "confirmed" | "stale";
  onAssign: (conceptKey: string, unitId: string | null) => void;
  onUnitRole: (unitId: string, role: UnitRole) => void;
  onConfirm: (types: Record<number, StatisticalType>) => void;
}) {
  const [types, setTypes] = useState<Record<number, StatisticalType>>({});
  const [attempted, setAttempted] = useState(false);
  const analyzable = structure.units.filter((u) => u.kind !== "technical");
  const metaOf = (column: number | null) => (column === null ? undefined : variables.find((v) => v.column === column));
  const typeFor = (column: number) => types[column] ?? (ANALYSIS_TYPES.includes(metaOf(column)?.effectiveType as StatisticalType) ? metaOf(column)!.effectiveType : undefined);
  const keyColumns = cartography.concepts.map((c) => structure.units.find((u) => u.id === c.unitId)?.primaryColumn).filter((c): c is number => c !== null && c !== undefined);
  const missingType = keyColumns.filter((c) => !typeFor(c));

  return (
    <div className="space-y-5">
      <Section title="4. Vérification : vos concepts dans les données" description="Concept → question → colonne → type de donnée. ACADIA propose les rapprochements ; vous les confirmez ou les corrigez avant tout calcul.">
        {mappingState === "stale" ? (
          <div className="mb-3">
            <Notice tone="warning" title="À revoir">
              Les rapprochements ont changé depuis votre confirmation : confirmez-les à nouveau.
            </Notice>
          </div>
        ) : null}
        {cartography.clarification ? (
          <p className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
            <span className="font-semibold">Question prioritaire : </span>
            {cartography.clarification}
          </p>
        ) : null}
        <div className="space-y-3">
          {cartography.concepts.map((concept) => {
            const unit = structure.units.find((u) => u.id === concept.unitId);
            const column = unit?.primaryColumn ?? null;
            const question = cartography.units.find((u) => u.unit.id === concept.unitId)?.question;
            return (
              <article key={concept.conceptKey} className="rounded-2xl border border-slate-200 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900">{concept.name}</h3>
                    <p className="text-slate-600">{concept.roleLabel}</p>
                  </div>
                  <Pill tone={concept.status === "confirmed" ? "green" : concept.status === "missing" ? "red" : "yellow"}>
                    {concept.status === "confirmed" ? "Confirmé" : concept.status === "missing" ? "Aucune question trouvée" : `Proposé (confiance ${concept.confidence === "high" ? "élevée" : concept.confidence === "medium" ? "moyenne" : "faible"})`}
                  </Pill>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block font-medium text-slate-700">Question du fichier qui mesure ce concept</span>
                  <select className={inputClass} value={concept.unitId ?? ""} onChange={(e) => onAssign(concept.conceptKey, e.target.value || null)} aria-label={`Question pour ${concept.name}`}>
                    <option value="">— Aucune question ne mesure ce concept —</option>
                    {concept.candidates.length ? (
                      <optgroup label="Propositions d'ACADIA">
                        {concept.candidates.map((c) => (
                          <option key={c.unitId} value={c.unitId}>
                            {Math.round(c.score * 100)} % — {structure.units.find((u) => u.id === c.unitId)?.text.slice(0, 110)}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    <optgroup label="Toutes les questions">
                      {analyzable.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.text.slice(0, 120)}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                {concept.ambiguity ? <p className="mt-2 text-amber-800">{concept.ambiguity}</p> : null}
                {unit ? (
                  <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-slate-700">
                    {concept.candidates.find((c) => c.unitId === unit.id)?.reason ? <p className="text-xs text-slate-500">{concept.candidates.find((c) => c.unitId === unit.id)?.reason}</p> : null}
                    {question ? <p>Question de l&apos;instrument : « {question.text} »</p> : null}
                    <p>
                      Colonne(s) : {unit.columns.map((c) => structure.columns.find((x) => x.column === c)?.label).slice(0, 3).join(" ; ")}
                      {unit.columns.length > 3 ? ` (+ ${unit.columns.length - 3} colonne(s) vrai/faux de modalités, mises de côté)` : unit.kind === "single_with_options" ? " (+ colonnes vrai/faux de modalités, mises de côté)" : ""}
                    </p>
                    {unit.options.length ? <p>Modalités : {unit.options.slice(0, 8).join(" / ")}</p> : null}
                    <p className="text-xs text-slate-500">Analyses possibles : {possibleAnalyses(column !== null ? typeFor(column) : undefined, unit.kind).join(" ; ")}.</p>
                    {column !== null ? (
                      <label className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="font-medium">Type de donnée :</span>
                        <select className={`${inputClass} w-auto`} value={typeFor(column) ?? ""} onChange={(e) => setTypes((t) => ({ ...t, [column]: e.target.value as StatisticalType }))} aria-label={`Type de ${concept.name}`} aria-invalid={attempted && !typeFor(column)}>
                          <option value="">À choisir…</option>
                          {ANALYSIS_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {statisticalTypeLabel(t)}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-slate-500">détecté : {statisticalTypeLabel(metaOf(column)?.detected.statisticalType ?? "unclassified")}</span>
                      </label>
                    ) : (
                      <p className="text-amber-800">Question à choix multiples : elle pourra être décrite option par option, mais pas utilisée telle quelle dans un test.</p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </Section>

      <Section title="Les autres questions du fichier" description="Questions de contexte (profil des répondants), questions hors du champ de la question de recherche et colonnes techniques.">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Voir les {structure.units.length} questions et leur rôle</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {cartography.units.map((u) => (
              <li key={u.unit.id} className="flex flex-wrap items-start gap-2 rounded-xl bg-slate-50 p-2">
                <Pill tone={ROLE_TEXT[u.role].tone}>{ROLE_TEXT[u.role].label}</Pill>
                <span className="min-w-0 flex-1 break-words">
                  <span className="text-slate-900">{u.unit.text}</span> <span className="text-xs text-slate-500">({u.typeLabel}{u.unit.kind === "single_with_options" ? `, ${u.unit.columns.length - 1} colonnes vrai/faux` : u.unit.kind === "multi_choice" ? ", choix multiples" : ""})</span>
                  <span className="block text-xs text-slate-500">{u.reason}</span>
                </span>
                {u.role === "context" || u.role === "other" ? (
                  <button type="button" className={buttonClass.ghost} onClick={() => onUnitRole(u.unit.id, u.role === "context" ? "other" : "context")}>
                    {u.role === "context" ? "Ne pas décrire" : "Décrire comme contexte"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
        {questions.length ? <p className="mt-3 text-xs text-slate-500">{questions.length} question(s) de votre instrument ont été rapprochées des colonnes.</p> : null}
      </Section>

      {attempted && missingType.length ? (
        <Notice tone="error" title="Il manque le type de donnée">
          Choisissez le type de donnée de : {cartography.concepts.filter((c) => missingType.includes(structure.units.find((u) => u.id === c.unitId)?.primaryColumn ?? -1)).map((c) => `« ${c.name} »`).join(", ")} (liste « Type de donnée » sous chaque concept).
        </Notice>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={buttonClass.primary}
          onClick={() => {
            if (missingType.length) {
              setAttempted(true);
              return;
            }
            onConfirm(Object.fromEntries(keyColumns.map((c) => [c, typeFor(c)!])));
          }}
        >
          Confirmer ces rapprochements et ces types
        </button>
        <span className="text-sm text-slate-500">{missingType.length ? "Chaque variable clé doit avoir un type de donnée." : "Les types affichés des questions de contexte seront aussi confirmés."}</span>
      </div>
    </div>
  );
}

/* ================================================================= */
/* 6. Plan d'analyse                                                   */
/* ================================================================= */

export function PlanStep({
  plan,
  decisions,
  onDecisions,
  alpha,
  onAlpha,
  independence,
  onIndependence,
  planState,
  onValidate,
  objectives,
}: {
  objectives: ObjectiveCoverage[];
  plan: AnalysisPlan;
  decisions: PlanDecisions;
  onDecisions: (d: PlanDecisions) => void;
  alpha: number;
  onAlpha: (a: number) => void;
  independence: boolean;
  onIndependence: (v: boolean) => void;
  planState: "none" | "validated" | "stale";
  onValidate: () => void;
}) {
  const [attempted, setAttempted] = useState(false);
  const items = orderedItems(plan, decisions);
  const accepted = items.filter((i) => itemStatus(i, decisions) === "accepted" && i.feasible);
  const needsIndependence = accepted.some((i) => {
    const m = methodOf(i, decisions);
    return i.level === "relation" && m !== "pearson" && m !== "spearman" && i.needsIndependence;
  });
  const move = (id: string, delta: number) => {
    const order = items.map((i) => i.id);
    const index = order.indexOf(id);
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    onDecisions({ ...decisions, order });
  };
  const unconfirmedMismatch = accepted.filter((i) => i.alignment.status === "blocking" && !decisions.mismatchConfirmed?.[i.id]);
  const blocked = !accepted.length
    ? "Retenez au moins une analyse réalisable."
    : unconfirmedMismatch.length
      ? `${unconfirmedMismatch.length} analyse(s) ne correspondent pas à la question : corrigez les variables ou confirmez explicitement ce choix.`
      : needsIndependence && !independence
        ? "Confirmez l'indépendance des observations (ci-dessous)."
        : null;

  return (
    <div className="space-y-5">
      <Section title="5. Plan d'analyse proposé" description="Construit à partir de votre question, de vos hypothèses et des variables confirmées. Acceptez, écartez, modifiez ou réordonnez les analyses : aucun calcul n'est lancé avant votre validation.">
        {planState === "stale" ? <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Le plan a changé depuis votre validation : validez-le à nouveau.</p> : null}
        {items.some((i) => i.chain?.unitId) ? (
          <details className="mb-3 rounded-2xl border border-slate-200 p-4 text-sm" open>
            <summary className="cursor-pointer font-bold text-slate-900">
              Niveau 1 — Description de toutes les questions ({items.filter((i) => i.chain?.unitId).length}) : un tableau et un graphique pour chacune
            </summary>
            <ul className="mt-3 divide-y divide-slate-100">
              {items
                .filter((i) => i.chain?.unitId)
                .map((item) => {
                  const status = itemStatus(item, decisions);
                  return (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="min-w-0 flex-1">
                        <span className={`font-medium ${status === "accepted" ? "text-slate-900" : "text-slate-400 line-through"}`}>{item.title}</span>
                        <span className="block text-xs text-slate-500">{item.feasible ? (item.variables[0]?.role ?? "") : item.blocker}</span>
                      </span>
                      {item.feasible ? (
                        <button type="button" className={buttonClass.ghost} onClick={() => onDecisions({ ...decisions, status: { ...decisions.status, [item.id]: status === "accepted" ? "rejected" : "accepted" } })} aria-label={`${status === "accepted" ? "Ne pas décrire" : "Décrire"} : ${item.title}`}>
                          {status === "accepted" ? "Ne pas décrire" : "Décrire"}
                        </button>
                      ) : (
                        <Pill tone="neutral">Non décrite</Pill>
                      )}
                    </li>
                  );
                })}
            </ul>
          </details>
        ) : null}
        {items.some((i) => i.chain?.unitId) && items.some((i) => i.level === "relation") ? <h3 className="mb-2 mt-4 font-bold text-slate-900">Niveau 2 — Croisements des questions de la VI avec celles de la VD</h3> : null}
        <ol className="space-y-3">
          {items.filter((i) => !i.chain?.unitId).map((item, index) => {
            const status = itemStatus(item, decisions);
            const method = methodOf(item, decisions);
            return (
              <li key={item.id} className={`rounded-2xl border p-4 text-sm ${status === "accepted" ? "border-slate-200" : "border-dashed border-slate-300 bg-slate-50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {index + 1}. {item.title}
                      </span>
                      <Pill tone={item.level === "relation" ? "blue" : "neutral"}>{item.level === "relation" ? "Relation / test" : "Descriptif"}</Pill>
                      <Pill tone={item.tier === "main" ? "green" : item.tier === "descriptive" ? "blue" : "neutral"}>{TIER_LABELS[item.tier]}</Pill>
                    </p>
                    <p className="mt-1 text-slate-600">Répond à : « {item.researchQuestion} »</p>
                  </div>
                  <div className="flex gap-1">
                    {index > 0 ? (
                      <button type="button" className={buttonClass.ghost} onClick={() => move(item.id, -1)} aria-label={`Monter ${item.title}`}>
                        <ArrowUp size={16} aria-hidden />
                      </button>
                    ) : null}
                    {index < items.length - 1 ? (
                      <button type="button" className={buttonClass.ghost} onClick={() => move(item.id, 1)} aria-label={`Descendre ${item.title}`}>
                        <ArrowDown size={16} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </div>
                {item.variables.length ? (
                  <ul className="mt-2 space-y-0.5 text-slate-700">
                    {item.variables.map((v) => (
                      <li key={v.column}>
                        <span className="font-medium">{v.name}</span> <span className="text-slate-500">({v.role}, {v.typeLabel})</span>
                        {v.name !== v.header ? <span className="block text-xs text-slate-500">colonne : {v.header}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-2 text-slate-700">{item.why}</p>
                {item.methodOptions && item.methodOptions.length > 1 ? (
                  <label className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-700">Méthode :</span>
                    <select className={`${inputClass} w-auto`} value={method} onChange={(e) => onDecisions({ ...decisions, method: { ...decisions.method, [item.id]: e.target.value as MethodId } })}>
                      {item.methodOptions.map((o) => (
                        <option key={o.method} value={o.method}>
                          {METHOD_LABELS[o.method]}
                          {o.recommended ? " (recommandée)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {item.feasible ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-slate-600">Conditions, limites et résultat attendu</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
                      {item.conditions.map((c) => (
                        <li key={c} className={c.startsWith("Contrôle préalable") ? "font-medium text-amber-800" : undefined}>
                          {c}
                        </li>
                      ))}
                    </ul>
                    {item.limits.length ? <p className="mt-1 text-slate-600">Limites : {item.limits.join(" ")}</p> : null}
                    <p className="mt-1 text-slate-600">Résultat attendu : {item.expected}</p>
                    {item.hypotheses.length ? <p className="mt-1 text-slate-600">Hypothèse examinée : {item.hypotheses.join(" ; ")}</p> : null}
                  </details>
                ) : (
                  <p className="mt-2 rounded-xl bg-red-50 p-2 text-red-800">Analyse non réalisable : {item.blocker}</p>
                )}
                {item.alignment.signals.length ? (
                  <div
                    className={`mt-2 rounded-xl border p-3 ${item.alignment.status === "blocking" ? "border-rose-200 bg-rose-50 text-rose-900" : item.alignment.status === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                    role={item.alignment.status === "blocking" ? "alert" : undefined}
                  >
                    <p className="font-semibold">Adéquation question ↔ variables : {ALIGNMENT_LABELS[item.alignment.status]}</p>
                    <ul className="mt-1 space-y-0.5">
                      {item.alignment.signals.map((signal) => (
                        <li key={signal.code + signal.message}>
                          <span className="font-medium">{ALIGNMENT_LABELS[signal.level]} — </span>
                          {signal.message}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs opacity-80">Diagnostic fondé sur des indices (intitulés, modalités, rôle des questions, cadre de recherche) ; il ne remplace pas votre lecture et reste corrigeable à l&apos;étape « Variables et questions ».</p>
                    {item.alignment.status === "blocking" ? (
                      <label className="mt-2 flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-5 w-5 shrink-0"
                          checked={!!decisions.mismatchConfirmed?.[item.id]}
                          onChange={(e) => onDecisions({ ...decisions, mismatchConfirmed: { ...decisions.mismatchConfirmed, [item.id]: e.target.checked } })}
                        />
                        <span>Je confirme vouloir analyser ces colonnes malgré ce décalage (sinon, revenez à l&apos;étape « Variables et questions »).</span>
                      </label>
                    ) : null}
                  </div>
                ) : null}
                {item.feasible && item.preview && method === "chi_square" ? (
                  <CrossPreviewPanel
                    preview={item.preview}
                    choice={decisions.categories?.[item.id]}
                    onChoice={(choice) => onDecisions({ ...decisions, categories: { ...decisions.categories, [item.id]: choice } })}
                  />
                ) : null}
                {item.feasible && item.conditions.some((c) => c.startsWith("Contrôle préalable")) ? <p className="mt-2 text-amber-800">{item.conditions.find((c) => c.startsWith("Contrôle préalable"))}</p> : null}
                {item.feasible ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={status === "accepted" ? buttonClass.ghost : buttonClass.secondary} onClick={() => onDecisions({ ...decisions, status: { ...decisions.status, [item.id]: status === "accepted" ? "rejected" : "accepted" } })}>
                      {status === "accepted" ? "Écarter cette analyse" : "Retenir cette analyse"}
                    </button>
                    <span className="self-center text-xs text-slate-500">{status === "accepted" ? "Retenue" : "Écartée"}</span>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title="Ce que le plan permettra de conclure">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {plan.final.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {plan.missingForConclusion.length ? (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Informations qui limiteront les conclusions</p>
            <ul className="list-disc pl-5">
              {plan.missingForConclusion.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-slate-600">Méthodes non disponibles dans ACADIA à ce jour</summary>
          <ul className="mt-1 list-disc pl-5 text-slate-600">
            {plan.unavailable.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      </Section>

      {objectives.length ? (
        <Section title="Vos objectifs couverts par ce plan" description="Vérifiez que chaque objectif de votre recherche est traité par au moins une analyse retenue.">
          <ul className="space-y-2 text-sm">
            {objectives.map((o) => (
              <li key={o.text} className="rounded-xl p-3 ring-1 ring-slate-200">
                <p className="flex flex-wrap items-center gap-2">
                  <Pill tone={o.status === "tested" ? "green" : o.status === "described" ? "blue" : o.status === "partial" ? "yellow" : "red"}>{o.status === "tested" ? "Sera examiné par un test" : o.status === "described" ? "Sera décrit" : OBJECTIVE_LABELS[o.status]}</Pill>
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

      <Section title="Validation">
        <div className="space-y-3 text-sm">
          <label className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-700">Seuil de signification α :</span>
            <select className={`${inputClass} w-auto`} value={alpha} onChange={(e) => onAlpha(Number(e.target.value))}>
              <option value={0.05}>0,05 (usuel)</option>
              <option value={0.01}>0,01</option>
              <option value={0.1}>0,10 (exploratoire)</option>
            </select>
          </label>
          {needsIndependence ? (
            <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={independence} onChange={(e) => onIndependence(e.target.checked)} />
              <span>Je confirme que chaque ligne correspond à un répondant différent, interrogé une seule fois (pas de mesures répétées sur les mêmes personnes).</span>
            </label>
          ) : null}
          {attempted && blocked ? (
            <Notice tone="error" title="Le plan ne peut pas encore être validé">
              {blocked}
            </Notice>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={buttonClass.primary}
              onClick={() => {
                if (blocked) {
                  setAttempted(true);
                  return;
                }
                onValidate();
              }}
            >
              Valider mon plan d&apos;analyse et commencer les calculs
            </button>
            {blocked ? <span className="text-slate-600">{blocked}</span> : null}
          </div>
        </div>
      </Section>
    </div>
  );
}

/** Aperçu du tableau croisé avant calcul et, pour un 2 × 2, choix explicite des catégories de référence. */
function CrossPreviewPanel({ preview, choice, onChoice }: { preview: CrossPreview; choice: TwoByTwoChoice | undefined; onChoice: (choice: TwoByTwoChoice) => void }) {
  const twoByTwo = preview.rowLabels.length === 2 && preview.colLabels.length === 2;
  const current = choice ?? (twoByTwo ? defaultTwoByTwo(preview) : null);
  const rows = current ? [current.rowReference, ...preview.rowLabels.filter((r) => r !== current.rowReference)] : preview.rowLabels;
  const cols = current ? [current.outcomeEvent, ...preview.colLabels.filter((c) => c !== current.outcomeEvent)] : preview.colLabels;
  const count = (r: string, c: string) => preview.counts[preview.rowLabels.indexOf(r)]?.[preview.colLabels.indexOf(c)] ?? 0;
  const comparison = current ? rows[1] : null;
  return (
    <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3" data-testid="cross-preview">
      <p className="font-semibold text-slate-900">Aperçu du tableau avant calcul</p>
      <p className="text-xs text-slate-600">
        Lignes : « {preview.rowVariable} » · Colonnes : « {preview.colVariable} » · {preview.n} observation(s) complètes. Pourcentages en ligne : dénominateur = total de chaque ligne.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left font-medium text-slate-600">{preview.rowVariable}</th>
              {cols.map((c) => (
                <th key={c} className="px-2 py-1 text-right font-medium text-slate-600">
                  {c}
                </th>
              ))}
              <th className="px-2 py-1 text-right font-medium text-slate-600">Total (dénominateur)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const total = cols.reduce((sum, c) => sum + count(r, c), 0);
              return (
                <tr key={r} className="border-t border-slate-200">
                  <td className="px-2 py-1 font-medium text-slate-800">
                    {r}
                    {current && r === current.rowReference ? <span className="ml-1 text-xs text-indigo-700"> (référence)</span> : null}
                  </td>
                  {cols.map((c) => (
                    <td key={c} className="px-2 py-1 text-right tabular-nums">
                      {count(r, c)} <span className="text-xs text-slate-500">({total ? ((100 * count(r, c)) / total).toFixed(1).replace(".", ",") : "—"} %)</span>
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right tabular-nums">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {twoByTwo && current ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-600">
            {choice ? "Catégories choisies par vous." : "Choix par défaut (ordre alphabétique) — à confirmer ou modifier."} Ces choix changent le sens du risque relatif, du rapport de cotes et de la différence de proportions, pas le Khi-deux ni sa valeur p.
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
              Catégorie de référence (« {preview.rowVariable} »)
              <select className={`${inputClass} w-auto`} value={current.rowReference} onChange={(e) => onChoice({ ...current, rowReference: e.target.value })} aria-label="Catégorie de référence">
                {preview.rowLabels.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
              Issue étudiée (« {preview.colVariable} »)
              <select className={`${inputClass} w-auto`} value={current.outcomeEvent} onChange={(e) => onChoice({ ...current, outcomeEvent: e.target.value })} aria-label="Issue étudiée">
                {preview.colLabels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
              Sens de la comparaison
              <select className={`${inputClass} w-auto`} value={current.direction} onChange={(e) => onChoice({ ...current, direction: e.target.value as TwoByTwoChoice["direction"] })} aria-label="Sens de la comparaison">
                <option value="comparison_vs_reference">« {comparison} » comparé à « {current.rowReference} »</option>
                <option value="reference_vs_comparison">« {current.rowReference} » comparé à « {comparison} »</option>
              </select>
            </label>
          </div>
          {!choice ? (
            <button type="button" className={buttonClass.secondary} onClick={() => onChoice(current)}>
              Confirmer ces catégories
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
