"use client";

// ============================================================
// ACADIA — DIRECTEUR DE MÉMOIRE D'UN PROJET (page du projet)
//
// Affiche le directeur rattaché au travail et permet de le choisir ou
// de le changer — notamment pour les projets créés depuis l'aperçu
// public, qui ne passent pas par l'assistant « Nouvelle recherche ».
// ============================================================

import { useState } from "react";
import { Pencil, UserRound } from "lucide-react";

import { useResearch } from "@/contexts/ResearchContext";
import DirectorPicker, { type DirectorChoice } from "@/components/directors/DirectorPicker";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";
import type { Research } from "@/types/Research";

export default function ProjectDirectorCard({ research }: { research: Research }) {
  const { updateResearch } = useResearch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DirectorChoice>({ directorId: research.directorId ?? "", directorName: research.directorName ?? "" });

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
                    ? "Votre travail est rattaché à ce directeur : ACADIA s'ajustera à son canevas dès qu'il sera intégré."
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
    </div>
  );
}
