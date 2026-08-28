"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";
import { computeResearchProgress } from "@/lib/core/dashboard/ResearchProgressEngine";

export default function ProgressGoals() {
  const { researches, projects, instruments, theoreticalFramework, exportHistory } = useResearch();

  const active = [...researches]
    .filter((r) => projects[r.id])
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  if (!active) {
    return (
      <section className="mt-16">
        <div className="rounded-[32px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Progression</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Aucune recherche en cours</h2>
          <p className="mx-auto mt-3 max-w-md text-slate-500">
            Créez votre première recherche pour voir apparaître ici sa progression réelle.
          </p>
          <Link
            href="/dashboard/research/new"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Nouvelle recherche
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  const project = projects[active.id];
  const progress = computeResearchProgress(
    project,
    theoreticalFramework[active.id] ?? [],
    instruments[active.id],
    (exportHistory[active.id]?.length ?? 0) > 0
  );

  return (
    <section className="mt-16">
      <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Progression</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">{active.title}</h2>
          </div>
          <div className="text-right">
            <h2 className="text-5xl font-black text-blue-600">{progress.percent}%</h2>
            <p className="text-slate-500">Préparation structurelle</p>
          </div>
        </div>

        <div className="mt-8 h-4 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        <div className="mt-10 space-y-5">
          {progress.steps.map((step) => {
            const isCurrent = progress.nextStep?.id === step.id;
            return (
              <div
                key={step.id}
                className="flex items-center justify-between rounded-2xl border border-slate-100 px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  {step.done ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <Circle className={`h-6 w-6 ${isCurrent ? "text-blue-600" : "text-slate-300"}`} />
                  )}
                  <span
                    className={`font-medium ${
                      step.done ? "text-slate-900" : isCurrent ? "text-blue-600" : "text-slate-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {isCurrent && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                    En cours
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {progress.nextStep && (
          <div className="mt-10 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <p className="text-sm uppercase tracking-wider text-blue-100">Prochaine étape</p>
            <h3 className="mt-2 text-2xl font-bold">{progress.nextStep.label}</h3>
            <Link
              href={progress.nextStep.href}
              className="mt-6 flex w-fit items-center gap-2 rounded-2xl bg-white px-6 py-3 font-semibold text-slate-900 transition hover:scale-105"
            >
              Continuer
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
