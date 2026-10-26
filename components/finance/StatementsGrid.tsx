"use client";

import { useState } from "react";

import { inputClass } from "@/components/data/ui";
import {
  exerciseMonths,
  formatAmount,
  parseAmount,
  postesOf,
  providedStatements,
  SECTION_LABELS,
  STATEMENT_OF,
  type CheckResult,
  type ExerciseValues,
  type Exercise,
  type FinanceDossier,
  type Poste,
  type SectionId,
} from "@/lib/core/finance";

const SECTIONS: SectionId[] = ["actif", "passif", "cr", "tft"];

/** Cellule de montant : saisie libre (« 12 500 », « (1 200) »…), lue à la sortie du champ ; une saisie illisible n'est jamais enregistrée. */
function AmountCell({ value, computed, isTotal, gap, label, onCommit }: { value: number | null; computed: number | null; isTotal: boolean; gap: boolean; label: string; onCommit: (value: number | null) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const parsed = parseAmount(draft);
    if (!parsed.ok) {
      setError(parsed.reason);
      return;
    }
    setError(null);
    setDraft(null);
    onCommit(parsed.value);
  };
  return (
    <div>
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        aria-invalid={error || gap ? true : undefined}
        title={error ?? undefined}
        className={`${inputClass} min-h-9 text-right tabular-nums ${isTotal ? "font-semibold" : ""} ${error ? "border-rose-400 bg-rose-50" : gap ? "border-rose-300 ring-2 ring-rose-200" : ""} placeholder:italic`}
        value={draft ?? (value === null ? "" : formatAmount(value))}
        placeholder={isTotal && computed !== null ? formatAmount(computed) : ""}
        // Le texte affiché ne change jamais à l'entrée dans le champ (une saisie illisible reste visible pour être corrigée).
        onFocus={() => {
          if (draft === null) setDraft(value === null ? "" : formatAmount(value));
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(null);
            setError(null);
          }
        }}
      />
      {error ? <p className="mt-0.5 text-[11px] text-rose-700">{error}</p> : null}
    </div>
  );
}

const signOf = (poste: Poste) => (poste.kind === "total" ? "=" : poste.signed ? "±" : poste.sign === -1 ? "−" : "+");

/**
 * Grille des états financiers (SYSCOHADA révisé) : une ligne par poste, une colonne par exercice.
 * Les totaux non saisis affichent leur valeur calculée (en italique) ; un écart signalé est surligné.
 */
export function StatementsGrid({
  dossier,
  exercises,
  resolved,
  checks,
  section,
  onSection,
  onChange,
}: {
  dossier: FinanceDossier;
  exercises: Exercise[];
  resolved: Record<string, ExerciseValues>;
  checks: CheckResult[];
  section: SectionId;
  onSection: (section: SectionId) => void;
  onChange: (exerciseId: string, code: string, value: number | null) => void;
}) {
  const gapCells = new Set(checks.filter((c) => c.status === "gap").flatMap((c) => c.codes.map((code) => `${code}:${c.exerciseId}`)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="États financiers">
        {SECTIONS.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={section === s} onClick={() => onSection(s)} className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ring-1 transition ${section === s ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}>
            {SECTION_LABELS[s]}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200" role="tabpanel" aria-label={SECTION_LABELS[section]}>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-[15rem] bg-slate-50 px-3 py-2 text-left font-semibold">
                Poste
              </th>
              <th scope="col" className="px-1 py-2 text-center font-semibold" title="Sens : + produit ou ressource, − charge ou décaissement, ± montant signé, = total">
                Sens
              </th>
              {exercises.map((e) => {
                const provided = providedStatements(dossier, e.id).has(STATEMENT_OF[section]);
                return (
                  <th key={e.id} scope="col" className="min-w-[8.5rem] px-2 py-2 text-right font-semibold">
                    <span className="block text-sm text-slate-900">{e.label}</span>
                    <span className="block font-normal">{exerciseMonths(e) ?? "?"} mois{provided ? "" : " · non fourni"}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {postesOf(section).map((poste) => (
              <tr key={poste.code} id={`poste-${poste.code}`} className={`border-t border-slate-100 ${poste.kind === "total" ? (poste.level === 0 ? "bg-emerald-50/60" : "bg-slate-50/70") : ""}`}>
                <th scope="row" className={`sticky left-0 z-10 px-3 py-1.5 text-left align-middle font-normal ${poste.kind === "total" ? (poste.level === 0 ? "bg-emerald-50" : "bg-slate-50") : "bg-white"}`}>
                  <span className={`block ${poste.kind === "total" ? "font-semibold text-slate-900" : "pl-3 text-slate-700"}`}>
                    <span className="mr-1.5 inline-block w-6 font-mono text-xs text-slate-400">{poste.code}</span>
                    {poste.label}
                  </span>
                  {poste.hint ? <span className="block pl-10 text-[11px] text-slate-500">{poste.hint}</span> : null}
                </th>
                <td className="px-1 text-center font-mono text-slate-500">{signOf(poste)}</td>
                {exercises.map((e) => {
                  const r = resolved[e.id]?.[poste.code];
                  const entered = dossier.values[e.id]?.[poste.code];
                  return (
                    <td key={e.id} className="px-2 py-1">
                      <AmountCell
                        value={entered ?? null}
                        computed={r?.origin === "absent" ? null : (r?.computed ?? (poste.kind === "total" ? r?.value ?? null : null))}
                        isTotal={poste.kind === "total"}
                        gap={gapCells.has(`${poste.code}:${e.id}`)}
                        label={`${poste.label} (${poste.code}), ${e.label}`}
                        onCommit={(value) => onChange(e.id, poste.code, value)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Saisissez les montants tels qu&apos;ils figurent dans l&apos;état, sans signe pour les charges et les décaissements (colonne « Sens » : ACADIA applique le sens). Un total laissé vide est calculé (affiché en italique) ; un total saisi est comparé à la somme de ses postes.
      </p>
    </div>
  );
}
