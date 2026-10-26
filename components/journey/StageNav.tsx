"use client";

import { useEffect, useRef } from "react";
import { Check, CircleDot, RotateCcw } from "lucide-react";

import { buttonClass } from "@/components/data/ui";
import { STEP_STATE_LABELS, type StepState } from "@/lib/core/journey/steps";

/** Barre des six étapes visibles d'un moteur : état de chaque étape, progression et prochaine action. */
export function StageNav({
  label,
  stages,
  activeStageId,
  nextAction,
  onGo,
  goCurrent,
}: {
  label: string;
  stages: Array<{ id: string; label: string; state: StepState }>;
  activeStageId: string;
  nextAction: string;
  onGo: (stageId: string) => void;
  goCurrent?: { label: string; onClick: () => void } | null;
}) {
  const listRef = useRef<HTMLOListElement | null>(null);
  const activeIndex = Math.max(0, stages.findIndex((s) => s.id === activeStageId));
  const doneCount = stages.filter((s) => s.state === "done").length;
  useEffect(() => {
    // Sur téléphone, l'étape active reste visible dans la barre défilante.
    listRef.current?.querySelector<HTMLElement>(`[data-stage="${activeStageId}"]`)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeStageId]);
  return (
    <nav aria-label={label} className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center gap-3 px-1">
        <p className="text-sm font-semibold text-slate-900">
          Étape {activeIndex + 1} sur {stages.length} · {stages[activeIndex]?.label}
        </p>
        <div className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all" style={{ width: `${(doneCount / stages.length) * 100}%` }} />
        </div>
        <span className="text-xs font-semibold tabular-nums text-slate-500">
          {doneCount} / {stages.length} confirmées
        </span>
      </div>
      <ol ref={listRef} className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-6 lg:overflow-visible">
        {stages.map((stage, index) => {
          const isActive = stage.id === activeStageId;
          const tone = isActive ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/20" : stage.state === "done" ? "bg-emerald-50 text-emerald-900 hover:bg-emerald-100" : stage.state === "stale" ? "bg-amber-50 text-amber-900 hover:bg-amber-100" : stage.state === "current" ? "bg-teal-50 text-teal-900 ring-1 ring-teal-200 hover:bg-teal-100" : "bg-slate-50 text-slate-500";
          const content = (
            <>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isActive ? "bg-white/25 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`} aria-hidden>
                {stage.state === "done" ? <Check size={14} /> : stage.state === "stale" ? <RotateCcw size={13} /> : stage.state === "current" && !isActive ? <CircleDot size={14} /> : index + 1}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-sm font-semibold">{stage.label}</span>
                <span className={`block text-[11px] font-medium ${isActive ? "text-emerald-100" : "opacity-75"}`}>{STEP_STATE_LABELS[stage.state]}</span>
              </span>
            </>
          );
          return (
            <li key={stage.id} data-stage={stage.id} className="min-w-[9.5rem] snap-start lg:min-w-0">
              {stage.state === "todo" ? (
                <div className={`flex min-h-14 w-full items-center gap-2 rounded-xl px-2.5 ${tone}`} title="Étape disponible après les étapes précédentes">
                  {content}
                </div>
              ) : (
                <button type="button" aria-current={isActive ? "step" : undefined} onClick={() => onGo(stage.id)} className={`flex min-h-14 w-full items-center gap-2 rounded-xl px-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${tone}`}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between" role="status">
        <p className="min-w-0 sm:flex-1">
          <span className="font-semibold">Prochaine action : </span>
          {nextAction}
        </p>
        {goCurrent ? (
          <button type="button" className={buttonClass.secondary} onClick={goCurrent.onClick}>
            {goCurrent.label}
          </button>
        ) : null}
      </div>
    </nav>
  );
}
