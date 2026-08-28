"use client";

import { useResearch } from "@/contexts/ResearchContext";
import { useState } from "react";
import ResearchStepHeader from "./brand/ResearchStepHeader";
import ResearchOptionCard from "./brand/ResearchOptionCard";

const domains = [
  { label: "Économie & Finance", icon: "📊" },
  { label: "Gestion & Management", icon: "💼" },
  { label: "Droit & Sciences Juridiques", icon: "⚖️" },
  { label: "Médecine & Santé Publique", icon: "🩺" },
  { label: "Informatique & SI", icon: "💻" },
  { label: "Agronomie & Environnement", icon: "🌱" },
  { label: "Sciences de l'Éducation", icon: "📚" },
  { label: "Sciences Politiques & Sociales", icon: "🏛️" },
  { label: "Psychologie & Comportement", icon: "🧠" },
  { label: "Autre domaine", icon: "➕" },
];

export default function StepDomain() {
  const { currentResearch, updateCurrentResearch } = useResearch();
  const [customDomain, setCustomDomain] = useState("");
  const isCustom = currentResearch.domain === "Autre domaine" || (Boolean(currentResearch.domain) && !domains.some(d => d.label === currentResearch.domain));

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={2}
        category="Cadrage"
        title="Dans quel domaine s'inscrit votre recherche ?"
        description="Le domaine permet à ACADIA de mobiliser les théories, variables et méthodes adaptées à votre champ disciplinaire."
      />

      {/* Grille de sélection */}
      <div className="grid gap-3 sm:grid-cols-2">
        {domains.map((item) => (
          <ResearchOptionCard
            key={item.label}
            title={item.label}
            emoji={item.icon}
            selected={currentResearch.domain === item.label}
            onClick={() => updateCurrentResearch("domain", item.label)}
          />
        ))}
      </div>

      {/* Champ personnalisé si "Autre" ou domaine spécifique */}
      {isCustom && (
        <div className="rounded-2xl border border-acadia-blue-100 bg-acadia-blue-50/60 p-4 space-y-2">
          <label htmlFor="custom-domain-input" className="block text-xs font-semibold text-acadia-navy">
            Précisez votre domaine disciplinaire :
          </label>
          <input
            id="custom-domain-input"
            type="text"
            value={customDomain || (currentResearch.domain !== "Autre domaine" ? currentResearch.domain : "")}
            onChange={(e) => {
              setCustomDomain(e.target.value);
              updateCurrentResearch("domain", e.target.value || "Autre domaine");
            }}
            placeholder="Exemple : Sciences de l'information et de la communication"
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-acadia-blue focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}