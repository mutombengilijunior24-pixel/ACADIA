"use client";

import type { ScientificWorkReadiness as Readiness } from "@/lib/core/scientific-work/ScientificWorkTypes";

const STYLES: Record<Readiness["level"], string> = {
  incomplete: "bg-red-50 text-red-700",
  in_preparation: "bg-amber-50 text-amber-700",
  almost_ready: "bg-acadia-blue-50 text-acadia-blue",
  ready_for_review: "bg-emerald-50 text-emerald-700",
};

export default function ScientificWorkReadiness({ readiness }: { readiness: Readiness }) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Readiness scientifique</p>
          <p className="mt-1 text-2xl font-extrabold text-acadia-navy">
            {readiness.score}
            <span className="text-sm font-medium text-slate-400"> / 100</span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${STYLES[readiness.level]}`}>{readiness.label}</span>
      </div>
      <p className="mt-2 text-2xs text-slate-400">
        « Prêt » signifie que la structure est suffisamment complète pour être révisée par le chercheur — jamais
        que le travail est scientifiquement validé.
      </p>
    </div>
  );
}
