"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Pencil } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";

/**
 * Validation humaine des variables A2 (accepter/rejeter/corriger le
 * nom) — même exigence que pour les hypothèses (HypothesisStructureSection)
 * et la méthodologie : une variable proposée par ACADIA reste
 * `status: "proposed"` tant que le chercheur ne l'a pas explicitement
 * validée. Une variable rejetée disparaît de cette vue (elle reste
 * en base pour traçabilité) et n'est plus utilisée par la suite du
 * parcours (méthodologie, hypothèses, questionnaire).
 */
export default function VariableValidationSection({ project }: { project: ResearchProject }) {
  const { updateVariableStatus, updateVariableName } = useResearch();
  const researchId = project.id;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const activeVariables = project.variables.filter((v) => v.status !== "rejected");

  function startEdit(variableId: string, currentName: string) {
    setEditingId(variableId);
    setDraft(currentName);
  }

  function saveEdit(variableId: string) {
    if (draft.trim()) updateVariableName(researchId, variableId, draft.trim());
    setEditingId(null);
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">
        Opérationnalisation
      </p>
      <h2 className="mt-1 text-lg font-bold text-acadia-navy">
        Variables → dimensions → indicateurs → mesures
      </h2>

      {activeVariables.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400 italic">
          Aucune variable identifiée pour le moment.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {activeVariables.map((variable) => {
            const dimensionCount = variable.dimensions?.length ?? 0;
            const indicatorCount =
              (variable.indicators?.length ?? 0) +
              (variable.dimensions ?? []).reduce(
                (sum, d) => sum + (d.indicators?.length ?? 0),
                0
              );
            const measuredCount = (variable.dimensions ?? []).reduce(
              (sum, d) =>
                sum + (d.indicators ?? []).filter((i) => Boolean(i.measurementType)).length,
              0
            );
            const isProposed = variable.status === "proposed";

            return (
              <div
                key={variable.id}
                className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-2xs font-bold tracking-wider text-slate-400 uppercase">
                    Variable ({variable.role})
                  </p>
                  {editingId !== variable.id && (
                    <button
                      type="button"
                      onClick={() => startEdit(variable.id, variable.name)}
                      aria-label="Modifier le nom"
                      className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white hover:text-acadia-blue"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {editingId === variable.id ? (
                  <div className="mt-1.5 space-y-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2 text-sm text-slate-900 focus:border-acadia-blue focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => saveEdit(variable.id)} className="rounded-lg bg-acadia-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                        Enregistrer
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 text-sm font-semibold text-acadia-navy">
                    {variable.name}
                  </p>
                )}

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-2xs font-semibold ${
                      isProposed ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {isProposed ? "Proposée par ACADIA — à valider" : "Acceptée par le chercheur"}
                  </span>
                  {isProposed && editingId !== variable.id && (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateVariableStatus(researchId, variable.id, "accepted")}
                        aria-label="Valider"
                        className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateVariableStatus(researchId, variable.id, "rejected")}
                        aria-label="Rejeter"
                        className="rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-extrabold text-acadia-blue">{dimensionCount}</p>
                    <p className="text-2xs text-slate-500">Dimensions</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-acadia-blue">{indicatorCount}</p>
                    <p className="text-2xs text-slate-500">Indicateurs</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-acadia-blue">
                      {measuredCount} / {indicatorCount || 0}
                    </p>
                    <p className="text-2xs text-slate-500">Mesures</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
