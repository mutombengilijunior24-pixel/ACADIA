"use client";

import { useResearch } from "@/contexts/ResearchContext";
import { MapPin, CheckCircle2 } from "lucide-react";
import ResearchStepHeader from "./brand/ResearchStepHeader";

export default function StepLocation() {
  const { currentResearch, updateCurrentResearch } = useResearch();

  const suggestions = [
    "Lubumbashi, RDC",
    "Kinshasa, RDC",
    "Kolwezi, RDC",
    "Goma, RDC",
    "Dakar, Sénégal",
    "Abidjan, Côte d'Ivoire",
    "Paris, France",
    "En ligne / International",
  ];

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={11}
        category="Terrain"
        title="Où se déroule votre étude (champ spatial) ?"
        description="Précisez la ville, région, pays ou l'entité territoriale dans laquelle les données seront collectées."
      />

      {/* Saisie de la localisation */}
      <div>
        <label htmlFor="location-input" className="block text-sm font-semibold text-acadia-navy mb-2">
          Lieu ou champ d'application <span className="text-acadia-blue">*</span>
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
            <MapPin className="h-5 w-5" />
          </div>
          <input
            id="location-input"
            type="text"
            value={currentResearch.location}
            onChange={(e) => updateCurrentResearch("location", e.target.value)}
            placeholder="Exemple : Lubumbashi, Province du Haut-Katanga, RDC"
            className="w-full rounded-2xl border border-slate-300 pl-12 pr-4 py-4 text-base sm:text-lg text-slate-900 placeholder:text-slate-400 focus:border-acadia-blue focus:outline-none focus:ring-3 focus:ring-acadia-blue/15 transition shadow-2xs"
          />
        </div>

        {currentResearch.location?.trim() && (
          <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Lieu enregistré
          </p>
        )}
      </div>

      {/* Suggestions rapides */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Suggestions :
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => updateCurrentResearch("location", suggestion)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-acadia-blue hover:text-acadia-blue transition"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}