"use client";

import { useResearch } from "@/contexts/ResearchContext";
import { CheckCircle2, CircleDashed, FileSpreadsheet, Layers, MapPin, Target, Users } from "lucide-react";

export default function LiveSummary() {
  const { currentResearch } = useResearch();

  const sections = [
    {
      title: "Cadrage initial",
      icon: Layers,
      items: [
        { label: "Sujet", value: currentResearch.title },
        { label: "Domaine", value: currentResearch.domain },
        { label: "Niveau", value: currentResearch.level },
        { label: "Institution", value: currentResearch.university },
        { label: "Type", value: currentResearch.researchType },
      ],
    },
    {
      title: "Problématique & Objectifs",
      icon: Target,
      items: [
        { label: "Problématique", value: currentResearch.problem },
        { label: "Objectif général", value: currentResearch.objective },
        {
          label: "Obj. spécifiques",
          value:
            currentResearch.objectives && currentResearch.objectives.length > 0
              ? `${currentResearch.objectives.length} objectif(s)`
              : "",
        },
      ],
    },
    {
      title: "Terrain & Collecte",
      icon: Users,
      items: [
        { label: "Population", value: currentResearch.population },
        {
          label: "Taille estimée",
          value:
            currentResearch.populationSize > 0
              ? `${currentResearch.populationSize} personnes`
              : "",
        },
        { label: "Lieu", value: currentResearch.location },
        { label: "Collecte", value: currentResearch.collectionMethod },
      ],
    },
  ];

  // Calcul du nombre d'informations complétées
  const totalFields = sections.reduce(
    (acc, sec) => acc + sec.items.length,
    0
  );
  const completedFields = sections.reduce(
    (acc, sec) =>
      acc + sec.items.filter((item) => Boolean(item.value?.trim())).length,
    0
  );

  return (
    <aside className="shadow-xs sticky top-8 rounded-3xl border border-slate-200/80 bg-white p-6">
      {/* En-tête du résumé */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="text-2xs font-bold tracking-[0.14em] text-acadia-blue uppercase">
            Research Snapshot
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-acadia-navy">
            Votre recherche prend forme
          </h2>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-acadia-navy px-3 py-1 text-xs font-semibold text-white">
          <span className="font-bold text-acadia-blue-light">{completedFields}</span>
          <span className="text-white/40">/</span>
          <span>{totalFields}</span>
        </div>
      </div>

      {/* Sections du résumé */}
      <div className="mt-5 space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        {sections.map((section, idx) => {
          const SectionIcon = section.icon;
          return (
            <div key={idx} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <SectionIcon className="h-3.5 w-3.5 text-slate-400" />
                <span>{section.title}</span>
              </div>

              <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                {section.items.map((item, itemIdx) => {
                  const isFilled = Boolean(item.value?.trim());
                  return (
                    <div
                      key={itemIdx}
                      className="flex items-start justify-between gap-3 text-xs"
                    >
                      <span className="shrink-0 font-medium text-slate-500">
                        {item.label}
                      </span>
                      <div className="flex min-w-0 items-center gap-1.5 text-right">
                        {isFilled ? (
                          <>
                            <span className="max-w-[140px] truncate font-semibold text-acadia-navy sm:max-w-[180px]">
                              {item.value}
                            </span>
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-acadia-blue" />
                          </>
                        ) : (
                          <>
                            <span className="text-slate-400 italic">À définir</span>
                            <CircleDashed className="h-3 w-3 shrink-0 text-slate-300" />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}