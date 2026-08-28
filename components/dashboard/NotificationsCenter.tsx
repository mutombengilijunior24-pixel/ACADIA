"use client";

import Link from "next/link";
import { Bell, AlertTriangle, HelpCircle, XCircle, ArrowRight } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";
import { checkResearchConsistency } from "@/lib/core/research/ResearchConsistencyEngine";
import type { ConsistencySeverity } from "@/lib/core/research/ResearchConsistencyEngine";

const SEVERITY_ICON: Record<ConsistencySeverity, typeof AlertTriangle> = {
  pass: AlertTriangle,
  warning: AlertTriangle,
  needs_review: HelpCircle,
  error: XCircle,
};

const SEVERITY_COLOR: Record<ConsistencySeverity, string> = {
  pass: "bg-slate-100 text-slate-600",
  warning: "bg-amber-100 text-amber-600",
  needs_review: "bg-acadia-blue-50 text-acadia-blue",
  error: "bg-rose-100 text-rose-600",
};

export default function NotificationsCenter() {
  const { researches, projects, theoreticalFramework } = useResearch();

  const points: { key: string; title: string; researchTitle: string; researchId: string; severity: ConsistencySeverity }[] = [];

  for (const research of researches) {
    const project = projects[research.id];
    if (!project) continue;
    const result = checkResearchConsistency(project, theoreticalFramework[research.id] ?? []);
    for (const check of result.checks.filter((c) => c.severity !== "pass")) {
      points.push({
        key: `${research.id}-${check.id}`,
        title: check.message,
        researchTitle: research.title,
        researchId: research.id,
        severity: check.severity,
      });
    }
  }

  const shown = points.slice(0, 6);

  return (
    <section className="mt-16">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-blue-600" />
            <h2 className="text-3xl font-black text-slate-900">Points d&apos;attention</h2>
          </div>
          <p className="mt-2 text-slate-500">
            Éléments à structurer, détectés dans vos recherches réelles — jamais une alerte inventée.
          </p>
        </div>
        {shown.length > 0 && (
          <span className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white">
            {shown.length}
          </span>
        )}
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Rien à signaler pour le moment.
          </p>
        ) : (
          <div className="space-y-6">
            {shown.map((item) => {
              const Icon = SEVERITY_ICON[item.severity];
              return (
                <div
                  key={item.key}
                  className="group flex items-center justify-between rounded-3xl border border-slate-100 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                >
                  <div className="flex items-center gap-5">
                    <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${SEVERITY_COLOR[item.severity]}`}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{item.title}</h3>
                      <p className="mt-2 text-slate-500">{item.researchTitle}</p>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/research/${item.researchId}`}
                    className="flex items-center gap-2 font-semibold text-blue-600 transition group-hover:gap-3"
                  >
                    Voir
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
