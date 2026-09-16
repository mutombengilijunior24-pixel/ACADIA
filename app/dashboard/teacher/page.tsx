"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, ClipboardList, FileCheck2, Inbox, RotateCcw, GraduationCap } from "lucide-react";
import StatsCard from "@/components/dashboard/StatsCard";
import { formatDate } from "@/components/teacher/teacherLabels";

interface DashboardSummary {
  assignmentCounts: Record<string, number>;
  submissionCounts: Record<string, number>;
  courses: { id: string; name: string; cohortName: string }[];
  recentSubmissions: { id: string; assignmentId: string; assignmentTitle: string; studentName: string; status: string; submittedAt: string | null }[];
}

export default function TeacherDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/assessment/teacher/dashboard");
        if (!res.ok) throw new Error("request_failed");
        const data = await res.json();
        if (!cancelled) setSummary(data.summary);
      } catch {
        if (!cancelled) setError("Impossible de charger votre espace enseignant.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl text-center text-slate-400">Chargement...</div>
      </div>
    );
  }

  const toGrade = summary.submissionCounts.submitted + summary.submissionCounts.under_review;
  const hasAnyActivity = Object.values(summary.assignmentCounts).some((n) => n > 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Espace enseignant</p>
          <h1 className="mt-1 text-2xl font-bold text-acadia-navy sm:text-3xl">Mon cockpit de correction</h1>
        </div>

        {!hasAnyActivity && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Vous n&apos;avez encore aucun TP.</p>
            <p className="mt-1 text-sm text-slate-400">Les TP créés depuis vos cours apparaîtront ici.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="À corriger" value={String(toGrade)} icon={<Inbox className="h-7 w-7 text-white" />} color="bg-rose-500" />
          <StatsCard title="En revue" value={String(summary.submissionCounts.under_review)} icon={<ClipboardCheck className="h-7 w-7 text-white" />} color="bg-amber-500" />
          <StatsCard title="Corrigées" value={String(summary.submissionCounts.graded)} icon={<FileCheck2 className="h-7 w-7 text-white" />} color="bg-emerald-500" />
          <StatsCard title="Retournées" value={String(summary.submissionCounts.returned)} icon={<RotateCcw className="h-7 w-7 text-white" />} color="bg-blue-500" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Mes TP</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Brouillons</dt><dd className="font-semibold text-slate-900">{summary.assignmentCounts.draft}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Actifs</dt><dd className="font-semibold text-slate-900">{summary.assignmentCounts.published}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Terminés</dt><dd className="font-semibold text-slate-900">{summary.assignmentCounts.closed}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Archivés</dt><dd className="font-semibold text-slate-900">{summary.assignmentCounts.archived}</dd></div>
            </dl>
            <Link href="/dashboard/teacher/assignments" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-acadia-blue hover:underline">
              <ClipboardList className="h-4 w-4" /> Voir tous mes TP
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Mes cours</h2>
            {summary.courses.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">Vous n&apos;êtes rattaché à aucun cours.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {summary.courses.map((c) => (
                  <li key={c.id} className="rounded-xl border border-slate-100 px-3 py-2">
                    <p className="font-semibold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.cohortName}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Activité récente</h2>
            {summary.recentSubmissions.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">Aucune soumission reçue pour l&apos;instant.</p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm">
                {summary.recentSubmissions.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <Link href={`/dashboard/teacher/submissions/${s.id}`} className="block rounded-xl px-2 py-1.5 hover:bg-slate-50">
                      <p className="truncate font-medium text-slate-800">{s.studentName}</p>
                      <p className="truncate text-xs text-slate-400">{s.assignmentTitle} · {formatDate(s.submittedAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
