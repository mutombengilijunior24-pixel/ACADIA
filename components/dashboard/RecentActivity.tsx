"use client";

import { FileDown, FolderPlus } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";

type ActivityItem = {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  date: Date;
};

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH} h`;
  const diffDays = Math.round(diffH / 24);
  return `Il y a ${diffDays} j`;
}

export default function RecentActivity() {
  const { researches, exportHistory } = useResearch();

  const items: ActivityItem[] = [];

  for (const research of researches) {
    items.push({
      key: `research-${research.id}`,
      icon: <FolderPlus className="h-5 w-5 text-blue-600" />,
      title: research.title || "Recherche sans titre",
      description: research.status === "draft" ? "Mise à jour du projet" : "Projet",
      date: new Date(research.updatedAt),
    });
  }

  for (const [researchId, entries] of Object.entries(exportHistory)) {
    const research = researches.find((r) => r.id === researchId);
    for (const entry of entries) {
      items.push({
        key: `export-${entry.id}`,
        icon: <FileDown className="h-5 w-5 text-orange-600" />,
        title: `Document exporté (${entry.format.toUpperCase()})`,
        description: `${entry.fileName} — ${research?.title ?? "recherche"}`,
        date: new Date(entry.generatedAt),
      });
    }
  }

  items.sort((a, b) => b.date.getTime() - a.date.getTime());
  const recent = items.slice(0, 6);

  return (
    <section className="mt-14">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-900">Activités récentes</h2>
        <p className="mt-2 text-slate-500">Vos dernières actions réelles sur ACADIA.</p>
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Aucune activité pour le moment — créez une recherche pour commencer.
          </p>
        ) : (
          <div className="space-y-6">
            {recent.map((activity) => (
              <div
                key={activity.key}
                className="flex items-center justify-between rounded-2xl border border-slate-100 p-5 transition hover:bg-slate-50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                    {activity.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{activity.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{activity.description}</p>
                  </div>
                </div>
                <p className="text-right text-sm font-semibold text-slate-500">
                  {formatRelative(activity.date)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
