"use client";

import { useState } from "react";
import { useResearch } from "@/contexts/ResearchContext";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import ResearchStepHeader from "./brand/ResearchStepHeader";

export default function StepObjectives() {
  const { currentResearch, updateCurrentResearch } = useResearch();
  const [newObjective, setNewObjective] = useState("");

  const objectivesList = currentResearch.objectives ?? [];

  const handleAddObjective = () => {
    const trimmed = newObjective.trim();
    if (!trimmed) return;

    const updated = [...objectivesList, trimmed];
    updateCurrentResearch("objectives", updated);
    setNewObjective("");
  };

  const handleRemoveObjective = (indexToRemove: number) => {
    const updated = objectivesList.filter((_, idx) => idx !== indexToRemove);
    updateCurrentResearch("objectives", updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddObjective();
    }
  };

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={8}
        category="Objectifs"
        title="Détaillons vos objectifs spécifiques"
        description="Les objectifs spécifiques décomposent votre objectif général en 2 à 4 étapes opérationnelles. Chaque objectif permettra de déterminer des variables et indicateurs précis."
      />

      {/* Zone d'ajout d'objectif */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5 space-y-3">
        <label htmlFor="new-objective-input" className="block text-sm font-semibold text-acadia-navy">
          Ajouter un objectif spécifique
        </label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            id="new-objective-input"
            type="text"
            value={newObjective}
            onChange={(e) => setNewObjective(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Identifier les principaux facteurs de motivation au travail..."
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-acadia-blue focus:outline-none focus:ring-2 focus:ring-acadia-blue/20"
          />
          <button
            type="button"
            onClick={handleAddObjective}
            disabled={!newObjective.trim()}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
              newObjective.trim()
                ? "bg-acadia-blue text-white hover:brightness-110 active:scale-[0.98]"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter</span>
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Appuyez sur <kbd className="rounded bg-slate-200 px-1 py-0.5 text-2xs font-semibold">Entrée</kbd> pour ajouter rapidement.
        </p>
      </div>

      {/* Liste des objectifs déjà ajoutés */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Objectifs spécifiques définis ({objectivesList.length})</span>
          {objectivesList.length > 0 && (
            <span className="text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Pris en compte
            </span>
          )}
        </div>

        {objectivesList.length > 0 ? (
          <div className="space-y-2.5">
            {objectivesList.map((obj, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 transition shadow-2xs hover:border-slate-300"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acadia-blue-100 text-xs font-bold text-acadia-navy mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-sm font-medium text-slate-800 leading-relaxed break-words">
                    {obj}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveObjective(idx)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition shrink-0"
                  title="Supprimer cet objectif"
                  aria-label={`Supprimer l'objectif ${idx + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Aucun objectif spécifique ajouté pour le moment. Ajoutez au moins 1 à 3 objectifs pour guider votre étude.
          </div>
        )}
      </div>
    </div>
  );
}