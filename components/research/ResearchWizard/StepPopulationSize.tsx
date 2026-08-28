"use client";

import { useResearch } from "@/contexts/ResearchContext";
import { Users, Calculator } from "lucide-react";
import ResearchStepHeader from "./brand/ResearchStepHeader";

export default function StepPopulationSize() {
  const { currentResearch, updateCurrentResearch, sample } = useResearch();

  const presets = [50, 120, 250, 500, 1000, 2500];

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={10}
        category="Terrain"
        title="Connaissez-vous l'effectif total de votre population (N) ?"
        description="Renseignez le nombre approximatif ou exact de personnes composant votre population mère. ACADIA calculera automatiquement la taille recommandée de votre échantillon."
      />

      {/* Saisie de la taille */}
      <div>
        <label htmlFor="population-size-input" className="block text-sm font-semibold text-acadia-navy mb-2">
          Effectif total estimé (N)
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
            <Users className="h-5 w-5" />
          </div>
          <input
            id="population-size-input"
            type="number"
            min="1"
            value={currentResearch.populationSize > 0 ? currentResearch.populationSize : ""}
            onChange={(e) => {
              const val = e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
              updateCurrentResearch("populationSize", val);
            }}
            placeholder="Exemple : 250"
            className="w-full rounded-2xl border border-slate-300 pl-12 pr-4 py-4 text-base sm:text-lg text-slate-900 placeholder:text-slate-400 focus:border-acadia-blue focus:outline-none focus:ring-3 focus:ring-acadia-blue/15 transition shadow-2xs"
          />
        </div>

        {/* Boutons pré-définis */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 mr-1">Raccourcis :</span>
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => updateCurrentResearch("populationSize", preset)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                currentResearch.populationSize === preset
                  ? "border-acadia-blue bg-acadia-blue-50 text-acadia-blue font-bold"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            onClick={() => updateCurrentResearch("populationSize", 0)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 transition"
          >
            Non connue
          </button>
        </div>
      </div>

      {/* Carte de calcul scientifique de l'échantillon */}
      <div className="rounded-2xl border border-acadia-navy/10 bg-acadia-navy p-5 sm:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-acadia-blue-light" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">
              Calcul de l'échantillon recommandé (n)
            </span>
          </div>

          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-2xs font-semibold text-acadia-blue-light">
            Niveau de confiance 95%
          </span>
        </div>

        {currentResearch.populationSize > 0 && sample?.sampleSize ? (
          <div className="flex items-baseline gap-3 pt-1">
            <span className="text-4xl font-extrabold tracking-tight text-white">
              {sample.sampleSize}
            </span>
            <span className="text-sm font-medium text-white/70">
              répondants recommandés sur un total de {currentResearch.populationSize} personnes
            </span>
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-white/70 leading-relaxed pt-1">
            Si la taille de la population n'est pas renseignée, la formule pour population indéterminée recommandera un échantillon standard (environ 384 répondants pour une marge d'erreur de 5%).
          </p>
        )}
      </div>
    </div>
  );
}