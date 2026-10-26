"use client";

import { useState } from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";

import { buttonClass, inputClass, Notice, Pill, Section } from "@/components/data/ui";
import {
  CURRENCY_LABELS,
  exerciseMonths,
  FINANCE_PROVENANCE_LABELS,
  MAX_EXERCISES,
  newExercise,
  SECTOR_LABELS,
  sortedExercises,
  UNIT_LABELS,
  type AmountUnit,
  type CheckResult,
  type Currency,
  type ExerciseValues,
  type FinanceDossier,
  type FinanceProvenanceKind,
  type SectionId,
  type Sector,
} from "@/lib/core/finance";

import { StatementsGrid } from "./StatementsGrid";

export interface Provenance {
  kind: FinanceProvenanceKind;
  description: string;
}

/** Paramètres de l'entreprise et des exercices. */
function CompanyParams({ dossier, onDossier }: { dossier: FinanceDossier; onDossier: (next: FinanceDossier) => void }) {
  const { company } = dossier;
  const setCompany = (patch: Partial<FinanceDossier["company"]>) => onDossier({ ...dossier, company: { ...company, ...patch } });
  const exercises = sortedExercises(dossier.exercises);
  const setExercise = (id: string, patch: Partial<FinanceDossier["exercises"][number]>) => onDossier({ ...dossier, exercises: dossier.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const addExercise = () => {
    const last = exercises.at(-1);
    const year = last ? Number(last.end.slice(0, 4)) + 1 : new Date().getFullYear() - 1;
    let id = `ex-${year}`;
    while (dossier.exercises.some((e) => e.id === id)) id = `${id}-b`;
    onDossier({ ...dossier, exercises: [...dossier.exercises, newExercise(year, id)] });
  };
  const removeExercise = (id: string) => {
    const values = { ...dossier.values };
    const origins = { ...dossier.origins };
    delete values[id];
    delete origins[id];
    onDossier({ ...dossier, exercises: dossier.exercises.filter((e) => e.id !== id), values, origins });
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm font-medium text-slate-800">
          Entreprise étudiée
          <input className={`${inputClass} mt-1`} value={company.name} maxLength={200} placeholder="Raison sociale" onChange={(e) => setCompany({ name: e.target.value })} />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Secteur d&apos;activité
          <select className={`${inputClass} mt-1`} value={company.sector} onChange={(e) => setCompany({ sector: e.target.value as Sector })}>
            {(Object.keys(SECTOR_LABELS) as Sector[]).map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Ville
          <input className={`${inputClass} mt-1`} value={company.city} maxLength={120} placeholder="Facultatif" onChange={(e) => setCompany({ city: e.target.value })} />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Monnaie des états
          <select className={`${inputClass} mt-1`} value={company.currency} onChange={(e) => setCompany({ currency: e.target.value as Currency })}>
            {(Object.keys(CURRENCY_LABELS) as Currency[]).map((c) => (
              <option key={c} value={c}>
                {CURRENCY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        {company.currency === "AUTRE" ? (
          <label className="block text-sm font-medium text-slate-800">
            Quelle monnaie ?
            <input className={`${inputClass} mt-1`} value={company.currencyOther} maxLength={40} onChange={(e) => setCompany({ currencyOther: e.target.value })} />
          </label>
        ) : null}
        <label className="block text-sm font-medium text-slate-800">
          Unité des montants
          <select className={`${inputClass} mt-1`} value={company.unit} onChange={(e) => setCompany({ unit: Number(e.target.value) as AmountUnit })}>
            {([1, 1000, 1_000_000] as AmountUnit[]).map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">Exercices analysés</legend>
        <ul className="space-y-2">
          {exercises.map((e) => {
            const hasValues = Object.keys(dossier.values[e.id] ?? {}).length > 0;
            return (
              <li key={e.id} className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-2">
                <label className="text-xs font-medium text-slate-700">
                  Libellé
                  <input className={`${inputClass} mt-1 w-28`} value={e.label} maxLength={40} onChange={(ev) => setExercise(e.id, { label: ev.target.value })} />
                </label>
                <label className="text-xs font-medium text-slate-700">
                  Du
                  <input type="date" className={`${inputClass} mt-1 w-40`} value={e.start} onChange={(ev) => ev.target.value && setExercise(e.id, { start: ev.target.value })} />
                </label>
                <label className="text-xs font-medium text-slate-700">
                  Au
                  <input type="date" className={`${inputClass} mt-1 w-40`} value={e.end} onChange={(ev) => ev.target.value && setExercise(e.id, { end: ev.target.value })} />
                </label>
                <span className="pb-3 text-xs text-slate-600">{exerciseMonths(e) ?? "?"} mois</span>
                {dossier.exercises.length > 1 ? (
                  <button
                    type="button"
                    className={buttonClass.ghost}
                    onClick={() => {
                      if (!hasValues || window.confirm(`Supprimer l'exercice ${e.label} et ses montants ?`)) removeExercise(e.id);
                    }}
                  >
                    <Trash2 size={16} aria-hidden /> Retirer
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {dossier.exercises.length < MAX_EXERCISES ? (
          <button type="button" className={`${buttonClass.secondary} mt-2`} onClick={addExercise}>
            <Plus size={16} aria-hidden /> Ajouter un exercice
          </button>
        ) : null}
      </fieldset>
    </div>
  );
}

/** Contrôles comptables : écarts à corriger (ou à accepter avec une justification), contrôles conformes. */
function ChecksPanel({ checks, accepted, onAccept, onShow }: { checks: CheckResult[]; accepted: Record<string, string>; onAccept: (key: string, justification: string | null) => void; onShow: (check: CheckResult) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const gaps = checks.filter((c) => c.status === "gap").sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "blocking" ? -1 : 1));
  const ok = checks.filter((c) => c.status === "ok");
  return (
    <div className="space-y-3" aria-live="polite">
      <p className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
        <Pill tone={gaps.some((g) => g.severity === "blocking" && !accepted[g.key]) ? "red" : "green"}>{gaps.filter((g) => g.severity === "blocking").length} écart(s) bloquant(s)</Pill>
        <Pill tone={gaps.some((g) => g.severity === "warning") ? "yellow" : "neutral"}>{gaps.filter((g) => g.severity === "warning").length} point(s) à vérifier</Pill>
        <Pill tone="green">{ok.length} contrôle(s) conforme(s)</Pill>
      </p>
      {gaps.length ? (
        <ul className="space-y-2">
          {gaps.map((check) => (
            <li key={check.key} className={`rounded-xl border p-3 text-sm ${check.severity === "blocking" ? (accepted[check.key] ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50") : "border-amber-200 bg-amber-50"}`}>
              <p className="font-semibold text-slate-900">{check.label}</p>
              <p className="mt-0.5 text-slate-800">{check.explanation}</p>
              {check.hint ? <p className="mt-0.5 text-slate-600">{check.hint}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {check.codes.length ? (
                  <button type="button" className={buttonClass.ghost} onClick={() => onShow(check)}>
                    Voir dans la grille
                  </button>
                ) : null}
                {check.severity === "blocking" ? (
                  accepted[check.key] ? (
                    <>
                      <span className="text-amber-900">
                        <span className="font-semibold">Écart accepté :</span> {accepted[check.key]}
                      </span>
                      <button type="button" className={buttonClass.ghost} onClick={() => onAccept(check.key, null)}>
                        Annuler l&apos;acceptation
                      </button>
                    </>
                  ) : (
                    <details className="w-full">
                      <summary className="cursor-pointer text-slate-700">Le document d&apos;origine présente lui-même cet écart ?</summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input className={`${inputClass} flex-1`} maxLength={500} placeholder="Justification (ex. : le bilan déposé est lui-même déséquilibré de 3 000)" value={drafts[check.key] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [check.key]: e.target.value }))} aria-label={`Justification : ${check.label}`} />
                        <button type="button" className={buttonClass.secondary} disabled={(drafts[check.key] ?? "").trim().length < 10} onClick={() => onAccept(check.key, (drafts[check.key] ?? "").trim())}>
                          Accepter cet écart
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">L&apos;écart accepté reste signalé dans les indicateurs concernés et dans les limites du rapport.</p>
                    </details>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : checks.length ? (
        <Notice tone="success" title="Tous les contrôles sont conformes">
          Bilan équilibré, totaux cohérents avec leurs postes{checks.some((c) => c.key.startsWith("resultat:")) ? ", résultat identique au bilan et au compte de résultat" : ""}
          {checks.some((c) => c.key.startsWith("tft:")) ? ", trésorerie du tableau des flux identique à celle du bilan" : ""}.
        </Notice>
      ) : (
        <p className="text-sm text-slate-600">Les contrôles apparaissent dès que des montants sont saisis.</p>
      )}
    </div>
  );
}

/** Étape « Vérification des chiffres » : paramètres, grille, contrôles, provenance, attestation et validation. */
export function ReviewStep({
  dossier,
  resolved,
  checks,
  acceptedGaps,
  provenance,
  attested,
  validated,
  stale,
  onDossier,
  onValue,
  onAccept,
  onProvenance,
  onAttested,
  onValidate,
}: {
  dossier: FinanceDossier;
  resolved: Record<string, ExerciseValues>;
  checks: CheckResult[];
  acceptedGaps: Record<string, string>;
  provenance: Provenance | null;
  attested: boolean;
  validated: boolean;
  stale: boolean;
  onDossier: (next: FinanceDossier) => void;
  onValue: (exerciseId: string, code: string, value: number | null) => void;
  onAccept: (key: string, justification: string | null) => void;
  onProvenance: (next: Provenance | null) => void;
  onAttested: (value: boolean) => void;
  onValidate: () => void;
}) {
  const [section, setSection] = useState<SectionId>("actif");
  const exercises = sortedExercises(dossier.exercises);
  const hasValues = Object.values(dossier.values).some((v) => Object.keys(v).length > 0);
  const blocking = checks.filter((c) => c.status === "gap" && c.severity === "blocking" && !acceptedGaps[c.key]);
  const missing = [!dossier.company.name.trim() ? "le nom de l'entreprise" : null, !hasValues ? "au moins un état financier" : null, !provenance ? "la provenance des états" : null, !attested ? "votre attestation de vérification" : null].filter(Boolean) as string[];
  const show = (check: CheckResult) => {
    const code = check.codes[0];
    const target = { A: "actif", B: "actif", C: "passif", D: "passif", T: "cr", R: "cr", X: "cr", Z: "tft", F: "tft" }[code[0] as "A"] as SectionId | undefined;
    if (target) setSection(target);
    window.setTimeout(() => document.getElementById(`poste-${code}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
  };
  return (
    <div className="space-y-5">
      {stale ? (
        <Notice tone="stale" title="Chiffres modifiés depuis votre validation">
          Vérifiez les contrôles, puis validez à nouveau vos états : les analyses seront recalculées avec les nouveaux chiffres.
        </Notice>
      ) : null}
      <Section title="L'entreprise et les exercices" description="L'unité et la monnaie s'appliquent à tous les exercices ; le secteur ajuste les repères utilisés pour juger chaque indicateur.">
        <CompanyParams dossier={dossier} onDossier={onDossier} />
      </Section>
      <Section title="Mes états financiers (SYSCOHADA révisé)" description="Vérifiez chaque montant avec le document d'origine. Les contrôles se mettent à jour à chaque modification ; aucune valeur n'est corrigée à votre place.">
        <StatementsGrid dossier={dossier} exercises={exercises} resolved={resolved} checks={checks} section={section} onSection={setSection} onChange={onValue} />
      </Section>
      <Section title="Contrôles comptables" description="Équilibre du bilan, totaux, résultat identique dans les deux états, trésorerie du tableau des flux identique à celle du bilan, cohérence d'un exercice à l'autre.">
        <ChecksPanel checks={checks} accepted={acceptedGaps} onAccept={onAccept} onShow={show} />
      </Section>
      <Section title="Validation de mes états" description="ACADIA n'analyse que des chiffres que vous avez vérifiés et dont vous déclarez la provenance.">
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-slate-800">Provenance des états financiers</legend>
            <div className="grid gap-2 md:grid-cols-2">
              {(Object.keys(FINANCE_PROVENANCE_LABELS) as FinanceProvenanceKind[]).map((kind) => (
                <label key={kind} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm ring-1 ${provenance?.kind === kind ? "bg-emerald-50 ring-2 ring-emerald-400" : "bg-white ring-slate-200"}`}>
                  <input type="radio" name="finance-provenance" className="h-4 w-4" checked={provenance?.kind === kind} onChange={() => onProvenance({ kind, description: provenance?.description ?? "" })} />
                  {FINANCE_PROVENANCE_LABELS[kind]}
                </label>
              ))}
            </div>
            {provenance ? <input className={`${inputClass} mt-2`} maxLength={300} placeholder="Précision facultative (ex. : états déposés au greffe, obtenus auprès du service comptable…)" value={provenance.description} onChange={(e) => onProvenance({ ...provenance, description: e.target.value })} aria-label="Précision sur la provenance" /> : null}
          </fieldset>
          <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={attested} onChange={(e) => onAttested(e.target.checked)} />
            <span>
              {provenance?.kind === "fictifs"
                ? "Ces chiffres sont fictifs : je les utilise pour découvrir ACADIA, sans les présenter comme des données réelles."
                : "J'ai vérifié chaque montant avec le document d'origine. Les postes laissés vides dans les états que j'ai fournis valent zéro."}
            </span>
          </label>
          {blocking.length ? (
            <Notice tone="error" title="Validation impossible">
              {blocking.length} écart(s) bloquant(s) : corrigez le ou les chiffres concernés, ou acceptez l&apos;écart en le justifiant.
            </Notice>
          ) : null}
          {missing.length && !blocking.length ? <p className="text-sm text-slate-600">À compléter : {missing.join(", ")}.</p> : null}
          <button type="button" className={buttonClass.primary} disabled={blocking.length > 0 || missing.length > 0} onClick={onValidate}>
            <CheckCircle2 size={18} aria-hidden /> {validated ? "États validés — continuer : l'état de l'entreprise" : "Valider mes états et continuer"}
          </button>
        </div>
      </Section>
    </div>
  );
}
