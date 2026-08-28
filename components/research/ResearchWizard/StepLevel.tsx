"use client";

import { useResearch } from "@/contexts/ResearchContext";
import ResearchStepHeader from "./brand/ResearchStepHeader";
import ResearchOptionCard from "./brand/ResearchOptionCard";
import { GraduationCap } from "lucide-react";

const levels = [
  {
    id: "Licence",
    title: "Licence / Bachelor (Bac+3)",
    description: "Travail de fin de cycle, rapport de recherche ou projet tuteuré.",
  },
  {
    id: "Master",
    title: "Master / DEA / DESS (Bac+5)",
    description: "Mémoire de recherche universitaire, thèse d'exercice ou mémoire professionnel.",
  },
  {
    id: "Doctorat",
    title: "Doctorat / PhD (Bac+8)",
    description: "Thèse doctorale, recherche académique approfondie et contribution originale.",
  },
  {
    id: "Projet professionnel",
    title: "Recherche appliquée / Projet professionnel",
    description: "Étude d'organisation, recherche-action, rapport d'expertise ou R&D.",
  },
];

export default function StepLevel() {
  const { currentResearch, updateCurrentResearch } = useResearch();

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={3}
        category="Cadrage"
        title="Quel est votre niveau d'études ou cadre de recherche ?"
        description="Cette indication permet à ACADIA de calibrer la rigueur méthodologique et le niveau d'exigence des recommandations."
      />

      {/* Cartes de sélection */}
      <div className="space-y-3">
        {levels.map((level) => (
          <ResearchOptionCard
            key={level.id}
            icon={GraduationCap}
            title={level.title}
            description={level.description}
            selected={currentResearch.level === level.id}
            onClick={() => updateCurrentResearch("level", level.id)}
          />
        ))}
      </div>
    </div>
  );
}