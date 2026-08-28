"use client";

import { useResearch } from "@/contexts/ResearchContext";
import { BarChart3, MessageSquareText, GitMerge, Check } from "lucide-react";
import ResearchStepHeader from "./brand/ResearchStepHeader";

const researchTypes = [
  {
    value: "Quantitative",
    title: "Recherche Quantitative",
    icon: BarChart3,
    badge: "Mesure & Statistiques",
    description:
      "Étude basée principalement sur des variables mesurables, des questionnaires structurés, des hypothèses testables et des analyses statistiques descriptives ou inférentielles.",
    traits: ["Échantillons représentatifs", "Questionnaires & Échelles", "Tests d'hypothèses"],
  },
  {
    value: "Qualitative",
    title: "Recherche Qualitative",
    icon: MessageSquareText,
    badge: "Compréhension & Sens",
    description:
      "Étude exploratoire ou compréhensive visant à appréhender en profondeur les représentations, perceptions, discours, comportements ou processus sociaux.",
    traits: ["Entretiens semi-directifs", "Analyse de contenu thématique", "Échantillonnage ciblé"],
  },
  {
    value: "Mixte",
    title: "Recherche Mixte",
    icon: GitMerge,
    badge: "Approche Triangulée",
    description:
      "Combinaison raisonnée d'une phase qualitative et d'une phase quantitative afin d'enrichir la mesure statistique par une compréhension approfondie des mécanismes sous-jacents.",
    traits: ["Triangulation méthodologique", "Complémentarité des données", "Richesse d'analyse"],
  },
];

export default function StepResearchType() {
  const { currentResearch, updateCurrentResearch } = useResearch();

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={5}
        category="Méthodologie"
        title="Quel type de recherche réalisez-vous ?"
        description="Ce choix oriente la posture épistémologique, la structuration des variables et les instruments de collecte préconisés par ACADIA."
        guidance={{ title: "Comment choisir mon type de recherche ?", triggerLabel: "Comment choisir ?" }}
      />

      {/* Cartes interactives */}
      <div className="space-y-4">
        {researchTypes.map((type) => {
          const isSelected = currentResearch.researchType === type.value;
          const Icon = type.icon;

          return (
            <button
              key={type.value}
              type="button"
              onClick={() => updateCurrentResearch("researchType", type.value)}
              className={`w-full rounded-2xl border p-5 sm:p-6 text-left transition-all duration-150 ${
                isSelected
                  ? "border-acadia-blue bg-acadia-blue-50 shadow-xs ring-1 ring-acadia-blue/30"
                  : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isSelected ? "bg-acadia-blue text-white" : "bg-slate-100 text-slate-600"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className={`text-base sm:text-lg font-bold ${isSelected ? "text-acadia-navy" : "text-slate-900"}`}>
                      {type.title}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {type.badge}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
                    {type.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {type.traits.map((trait, tIdx) => (
                      <span
                        key={tIdx}
                        className={`rounded-md px-2 py-0.5 text-2xs font-medium ${
                          isSelected ? "bg-acadia-blue-100/70 text-acadia-navy" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        ✓ {trait}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                    isSelected
                      ? "border-acadia-blue bg-acadia-blue text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}