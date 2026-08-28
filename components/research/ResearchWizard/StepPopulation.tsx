"use client";

import { useResearch } from "@/contexts/ResearchContext";
import { Lightbulb } from "lucide-react";
import ResearchStepHeader from "./brand/ResearchStepHeader";
import ResearchTextArea from "./brand/ResearchTextArea";

export default function StepPopulation() {
  const { currentResearch, updateCurrentResearch } = useResearch();

  const examples = [
    "Les agents administratifs et techniques de la SNCC",
    "Les étudiants inscrits en Faculté des Sciences Économiques",
    "Les dirigeants et directeurs financiers des PME de Lubumbashi",
    "Le personnel soignant des hôpitaux généraux de référence",
  ];

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={9}
        category="Terrain"
        title="Qui constitue votre population d'étude ?"
        description="Définissez précisément le groupe d'individus, d'employés, de clients ou d'unités que vous allez observer ou interroger."
      />

      <ResearchTextArea
        id="population-textarea"
        label="Description de la population cible"
        required
        rows={5}
        value={currentResearch.population}
        onChange={(value) => updateCurrentResearch("population", value)}
        placeholder="Exemple : Les agents et cadres opérationnels de la Société Nationale des Chemins de fer du Congo (SNCC) basés à Lubumbashi..."
        savedLabel="Population enregistrée"
      />

      {/* Exemples inspirants */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          <span>Exemples de formulations :</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {examples.map((example, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => updateCurrentResearch("population", example)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-acadia-blue hover:text-acadia-blue transition text-left"
            >
              + {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}