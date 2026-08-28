"use client";

import { useResearch } from "@/contexts/ResearchContext";
import { Lightbulb } from "lucide-react";
import ResearchStepHeader from "./brand/ResearchStepHeader";
import ResearchTextArea from "./brand/ResearchTextArea";

export default function StepTitle() {
  const { currentResearch, updateCurrentResearch } = useResearch();

  const examples = [
    "Impact de la transformation digitale sur la performance organisationnelle des PME",
    "Déterminants de l'adoption des services bancaires mobiles chez les jeunes actifs",
    "Facteurs psychosociaux influençant l'adhésion thérapeutique chez les patients chroniques",
  ];

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={1}
        category="Cadrage"
        title="Décrivez votre sujet de recherche"
        description="Formulez votre idée de recherche. Un bon sujet identifie généralement le phénomène étudié et le contexte ou groupe d'intérêt."
      />

      {/* Zone de rédaction */}
      <ResearchTextArea
        id="research-title"
        label="Intitulé ou formulation du sujet"
        required
        rows={4}
        value={currentResearch.title}
        onChange={(value) => updateCurrentResearch("title", value)}
        placeholder="Exemple : Analyse de l'impact de la gestion des compétences sur l'engagement des collaborateurs..."
      />

      {/* Suggestions / Exemples */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span>Exemples de formulations pour vous inspirer :</span>
        </div>
        <div className="mt-3 space-y-2">
          {examples.map((example, index) => (
            <button
              key={index}
              type="button"
              onClick={() => updateCurrentResearch("title", example)}
              className="w-full text-left rounded-xl bg-white border border-slate-200/80 p-3 text-xs sm:text-sm text-slate-700 hover:border-acadia-blue hover:text-acadia-blue transition"
            >
              « {example} »
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}