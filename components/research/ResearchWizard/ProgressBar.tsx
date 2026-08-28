"use client";

import ResearchBrand from "./brand/ResearchBrand";

interface Props {
  currentStep: number;
  totalSteps: number;
}

export const STEP_METADATA = [
  { index: 0, title: "Introduction", category: "Accueil" },
  { index: 1, title: "Sujet de recherche", category: "Cadrage" },
  { index: 2, title: "Domaine disciplinaire", category: "Cadrage" },
  { index: 3, title: "Niveau académique", category: "Cadrage" },
  { index: 4, title: "Institution", category: "Cadrage" },
  { index: 5, title: "Type de recherche", category: "Méthodologie" },
  { index: 6, title: "Problématique", category: "Objectifs" },
  { index: 7, title: "Objectif général", category: "Objectifs" },
  { index: 8, title: "Objectifs spécifiques", category: "Objectifs" },
  { index: 9, title: "Population d'étude", category: "Terrain" },
  { index: 10, title: "Taille de la population", category: "Terrain" },
  { index: 11, title: "Cadre géographique", category: "Terrain" },
  { index: 12, title: "Méthode de collecte", category: "Collecte" },
  { index: 13, title: "Synthèse méthodologique", category: "Recommandations" },
  { index: 14, title: "Validation finale", category: "Finalisation" },
];

export default function ProgressBar({ currentStep, totalSteps }: Props) {
  const current = Math.min(Math.max(currentStep, 0), totalSteps - 1);
  const percentage = Math.round(((current + 1) / totalSteps) * 100);
  const currentMeta = STEP_METADATA[current] ?? {
    title: `Étape ${current + 1}`,
    category: "Parcours",
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm shadow-slate-900/5">
      <div className="flex items-center justify-between gap-4">
        {/* Identité ACADIA + infos de l'étape actuelle */}
        <div className="flex min-w-0 items-center gap-3">
          <ResearchBrand variant="compact" className="hidden sm:inline-block" />
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex shrink-0 items-center rounded-lg border border-acadia-blue-100 bg-acadia-blue-50 px-2.5 py-1 text-xs font-semibold text-acadia-blue">
              {currentMeta.category}
            </span>
            <span className="truncate text-sm font-semibold text-acadia-navy">
              {currentMeta.title}
            </span>
          </div>
        </div>

        {/* Compteur */}
        <div className="flex shrink-0 items-center gap-2.5 text-xs">
          <span className="font-medium text-slate-500">
            <strong className="text-acadia-navy">{current + 1}</strong>
            <span className="text-slate-400"> / {totalSteps}</span>
          </span>
          <span className="rounded-md border border-acadia-blue-100 bg-acadia-blue-50 px-2 py-0.5 text-xs font-bold text-acadia-blue">
            {percentage}%
          </span>
        </div>
      </div>

      {/* Barre de progression */}
      <div
        className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progression: ${percentage}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
            background: "linear-gradient(90deg, #2554EB, #0B1B3A)",
          }}
        />
      </div>

      {/* Dots mini navigation — visuel only */}
      <div className="mt-3 flex items-center gap-1">
        {STEP_METADATA.map((step) => (
          <div
            key={step.index}
            className="transition-all duration-300"
            style={{
              width: step.index === current ? "20px" : "6px",
              height: "6px",
              borderRadius: "99px",
              background:
                step.index < current
                  ? "#2554EB"
                  : step.index === current
                  ? "linear-gradient(90deg, #2554EB, #0B1B3A)"
                  : "#e2e8f0",
            }}
          />
        ))}
      </div>
    </div>
  );
}