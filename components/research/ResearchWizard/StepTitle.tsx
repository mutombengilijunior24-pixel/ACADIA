"use client";

import { useResearch } from "@/contexts/ResearchContext";
import { Lightbulb } from "lucide-react";
import ResearchStepHeader from "./brand/ResearchStepHeader";
import ResearchTextArea from "./brand/ResearchTextArea";

const EXAMPLES = [
  "Impact du crédit bancaire sur la croissance des PME à Lubumbashi",
  "Déterminants de l'inflation en RDC de 2010 à 2024",
  "Effet de la motivation sur la performance des agents de la SNEL",
];

export default function StepTitle() {
  const { currentResearch, updateCurrentResearch } = useResearch();

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={0}
        category="Cadrage"
        title="Quel est votre sujet de recherche ?"
        description="Écrivez l'intitulé de votre travail tel que votre directeur l'a validé (ou tel que vous l'envisagez)."
      />

      <ResearchTextArea
        id="research-title"
        label="Intitulé du sujet"
        required
        rows={3}
        value={currentResearch.title}
        onChange={(value) => updateCurrentResearch("title", value)}
        placeholder="Exemple : Impact du crédit bancaire sur la croissance des PME à Lubumbashi"
      />

      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span>Exemples en sciences économiques et de gestion :</span>
        </div>
        <div className="mt-3 space-y-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => updateCurrentResearch("title", example)}
              className="w-full rounded-xl border border-slate-200/80 bg-white p-3 text-left text-xs text-slate-700 transition hover:border-acadia-blue hover:text-acadia-blue sm:text-sm"
            >
              « {example} »
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
