"use client";

import { useResearch } from "@/contexts/ResearchContext";
import { ClipboardList, MessageSquare, Users, Eye, FileText } from "lucide-react";
import { useState } from "react";
import ResearchStepHeader from "./brand/ResearchStepHeader";
import ResearchOptionCard from "./brand/ResearchOptionCard";

const methods = [
  {
    id: "Questionnaire d'enquête",
    title: "Questionnaire d'enquête",
    icon: ClipboardList,
    desc: "Administration en ligne ou sur papier d'échelles de mesure et questions structurées.",
  },
  {
    id: "Entretiens semi-directifs",
    title: "Entretiens semi-directifs",
    icon: MessageSquare,
    desc: "Guide d'entretien qualitatif avec relances ouvertes et enregistrement des verbatims.",
  },
  {
    id: "Focus Groups",
    title: "Focus Groups (groupes de discussion)",
    icon: Users,
    desc: "Animation de tables rondes thématiques avec panels de répondants.",
  },
  {
    id: "Observation directe",
    title: "Observation directe systématique",
    icon: Eye,
    desc: "Grille d'observation de comportements ou de processus sur le terrain.",
  },
  {
    id: "Analyse documentaire",
    title: "Analyse documentaire & archives",
    icon: FileText,
    desc: "Exploitation de rapports, bilans, textes réglementaires ou bases secondaires.",
  },
];

export default function StepCollectionMethod() {
  const { currentResearch, updateCurrentResearch } = useResearch();
  const [customInput, setCustomInput] = useState("");
  const isCustom = Boolean(currentResearch.collectionMethod) && !methods.some(m => m.id === currentResearch.collectionMethod);

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={12}
        category="Collecte"
        title="Quelle est votre technique principale de collecte de données ?"
        description="Sélectionnez l'instrument ou le protocole empirique principal mobilisé pour recueillir vos données."
      />

      {/* Cartes de sélection */}
      <div className="space-y-3">
        {methods.map((method) => (
          <ResearchOptionCard
            key={method.id}
            icon={method.icon}
            title={method.title}
            description={method.desc}
            selected={currentResearch.collectionMethod === method.id}
            onClick={() => updateCurrentResearch("collectionMethod", method.id)}
          />
        ))}
      </div>

      {/* Autre méthode personnalisée */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2">
        <label htmlFor="custom-collection-method" className="block text-xs font-semibold text-slate-700">
          Ou saisissez une technique spécifique :
        </label>
        <div className="flex gap-2">
          <input
            id="custom-collection-method"
            type="text"
            value={customInput || (isCustom ? currentResearch.collectionMethod : "")}
            onChange={(e) => {
              setCustomInput(e.target.value);
              updateCurrentResearch("collectionMethod", e.target.value);
            }}
            placeholder="Exemple : Expérimentation en laboratoire avec pré-test / post-test"
            className="flex-1 rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-acadia-blue focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}