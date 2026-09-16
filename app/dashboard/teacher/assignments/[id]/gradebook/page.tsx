"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, ClipboardList } from "lucide-react";
import { SUBMISSION_STATUS_LABEL, formatScore, formatDate } from "@/components/teacher/teacherLabels";

interface GradebookRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  submissionId: string;
  status: string;
  submittedAt: string | null;
  finalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
}

interface GradebookSummary {
  studentCount: number;
  submittedCount: number;
  underReviewCount: number;
  gradedCount: number;
  returnedCount: number;
  gradedForAverageCount: number;
  averagePercentage: number | null;
  averageOnUniformScale: { score: number; maxScore: number } | null;
}

interface GradebookResult {
  assignmentId: string;
  assignmentTitle: string;
  rows: GradebookRow[];
  summary: GradebookSummary;
}

export default function GradebookPage() {
  const params = useParams<{ id: string }>();
  const [gradebook, setGradebook] = useState<GradebookResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/assessment/assignments/${params.id}/gradebook`);
        if (!res.ok) {
          if (res.status === 403) throw new Error("Ce TP ne vous appartient pas.");
          throw new Error("request_failed");
        }
        const data = await res.json();
        if (!cancelled) setGradebook(data.gradebook);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.message !== "request_failed" ? e.message : "Impossible de charger les résultats.");
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
        <div className="mx-auto max-w-5xl rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  if (!gradebook) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl text-center text-slate-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href={`/dashboard/teacher/assignments/${gradebook.assignmentId}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-acadia-blue">
          <ArrowLeft className="h-4 w-4" /> Retour au TP
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Résultats</p>
            <h1 className="mt-1 text-2xl font-bold text-acadia-navy sm:text-3xl">{gradebook.assignmentTitle}</h1>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Exporter
            </button>
            {exportOpen && (
              <div className="absolute right-0 z-10 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                <a
                  href={`/api/assessment/assignments/${gradebook.assignmentId}/gradebook/export/csv`}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setExportOpen(false)}
                >
                  CSV
                </a>
                <a
                  href={`/api/assessment/assignments/${gradebook.assignmentId}/gradebook/export/excel`}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setExportOpen(false)}
                >
                  Excel
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Étudiants" value={String(gradebook.summary.studentCount)} />
          <SummaryTile label="Corrigées" value={String(gradebook.summary.gradedCount)} />
          <SummaryTile label="Retournées" value={String(gradebook.summary.returnedCount)} />
          <SummaryTile
            label="Moyenne"
            value={
              gradebook.summary.averageOnUniformScale
                ? formatScore(Math.round(gradebook.summary.averageOnUniformScale.score * 10) / 10, gradebook.summary.averageOnUniformScale.maxScore)
                : gradebook.summary.averagePercentage !== null
                ? `${gradebook.summary.averagePercentage.toFixed(1)}%`
                : "—"
            }
            caption={gradebook.summary.gradedForAverageCount > 0 ? `sur ${gradebook.summary.gradedForAverageCount} copie(s) corrigée(s)` : "Pas encore de résultat"}
          />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {gradebook.rows.length === 0 ? (
            <div className="py-10 text-center">
              <ClipboardList className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Aucune soumission pour ce TP pour l&apos;instant.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3">Étudiant</th>
                    <th className="pb-3">Note</th>
                    <th className="pb-3">Statut</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gradebook.rows.map((r) => {
                    const badge = SUBMISSION_STATUS_LABEL[r.status] ?? { label: r.status, className: "bg-slate-100 text-slate-600" };
                    return (
                      <tr key={r.submissionId}>
                        <td className="py-3">
                          <Link href={`/dashboard/teacher/students/${r.studentId}`} className="font-medium text-slate-800 hover:text-acadia-blue hover:underline">
                            {r.studentName}
                          </Link>
                        </td>
                        <td className="py-3 font-semibold text-slate-900">{formatScore(r.finalScore, r.maxScore)}</td>
                        <td className="py-3">
                          <span className={`rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ${badge.className}`}>{badge.label}</span>
                        </td>
                        <td className="py-3 text-slate-500">{formatDate(r.submittedAt)}</td>
                        <td className="py-3 text-right">
                          <Link href={`/dashboard/teacher/submissions/${r.submissionId}`} className="text-sm font-semibold text-acadia-blue hover:underline">
                            Ouvrir
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {caption && <p className="mt-0.5 text-2xs text-slate-400">{caption}</p>}
    </div>
  );
}
