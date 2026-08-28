"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

// ============================================================
// P13 — Aperçu produit du Hero : une simulation visuelle du
// cheminement ACADIA, jamais une simple capture statique. Animation
// discrète (avance automatique, transitions Tailwind) — aucune
// dépendance d'animation supplémentaire.
// ============================================================

const STEPS = [
  { label: "Sujet", detail: "Vous décrivez votre idée de recherche." },
  { label: "Variables", detail: "ACADIA structure vos variables et indicateurs." },
  { label: "Hypothèses", detail: "Des hypothèses cohérentes avec vos objectifs." },
  { label: "Méthodologie", detail: "Une approche et un design de recherche adaptés." },
  { label: "Données", detail: "Questionnaire, collecte et dataset préparés." },
  { label: "Économétrie", detail: "Analyses statistiques et modèle économétrique." },
  { label: "Mémoire", detail: "Votre travail scientifique structuré, prêt à réviser." },
];

const STEP_INTERVAL_MS = 1800;

export default function HeroFlowPreview() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % STEPS.length);
    }, STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-slate-100 p-4">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-3 w-3 rounded-full bg-amber-400" />
        <div className="h-3 w-3 rounded-full bg-emerald-400" />
        <p className="ml-2 text-xs font-semibold text-slate-400">Aperçu du cheminement ACADIA</p>
      </div>

      <div className="space-y-1.5 p-5">
        {STEPS.map((step, i) => {
          const isDone = i < activeIndex;
          const isActive = i === activeIndex;
          return (
            <div
              key={step.label}
              className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-all duration-500 ${
                isActive ? "bg-acadia-blue-50 ring-1 ring-acadia-blue/30" : "bg-transparent"
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ${
                  isDone
                    ? "bg-emerald-500 text-white"
                    : isActive
                    ? "text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
                style={isActive ? { background: "linear-gradient(135deg, #2554EB 0%, #0B1B3A 130%)" } : undefined}
              >
                {isDone ? <CheckCircle2 className="h-4.5 w-4.5" /> : i + 1}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold transition-colors duration-500 ${isActive ? "text-acadia-navy" : "text-slate-500"}`}>
                  {step.label}
                </p>
                {isActive && <p className="mt-0.5 text-xs text-slate-500">{step.detail}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
