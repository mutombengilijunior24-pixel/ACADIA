"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useResearch } from "@/contexts/ResearchContext";
import { computeResearchProgress } from "@/lib/core/dashboard/ResearchProgressEngine";

export default function ProgressChart() {
  const { researches, projects, instruments, theoreticalFramework, exportHistory } = useResearch();

  const data = researches
    .map((research) => {
      const project = projects[research.id];
      if (!project) return null;
      const progress = computeResearchProgress(
        project,
        theoreticalFramework[research.id] ?? [],
        instruments[research.id],
        (exportHistory[research.id]?.length ?? 0) > 0
      );
      return {
        name: research.title.length > 14 ? `${research.title.slice(0, 14)}…` : research.title,
        progress: progress.percent,
      };
    })
    .filter((d): d is { name: string; progress: number } => d !== null);

  const averagePercent =
    data.length > 0 ? Math.round(data.reduce((sum, d) => sum + d.progress, 0) / data.length) : 0;

  return (
    <section className="mt-14">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-900">Progression de vos recherches</h2>
        <p className="mt-2 text-slate-500">
          Préparation structurelle réelle de chaque projet — jamais une note scientifique.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">Préparation par recherche</h3>

          {data.length === 0 ? (
            <p className="mt-8 text-sm text-slate-400">
              Aucune recherche structurée pour le moment.
            </p>
          ) : (
            <div className="mt-8 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(value) => [`${value}%`, "Préparation"]} />
                  <Bar dataKey="progress" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm uppercase tracking-wider text-slate-500">Recherches actives</p>
            <h2 className="mt-4 text-5xl font-black text-slate-900">{researches.length}</h2>
            <p className="mt-3 text-slate-500">
              {researches.length <= 1 ? "Projet créé sur ACADIA" : "Projets créés sur ACADIA"}
            </p>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm uppercase tracking-wider text-slate-500">Préparation moyenne</p>
            <h2 className="mt-4 text-5xl font-black text-slate-900">{averagePercent}%</h2>
            <div className="mt-8 h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600"
                style={{ width: `${averagePercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
