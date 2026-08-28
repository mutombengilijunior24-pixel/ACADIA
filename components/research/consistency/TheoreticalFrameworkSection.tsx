"use client";

import { useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";
import { THEORY_TO_REGISTER } from "@/lib/core/research/TheoreticalFrameworkTypes";
import type { ResearchVariable } from "@/lib/core/research/ResearchTypes";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";

/**
 * P13.2 — Cadre théorique : distingue explicitement "renseigné" de
 * "non renseigné", jamais déduit ni inventé par ACADIA. Suit le
 * même mécanisme d'ajout/suppression explicite que la bibliographie
 * (P11) — aucun nouveau système de stockage.
 *
 * P15 — ajoute un lien optionnel vers une variable déjà
 * opérationnalisée, choisi explicitement par le chercheur, pour
 * afficher la chaîne réelle Théorie → Concept → Variable.
 */
export default function TheoreticalFrameworkSection({
  researchId,
  variables = [],
}: {
  researchId: string;
  variables?: ResearchVariable[];
}) {
  const { theoreticalFramework, addTheoreticalFrameworkEntry, removeTheoreticalFrameworkEntry } = useResearch();
  const entries = theoreticalFramework[researchId] ?? [];

  const [showForm, setShowForm] = useState(false);
  const [concept, setConcept] = useState("");
  const [theoryName, setTheoryName] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [summary, setSummary] = useState("");
  const [variableId, setVariableId] = useState("");

  function submit() {
    if (!concept.trim()) return;
    addTheoreticalFrameworkEntry(researchId, {
      id: `theory-${researchId}-${Date.now()}`,
      concept: concept.trim(),
      theoryName: theoryName.trim() || undefined,
      author: author.trim() || undefined,
      year: year.trim() ? Number(year.trim()) : undefined,
      summary: summary.trim() || undefined,
      variableId: variableId || undefined,
      createdAt: new Date().toISOString(),
    });
    setConcept("");
    setTheoryName("");
    setAuthor("");
    setYear("");
    setSummary("");
    setVariableId("");
    setShowForm(false);
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
        <BookOpen className="h-3.5 w-3.5" /> Cadre théorique
      </p>
      <h2 className="mt-1 text-lg font-bold text-acadia-navy">Théorie(s) mobilisée(s)</h2>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{THEORY_TO_REGISTER}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5">
              <div>
                <p className="text-sm font-semibold text-acadia-navy">
                  {entry.concept}
                  {entry.theoryName && <span className="font-normal text-slate-500"> — {entry.theoryName}</span>}
                </p>
                {(entry.author || entry.year) && (
                  <p className="text-2xs text-slate-400">
                    {entry.author}
                    {entry.author && entry.year ? " · " : ""}
                    {entry.year}
                  </p>
                )}
                {entry.summary && <p className="mt-1 text-xs text-slate-600">{entry.summary}</p>}
                {entry.variableId && (
                  <p className="mt-1 text-2xs font-semibold text-acadia-blue">
                    → Variable : {variables.find((v) => v.id === entry.variableId)?.name ?? "variable retirée du projet"}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeTheoreticalFrameworkEntry(researchId, entry.id)}
                aria-label="Retirer"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="mt-4 space-y-2 rounded-2xl border border-dashed border-slate-300 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Concept / notion théorique *"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm sm:col-span-2"
            />
            <input
              value={theoryName}
              onChange={(e) => setTheoryName(e.target.value)}
              placeholder="Nom de la théorie (optionnel)"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
            />
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Auteur (optionnel)"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
            />
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Année (optionnel)"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
            />
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Résumé du mécanisme théorique, rédigé par vous (optionnel)"
              rows={3}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm sm:col-span-2"
            />
            {variables.length > 0 && (
              <select
                value={variableId}
                onChange={(e) => setVariableId(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm sm:col-span-2"
              >
                <option value="">Relier à une variable (optionnel)</option>
                {variables.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} [{v.role}]
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <ResearchPrimaryButton onClick={submit}>Enregistrer</ResearchPrimaryButton>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-acadia-blue hover:underline"
        >
          <Plus className="h-4 w-4" /> Ajouter un cadre théorique
        </button>
      )}
    </section>
  );
}
