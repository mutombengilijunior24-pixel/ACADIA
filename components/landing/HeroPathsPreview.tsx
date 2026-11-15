"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

// ============================================================
// Aperçu du Hero : les deux chemins d'ACADIA, animés pas à pas
// (récolter, puis interpréter). Aucune dépendance d'animation.
// ============================================================

const PATHS = [
  {
    name: "Récolter mes données",
    steps: [
      { label: "Questionnaire", detail: "Créé avec ACADIA, ou importé (Word, PDF, texte)." },
      { label: "Diffusion", detail: "Un lien à partager avec vos répondants." },
      { label: "Réponses", detail: "Centralisées, prêtes à être interprétées." },
    ],
  },
  {
    name: "Interpréter mes données",
    steps: [
      { label: "Fichier", detail: "Excel ou CSV : enquête, états financiers ou séries." },
      { label: "Analyses", detail: "Descriptives, tests, économétrie, selon votre spécialité." },
      { label: "Interprétation", detail: "Résultats expliqués, que vous validez avant de les garder." },
    ],
  },
];

const FLAT = PATHS.flatMap((p, pi) => p.steps.map((s, si) => ({ ...s, pi, si })));
const STEP_INTERVAL_MS = 1800;

export default function HeroPathsPreview() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive((i) => (i + 1) % FLAT.length), STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-slate-100 p-4">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-3 w-3 rounded-full bg-amber-400" />
        <div className="h-3 w-3 rounded-full bg-emerald-400" />
        <p className="ml-2 text-xs font-semibold text-slate-400">Les deux chemins d&apos;ACADIA</p>
      </div>

      <div className="space-y-5 p-5">
        {PATHS.map((path, pi) => (
          <div key={path.name}>
            <p className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">{path.name}</p>
            <div className="space-y-1">
              {path.steps.map((step, si) => {
                const index = FLAT.findIndex((f) => f.pi === pi && f.si === si);
                const isDone = index < active;
                const isActive = index === active;
                return (
                  <div
                    key={step.label}
                    className={`flex items-center gap-4 rounded-2xl px-4 py-3 transition-all duration-500 ${isActive ? "bg-acadia-blue-50 ring-1 ring-acadia-blue/30" : "bg-transparent"}`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ${
                        isDone ? "bg-emerald-500 text-white" : isActive ? "text-white" : "bg-slate-100 text-slate-400"
                      }`}
                      style={isActive ? { background: "linear-gradient(135deg, #2554EB 0%, #0B1B3A 130%)" } : undefined}
                    >
                      {isDone ? <CheckCircle2 className="h-4.5 w-4.5" /> : si + 1}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold transition-colors duration-500 ${isActive ? "text-acadia-navy" : "text-slate-500"}`}>{step.label}</p>
                      {isActive && <p className="mt-0.5 text-xs text-slate-500">{step.detail}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
