"use client";

// ============================================================
// ACADIA — DIRECTEUR DE MÉMOIRE D'UN PROJET (page du projet)
//
// Affiche le directeur rattaché au travail et permet de le choisir ou
// de le changer — notamment pour les projets créés depuis l'aperçu
// public, qui ne passent pas par l'assistant « Nouvelle recherche ».
// ============================================================

import { useEffect, useState } from "react";
import { ClipboardList, Pencil, UserRound } from "lucide-react";

import { useResearch } from "@/contexts/ResearchContext";
import DirectorPicker, { type DirectorChoice } from "@/components/directors/DirectorPicker";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";
import type { DirectorCanevasView } from "@/lib/core/directors/directors";
import type { Research } from "@/types/Research";

/** Canevas actif du directeur (compte rattaché et validé) ; null = logique générale d'ACADIA. */
function useDirectorCanevas(directorId: string | undefined) {
  const [state, setState] = useState<{ id: string; canevas: DirectorCanevasView | null } | null>(null);
  useEffect(() => {
    if (!directorId) return;
    let cancelled = false;
    fetch(`/api/directors/${encodeURIComponent(directorId)}/canevas`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { canevas: null }))
      .then((body: { canevas: DirectorCanevasView | null }) => {
        if (!cancelled) setState({ id: directorId, canevas: body.canevas });
      })
      .catch(() => {
        if (!cancelled) setState({ id: directorId, canevas: null });
      });
    return () => {
      cancelled = true;
    };
  }, [directorId]);
  return directorId && state?.id === directorId ? state.canevas : null;
}

export default function ProjectDirectorCard({ research }: { research: Research }) {
  const { updateResearch } = useResearch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DirectorChoice>({ directorId: research.directorId ?? "", directorName: research.directorName ?? "" });
  const canevas = useDirectorCanevas(research.directorId || undefined);

  const current = research.directorName?.trim();

  function startEditing() {
    setDraft({ directorId: research.directorId ?? "", directorName: research.directorName ?? "" });
    setEditing(true);
  }

  function save() {
    updateResearch({
      ...research,
      directorId: draft.directorId,
      directorName: draft.directorName.replace(/\s+/g, " ").trim(),
      updatedAt: new Date(),
    });
    setEditing(false);
  }

  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-acadia-blue-50 text-acadia-blue">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Directeur de mémoire</p>
            <p className="mt-1 text-lg font-bold text-acadia-navy">{current || "Non renseigné"}</p>
            {!editing && (
              <p className="mt-1 text-xs text-slate-500">
                {current
                  ? research.directorId
                    ? canevas
                      ? "Votre directeur a défini son canevas dans ACADIA : il s'applique à votre travail."
                      : "Votre directeur n'a pas encore défini son canevas dans ACADIA : votre travail suit la logique générale d'ACADIA."
                    : "Directeur saisi hors liste : ACADIA applique sa logique générale."
                  : "Indiquez votre directeur pour que votre travail lui soit rattaché."}
              </p>
            )}
          </div>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-acadia-blue hover:text-acadia-blue"
          >
            <Pencil className="h-4 w-4" /> {current ? "Modifier" : "Choisir"}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-5 space-y-4">
          <DirectorPicker university={research.university} value={draft} onChange={setDraft} />
          <div className="flex flex-wrap gap-2">
            <ResearchPrimaryButton type="button" onClick={save}>
              Enregistrer
            </ResearchPrimaryButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {!editing && canevas && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
            <ClipboardList className="h-4 w-4" /> Canevas de {canevas.directorLabel} — année {canevas.academicYear}
          </p>
          <ol className="mt-3 space-y-1.5 text-sm text-slate-700">
            {canevas.steps.map((step, index) => (
              <li key={`${step.name}-${index}`} className="flex gap-2">
                <span className="w-6 shrink-0 text-xs font-bold text-slate-400">{index + 1}.</span>
                <span>
                  {step.name}
                  {!step.required && <span className="ml-1 text-xs text-slate-400">(facultatif)</span>}
                  {step.description && <span className="block text-xs text-slate-500">{step.description}</span>}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-500">
            Mis à jour le {new Date(canevas.updatedAt).toLocaleDateString("fr-FR", { timeZone: "Africa/Lubumbashi" })} par votre directeur ; toute
            modification de sa part apparaît ici automatiquement.
          </p>
        </div>
      )}
    </div>
  );
}
