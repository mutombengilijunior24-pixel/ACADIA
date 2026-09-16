"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Inbox, BarChart3 } from "lucide-react";
import { ASSIGNMENT_STATUS_LABEL, formatDate } from "@/components/teacher/teacherLabels";

interface AssignmentOverview {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  courseName: string;
  cohortName: string;
  type: string;
  status: string;
  availableFrom: string | null;
  dueAt: string | null;
  questionCount: number;
  totalPoints: number;
  studentCount: number;
  submissionCount: number;
  gradedCount: number;
  publishable: boolean;
  validationErrors: string[];
  cohortJoinCode: string;
}

export default function AssignmentOverviewPage() {
  const params = useParams<{ id: string }>();
  const [overview, setOverview] = useState<AssignmentOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/assessment/assignments/${params.id}/overview`);
        if (!res.ok) {
          if (res.status === 403) throw new Error("Ce TP ne vous appartient pas.");
          if (res.status === 404) throw new Error("TP introuvable.");
          throw new Error("request_failed");
        }
        const data = await res.json();
        if (!cancelled) setOverview(data.overview);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.message !== "request_failed" ? e.message : "Impossible de charger ce TP.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl text-center text-slate-400">Chargement...</div>
      </div>
    );
  }

  const badge = ASSIGNMENT_STATUS_LABEL[overview.status] ?? { label: overview.status, className: "bg-slate-100 text-slate-600" };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/dashboard/teacher/assignments" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-acadia-blue">
          <ArrowLeft className="h-4 w-4" /> Mes TP
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-acadia-navy">{overview.title}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {overview.courseName} · {overview.cohortName}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {overview.availableFrom ? `Publié le ${formatDate(overview.availableFrom)}` : "Pas encore publié"}
                {overview.dueAt ? ` · Échéance le ${formatDate(overview.dueAt)}` : ""}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wide ${badge.className}`}>{badge.label}</span>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-acadia-blue-50 px-4 py-2">
            <span className="text-xs font-semibold text-slate-600">Code pour rejoindre la classe {overview.cohortName} :</span>
            <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-acadia-blue">{overview.cohortJoinCode}</span>
          </div>

          {overview.instructions && <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{overview.instructions}</p>}

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-4">
            <Stat label="Questions" value={String(overview.questionCount)} />
            <Stat label="Barème" value={`${overview.totalPoints} pts`} />
            <Stat label="Étudiants ayant soumis" value={String(overview.studentCount)} />
            <Stat label="Soumissions" value={String(overview.submissionCount)} />
          </div>

          {overview.submissionCount > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Progression de correction</span>
                <span>{overview.gradedCount} / {overview.submissionCount} corrigées</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-acadia-blue" style={{ width: `${Math.round((overview.gradedCount / overview.submissionCount) * 100)}%` }} />
              </div>
            </div>
          )}

          {!overview.publishable && overview.status === "draft" && overview.validationErrors.length > 0 && (
            <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs text-amber-700">
              <p className="font-semibold">À corriger avant publication :</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {overview.validationErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <Link
              href={`/dashboard/teacher/assignments/${overview.id}/submissions`}
              className="inline-flex items-center gap-1.5 rounded-full bg-acadia-blue px-4 py-2 text-sm font-semibold text-white hover:bg-acadia-blue/90"
            >
              <Inbox className="h-4 w-4" /> Voir les copies
            </Link>
            <Link
              href={`/dashboard/teacher/assignments/${overview.id}/gradebook`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <BarChart3 className="h-4 w-4" /> Voir les résultats
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
