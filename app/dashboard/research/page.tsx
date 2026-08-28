"use client";

// ============================================================
// ACADIA — MES RECHERCHES (reprendre son travail)
//
// Remplace un stub statique ("module en cours de construction")
// qui laissait l'utilisateur dans une impasse : la sidebar et les
// actions rapides du dashboard promettent déjà "Reprendre une
// recherche en cours" vers cette route, mais aucune liste réelle
// n'existait derrière ce lien. Réutilise exactement les données et
// le moteur de progression déjà utilisés par ProgressChart —
// jamais un pourcentage ou une étape inventée.
// ============================================================

import Link from "next/link";
import { useResearch } from "@/contexts/ResearchContext";
import { computeResearchProgress } from "@/lib/core/dashboard/ResearchProgressEngine";
import { FilePlus2, FolderSearch, CheckCircle2, Circle, ArrowRight } from "lucide-react";

export default function ResearchPage() {
  const { researches, projects, instruments, theoreticalFramework, exportHistory } = useResearch();

  const items = researches
    .map((research) => {
      const project = projects[research.id];
      if (!project) return null;
      const progress = computeResearchProgress(
        project,
        theoreticalFramework[research.id] ?? [],
        instruments[research.id],
        (exportHistory[research.id]?.length ?? 0) > 0
      );
      return { research, progress };
    })
    .filter((item): item is { research: typeof researches[number]; progress: ReturnType<typeof computeResearchProgress> } => item !== null)
    .sort((a, b) => new Date(b.research.updatedAt).getTime() - new Date(a.research.updatedAt).getTime());

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue sm:text-sm">ACADIA — Mes recherches</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Reprendre mon travail</h1>
          </div>
          <Link
            href="/dashboard/research/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-acadia-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-acadia-blue-dark"
          >
            <FilePlus2 className="h-4 w-4" /> Nouvelle recherche
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <FolderSearch className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-4 font-semibold text-slate-700">Aucune recherche pour le moment.</p>
            <p className="mt-1 text-sm text-slate-500">Démarrez votre premier travail avec l&apos;assistant ACADIA.</p>
            <Link
              href="/dashboard/research/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-acadia-blue-dark"
            >
              <FilePlus2 className="h-4 w-4" /> Commencer ma recherche
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {items.map(({ research, progress }) => (
              <div key={research.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">{research.title || "Recherche sans titre"}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Mis à jour le {new Date(research.updatedAt).toLocaleDateString("fr-FR")}
                </p>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-500">Progression</span>
                  <span className="font-bold text-acadia-blue">{progress.percent}%</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-acadia-blue" style={{ width: `${progress.percent}%` }} />
                </div>

                <ul className="mt-4 space-y-1.5">
                  {progress.steps.map((step) => (
                    <li key={step.id} className="flex items-center gap-2 text-xs">
                      {step.done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      )}
                      <span className={step.done ? "text-slate-500 line-through decoration-slate-300" : "text-slate-700"}>
                        {step.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={progress.nextStep?.href ?? `/dashboard/research/${research.id}`}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-acadia-blue"
                >
                  Continuer <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
