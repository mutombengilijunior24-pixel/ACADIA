"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, UserCircle2 } from "lucide-react";
import { SUBMISSION_STATUS_LABEL, formatScore, formatDate } from "@/components/teacher/teacherLabels";

interface StudentResultRow {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  courseName: string;
  status: string;
  submittedAt: string | null;
  finalScore: number | null;
  maxScore: number | null;
}

interface StudentResultsPayload {
  student: { id: string; name: string; email: string };
  results: StudentResultRow[];
}

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const [data, setData] = useState<StudentResultsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/assessment/teacher/students/${params.studentId}`);
        if (!res.ok) throw new Error("request_failed");
        const json = await res.json();
        if (!cancelled) setData(json.results);
      } catch {
        if (!cancelled) setError("Impossible de charger les résultats de cet étudiant.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.studentId]);

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-3xl text-center text-slate-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <button type="button" onClick={() => history.back()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-acadia-blue">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>

        <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <UserCircle2 className="h-10 w-10 text-slate-300" />
          <div>
            <h1 className="text-xl font-bold text-acadia-navy">{data.student.name}</h1>
            <p className="text-sm text-slate-500">{data.student.email}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">TP et résultats</h2>
          {data.results.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Aucun TP soumis dans vos cours pour cet étudiant.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {data.results.map((r) => {
                const badge = SUBMISSION_STATUS_LABEL[r.status] ?? { label: r.status, className: "bg-slate-100 text-slate-600" };
                return (
                  <li key={r.submissionId} className="py-3">
                    <Link href={`/dashboard/teacher/submissions/${r.submissionId}`} className="flex items-center justify-between gap-3 hover:text-acadia-blue">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{r.assignmentTitle}</p>
                        <p className="truncate text-xs text-slate-400">{r.courseName} · {formatDate(r.submittedAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className={`rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ${badge.className}`}>{badge.label}</span>
                        <span className="font-semibold text-slate-900">{formatScore(r.finalScore, r.maxScore)}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
