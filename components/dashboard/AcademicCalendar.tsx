"use client";

import Link from "next/link";
import { CalendarDays, Clock3 } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";

const MONTHS = [
  "JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN",
  "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC",
];

export default function AcademicCalendar() {
  const { researches } = useResearch();

  const sorted = [...researches].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <section className="mt-16">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-blue-600" />
            <h2 className="text-3xl font-black text-slate-900">Dernières mises à jour</h2>
          </div>
          <p className="mt-2 text-slate-500">
            Dates réelles de vos recherches — ACADIA n&apos;a pas encore de calendrier d&apos;échéances.
          </p>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Aucune recherche pour le moment.</p>
        ) : (
          <div className="space-y-6">
            {sorted.slice(0, 4).map((research) => {
              const date = new Date(research.updatedAt);
              return (
                <Link
                  key={research.id}
                  href={`/dashboard/research/${research.id}`}
                  className="group flex items-center gap-5 rounded-3xl border border-slate-100 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                >
                  <div className="flex h-20 w-20 flex-col items-center justify-center rounded-3xl bg-blue-600 text-white shadow-lg">
                    <span className="text-3xl font-black">{date.getDate().toString().padStart(2, "0")}</span>
                    <span className="text-xs font-semibold tracking-wider">{MONTHS[date.getMonth()]}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{research.title || "Recherche sans titre"}</h3>
                    <div className="mt-3 flex items-center gap-2 text-slate-500">
                      <Clock3 className="h-4 w-4" />
                      {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
