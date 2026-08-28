"use client";

import { useState } from "react";
import { GitBranch, CheckCircle2, XCircle, Sparkles, Pencil, Plus } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import { recommendSecondaryHypothesisCount, proposeSecondaryHypotheses } from "@/lib/core/research/HypothesisProposalEngine";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";

/**
 * P13.2, Étape 5 — structure principale/secondaires des hypothèses.
 * Le nombre de secondaires n'est jamais imposé (2 ou 3, au choix du
 * chercheur) ; les propositions sont dérivées des dimensions déjà
 * opérationnalisées, jamais d'une nouvelle variable inventée, et
 * restent `status: "proposed"` tant qu'elles ne sont pas validées.
 */
export default function HypothesisStructureSection({ project }: { project: ResearchProject }) {
  const { addHypothesis, updateHypothesisStatus, updateHypothesisStatement } = useResearch();
  const researchId = project.id;

  const activeHypotheses = project.hypotheses.filter((h) => h.status !== "rejected");
  const principal = activeHypotheses.filter((h) => h.role === "general");
  const secondary = activeHypotheses.filter((h) => h.role === "specific");

  const recommendation = recommendSecondaryHypothesisCount(project);
  const [targetCount, setTargetCount] = useState<2 | 3>(recommendation.recommended);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState("");

  function startEdit(hypothesisId: string, currentStatement: string) {
    setEditingId(hypothesisId);
    setDraft(currentStatement);
  }

  function saveEdit(hypothesisId: string) {
    if (draft.trim()) updateHypothesisStatement(researchId, hypothesisId, draft.trim());
    setEditingId(null);
  }

  function handleAddCustom() {
    const text = customDraft.trim();
    if (!text) return;
    addHypothesis(researchId, {
      id: `hypothesis-custom-${Date.now()}`,
      statement: text,
      role: "specific",
      status: "accepted",
      confidence: "medium",
    });
    setCustomDraft("");
    setAddingCustom(false);
  }

  const independent = project.variables.find((v) => v.role === "independent");
  const dependent = project.variables.find((v) => v.role === "dependent");
  const canPropose = Boolean(independent && dependent && (independent.dimensions?.length ?? 0) > 0);

  function handlePropose() {
    const proposals = proposeSecondaryHypotheses(project, targetCount);
    for (const hypothesis of proposals) {
      addHypothesis(researchId, hypothesis);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
        <GitBranch className="h-3.5 w-3.5" /> Structure des hypothèses
      </p>
      <h2 className="mt-1 text-lg font-bold text-acadia-navy">Hypothèse principale &amp; hypothèses secondaires</h2>

      {principal.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Aucune hypothèse principale n&apos;est encore identifiée.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {principal.map((h) => (
            <div key={h.id} className="rounded-2xl border border-acadia-blue-100 bg-acadia-blue-50/40 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-2xs font-bold uppercase tracking-wider text-acadia-blue">H — Hypothèse principale</p>
                {editingId !== h.id && (
                  <button
                    type="button"
                    onClick={() => startEdit(h.id, h.statement)}
                    aria-label="Modifier"
                    className="shrink-0 rounded-lg p-1 text-acadia-blue hover:bg-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {editingId === h.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-acadia-blue focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => saveEdit(h.id)} className="rounded-lg bg-acadia-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                      Enregistrer
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm text-acadia-navy">{h.statement}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Hypothèses secondaires</p>
        {secondary.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune hypothèse secondaire pour le moment.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {secondary.map((h, i) => (
              <div key={h.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5">
                <div className="flex-1">
                  <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">H{i + 1}</p>
                  {editingId === h.id ? (
                    <div className="mt-1.5 space-y-2">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-acadia-blue focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => saveEdit(h.id)} className="rounded-lg bg-acadia-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                          Enregistrer
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-slate-700">{h.statement}</p>
                  )}
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-2xs font-semibold ${
                      h.status === "proposed" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {h.status === "proposed" ? "Proposée par ACADIA — à valider" : "Acceptée par le chercheur"}
                  </span>
                </div>
                {editingId !== h.id && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(h.id, h.statement)}
                      aria-label="Modifier"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-acadia-blue"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {h.status === "proposed" && (
                      <button
                        type="button"
                        onClick={() => updateHypothesisStatus(researchId, h.id, "accepted")}
                        aria-label="Valider"
                        className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => updateHypothesisStatus(researchId, h.id, "rejected")}
                      aria-label="Supprimer"
                      className="rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!addingCustom ? (
          <button
            type="button"
            onClick={() => setAddingCustom(true)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-acadia-blue hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter ma propre hypothèse secondaire
          </button>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 p-4">
            <textarea
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              rows={2}
              placeholder="Formulez votre hypothèse secondaire..."
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-acadia-blue focus:outline-none"
            />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={handleAddCustom} className="rounded-lg bg-acadia-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                Ajouter
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingCustom(false);
                  setCustomDraft("");
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {canPropose && secondary.length < targetCount && (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4">
          <p className="text-xs text-slate-600">{recommendation.justification}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Nombre d&apos;hypothèses secondaires :</span>
            {([2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTargetCount(n)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  targetCount === n ? "bg-acadia-blue text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {n}
                {n === recommendation.recommended ? " (recommandé)" : ""}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <ResearchPrimaryButton onClick={handlePropose}>
              <Sparkles className="h-4 w-4" /> Proposer des hypothèses secondaires
            </ResearchPrimaryButton>
          </div>
        </div>
      )}

      {!canPropose && secondary.length === 0 && (
        <p className="mt-4 text-xs text-slate-400">
          ACADIA ne peut pas encore proposer d&apos;hypothèses secondaires : une variable explicative et une variable
          dépendante opérationnalisées avec au moins une dimension sont nécessaires.
        </p>
      )}
    </section>
  );
}
