"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Inbox } from "lucide-react";
import { SUBMISSION_STATUS_LABEL, PRIORITY_LABEL, formatScore, formatDate } from "@/components/teacher/teacherLabels";

interface SubmissionInboxItem {
  id: string;
  studentId: string;
  studentName: string;
  status: string;
  version: number;
  submittedAt: string | null;
  priority: string;
  gradingProgress: { decided: number; total: number };
  finalScore: number | null;
  maxScore: number | null;
}

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Toutes" },
  { key: "submitted", label: "À corriger" },
  { key: "under_review", label: "En revue" },
  { key: "graded", label: "Corrigées" },
  { key: "returned", label: "Retournées" },
];

export default function SubmissionInboxPage() {
  const params = useParams<{ id: string }>();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SubmissionInboxItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    try {
      const search = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (status) search.set("status", status);
      const res = await fetch(`/api/assessment/assignments/${params.id}/submissions?${search.toString()}`);
      if (!res.ok) throw new Error("request_failed");
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError("Impossible de charger les soumissions.");
    }
  }, [params.id, status, page]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href={`/dashboard/teacher/assignments/${params.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-acadia-blue">
          <ArrowLeft className="h-4 w-4" /> Retour au TP
        </Link>

        <h1 className="text-2xl font-bold text-acadia-navy sm:text-3xl">Copies reçues</h1>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setStatus(f.key);
                setPage(1);
              }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                status === f.key ? "bg-acadia-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!error && items === null && <p className="text-center text-sm text-slate-400">Chargement...</p>}
          {!error && items !== null && items.length === 0 && (
            <div className="py-10 text-center">
              <Inbox className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Vous n&apos;avez encore reçu aucune soumission dans cette catégorie.</p>
            </div>
          )}

          {!error && items !== null && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3">Étudiant</th>
                    <th className="pb-3">Statut</th>
                    <th className="pb-3">Priorité</th>
                    <th className="pb-3">Soumis le</th>
                    <th className="pb-3">Note</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((s) => {
                    const statusBadge = SUBMISSION_STATUS_LABEL[s.status] ?? { label: s.status, className: "bg-slate-100 text-slate-600" };
                    const priority = PRIORITY_LABEL[s.priority] ?? PRIORITY_LABEL.human_review_required;
                    return (
                      <tr key={s.id}>
                        <td className="py-3 font-medium text-slate-800">
                          {s.studentName}
                          {s.version > 1 && <span className="ml-1.5 text-2xs text-slate-400">v{s.version}</span>}
                        </td>
                        <td className="py-3">
                          <span className={`rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ${statusBadge.className}`}>{statusBadge.label}</span>
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold ${priority.className}`}>
                            {priority.emoji} {priority.label}
                          </span>
                          <span className="ml-2 text-2xs text-slate-400">
                            {s.gradingProgress.decided}/{s.gradingProgress.total}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500">{formatDate(s.submittedAt)}</td>
                        <td className="py-3 font-semibold text-slate-900">{formatScore(s.finalScore, s.maxScore)}</td>
                        <td className="py-3 text-right">
                          <Link href={`/dashboard/teacher/submissions/${s.id}`} className="text-sm font-semibold text-acadia-blue hover:underline">
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

          {items !== null && total > pageSize && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="font-semibold text-acadia-blue disabled:text-slate-300">
                Précédent
              </button>
              <span className="text-slate-400">
                Page {page} / {Math.max(1, Math.ceil(total / pageSize))} · {total} copie(s)
              </span>
              <button type="button" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)} className="font-semibold text-acadia-blue disabled:text-slate-300">
                Suivant
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
