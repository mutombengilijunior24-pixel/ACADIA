"use client";

import { useResearch } from "@/contexts/ResearchContext";
import { Sparkles } from "lucide-react";
import ResearchStepHeader from "./brand/ResearchStepHeader";
import ResearchTextArea from "./brand/ResearchTextArea";

export default function StepObjective() {
  const { currentResearch, updateCurrentResearch } = useResearch();

  const actionVerbs = [
    "Analyser",
    "Évaluer",
    "Identifier",
    "Mesurer",
    "Démontrer",
    "Comprendre",
    "Comparer",
    "Modéliser",
  ];

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={7}
        category="Objectifs"
        title="Quel est l'objectif général de votre recherche ?"
        description="L'objectif général exprime le but global de votre étude. Il commence traditionnellement par un verbe d'action observable."
      />

      {/* Verbes d'action suggérés */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2.5">
          <Sparkles className="h-3.5 w-3.5 text-acadia-blue" />
          <span>Verbes d'action recommandés :</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {actionVerbs.map((verb) => (
            <button
              key={verb}
              type="button"
              onClick={() => {
                if (!currentResearch.objective.startsWith(verb)) {
                  updateCurrentResearch(
                    "objective",
                    currentResearch.objective
                      ? `${verb} ${currentResearch.objective.replace(/^[A-ZÀ-Ÿ][a-zà-ÿ]+\s+/i, "")}`
                      : `${verb} `
                  );
                }
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-acadia-blue hover:text-acadia-blue transition"
            >
              {verb}
            </button>
          ))}
        </div>
      </div>

      {/* Saisie de l'objectif */}
      <ResearchTextArea
        id="objective-textarea"
        label="Formulation de l'objectif général"
        required
        rows={5}
        value={currentResearch.objective}
        onChange={(value) => updateCurrentResearch("objective", value)}
        placeholder="Exemple : Analyser l'impact de la formation continue sur la productivité des agents techniques de la SNCC..."
        savedLabel="Objectif enregistré"
      />
    </div>
  );
}