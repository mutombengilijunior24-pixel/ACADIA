"use client";

import type { DatasetProfile, StatisticalType, UnderstandingState, VariableRoleInStudy } from "@/lib/core/data/types";

import { CONFIDENCE_LABELS, ROLE_LABELS, STATISTICAL_LABELS, STORAGE_LABELS } from "./labels";
import { Pill, Section, inputClass } from "./ui";

const STAT_OPTIONS = Object.keys(STATISTICAL_LABELS) as StatisticalType[];
const ROLE_OPTIONS = Object.keys(ROLE_LABELS) as VariableRoleInStudy[];

export default function VariablesPanel({
  understanding,
  profile,
  onConfirmType,
  onRole,
  onMissingCodes,
}: {
  understanding: UnderstandingState;
  profile: DatasetProfile;
  onConfirmType: (column: number, type: StatisticalType) => void;
  onRole: (column: number, role: VariableRoleInStudy | null) => void;
  onMissingCodes: (column: number, values: string[]) => void;
}) {
  return (
    <Section
      title="Classification des variables"
      description="Type informatique (stockage) et type statistique sont distincts. Les classifications non certaines doivent être confirmées : une colonne « à confirmer » ne sera pas utilisée par les analyses futures."
    >
      <ul className="space-y-3">
        {understanding.variables.map((variable) => {
          const column = profile.columns[variable.column];
          return (
            <li key={variable.column} className={`rounded-2xl border p-4 ${variable.needsConfirmation ? "border-amber-200" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900" title={variable.originalHeader}>
                    {variable.originalHeader.trim() || <em className="text-slate-400">(sans en-tête)</em>}
                  </h3>
                  <p className="font-mono text-xs text-slate-500">{variable.technicalName}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Pill>{STORAGE_LABELS[variable.detected.storageType]}</Pill>
                  <Pill tone={variable.analysisReady ? "green" : "yellow"}>{STATISTICAL_LABELS[variable.effectiveType]}</Pill>
                  {variable.confirmed ? <Pill tone="blue">Confirmé par vous</Pill> : <Pill tone={variable.detected.confidence === "high" ? "green" : "yellow"}>{CONFIDENCE_LABELS[variable.detected.confidence]}</Pill>}
                  {variable.detected.binary ? <Pill>Binaire</Pill> : null}
                </div>
              </div>

              <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
                {variable.detected.reasons.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
                {variable.confirmed ? (
                  <li className="text-blue-700">
                    • Détection automatique conservée : « {STATISTICAL_LABELS[variable.detected.statisticalType]} » ({variable.detected.rule}).
                  </li>
                ) : null}
              </ul>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Type statistique retenu</span>
                  <select
                    className={inputClass}
                    value={variable.confirmed ? variable.effectiveType : ""}
                    onChange={(event) => event.target.value && onConfirmType(variable.column, event.target.value as StatisticalType)}
                  >
                    <option value="">{`Détecté : ${STATISTICAL_LABELS[variable.detected.statisticalType]} — confirmer ou corriger…`}</option>
                    {STAT_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {STATISTICAL_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Rôle dans la recherche</span>
                  <select
                    className={inputClass}
                    value={variable.role?.source === "user" ? variable.role.value : ""}
                    onChange={(event) => onRole(variable.column, (event.target.value || null) as VariableRoleInStudy | null)}
                  >
                    <option value="">{variable.role ? `${ROLE_LABELS[variable.role.value]} (${variable.role.source === "user" ? "vous" : variable.role.source === "research_variable" ? "variable de recherche" : "déduit du type"})` : "Non défini"}</option>
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  {variable.role?.detail ? <span className="mt-1 block text-xs text-slate-500">{variable.role.detail}</span> : null}
                </label>
              </div>

              {column && (column.missingCodeCandidates.length > 0 || column.appliedMissingCodes.length > 0) ? (
                <fieldset className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <legend className="px-1 font-medium text-slate-700">Codes de non-réponse</legend>
                  <p className="mb-2 text-xs text-slate-500">« NA », « 99 »… peuvent être de vraies valeurs. Cochez uniquement les codes qui signifient « pas de réponse » dans votre enquête.</p>
                  {[...new Set([...column.missingCodeCandidates.map((c) => c.value), ...column.appliedMissingCodes])].map((value) => {
                    const checked = column.appliedMissingCodes.includes(value);
                    const count = column.missingCodeCandidates.find((c) => c.value === value)?.count;
                    return (
                      <label key={value} className="mr-4 inline-flex min-h-10 items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={checked}
                          onChange={(event) =>
                            onMissingCodes(
                              variable.column,
                              event.target.checked ? [...column.appliedMissingCodes, value] : column.appliedMissingCodes.filter((v) => v !== value),
                            )
                          }
                        />
                        « {value} »{count !== undefined ? ` (${count})` : ""}
                      </label>
                    );
                  })}
                  {column.missingCodeCandidates.length > 0 && column.appliedMissingCodes.length === 0 ? (
                    <button type="button" className="ml-1 text-xs font-medium text-blue-700 underline" onClick={() => onMissingCodes(variable.column, [])}>
                      Ce ne sont pas des non-réponses
                    </button>
                  ) : null}
                </fieldset>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
