"use client";

// ============================================================
// ACADIA — PROGRESSION EN 6 GRANDES ÉTAPES (MVP simplification, 10/09/2026)
//
// Couche UX au-dessus de l'existant : ne remplace aucune des étapes
// internes (les 15 écrans du wizard, les sections de cette page
// restent inchangées) — répond juste à "où suis-je / où vais-je /
// quelle est ma prochaine action". Un stade n'est jamais marqué
// "fait" sans preuve réelle dans l'état du projet (jamais de
// progression inventée).
// ============================================================

import { CheckCircle2, Circle, Clock } from "lucide-react";

export type StageStatus = "done" | "current" | "upcoming";

export interface ResearchStage {
  key: string;
  label: string;
  status: StageStatus;
  sectionId?: string;
}

export default function ResearchStageProgress({
  stages,
  onNavigate,
}: {
  stages: ResearchStage[];
  onNavigate: (sectionId: string) => void;
}) {
  const currentIndex = stages.findIndex((s) => s.status === "current");
  const nextAction = currentIndex >= 0 ? stages[currentIndex] : stages.find((s) => s.status === "upcoming");

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Votre recherche</p>
          {nextAction && (
            <p className="mt-1 text-sm text-slate-600">
              Prochaine étape : <span className="font-semibold text-acadia-navy">{nextAction.label}</span>
            </p>
          )}
        </div>
        {nextAction?.sectionId && (
          <button
            type="button"
            onClick={() => onNavigate(nextAction.sectionId!)}
            className="rounded-xl bg-acadia-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
          >
            Continuer
          </button>
        )}
      </div>

      <ol className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-2">
        {stages.map((stage, i) => {
          const clickable = Boolean(stage.sectionId);
          const Icon = stage.status === "done" ? CheckCircle2 : stage.status === "current" ? Clock : Circle;
          return (
            <li key={stage.key} className="flex-1">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => stage.sectionId && onNavigate(stage.sectionId)}
                className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-xs sm:flex-col sm:items-start sm:gap-1.5 ${
                  stage.status === "done"
                    ? "border-emerald-200 bg-emerald-50/60"
                    : stage.status === "current"
                      ? "border-acadia-blue-200 bg-acadia-blue-50/60"
                      : "border-slate-200 bg-slate-50/60"
                } ${clickable ? "cursor-pointer hover:brightness-95" : "cursor-default opacity-70"}`}
              >
                <span className="flex items-center gap-1.5 font-mono text-2xs text-slate-400">
                  <Icon
                    className={`h-3.5 w-3.5 ${
                      stage.status === "done" ? "text-emerald-600" : stage.status === "current" ? "text-acadia-blue" : "text-slate-400"
                    }`}
                  />
                  {i + 1}
                </span>
                <span
                  className={`font-semibold ${
                    stage.status === "upcoming" ? "text-slate-500" : "text-acadia-navy"
                  }`}
                >
                  {stage.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
