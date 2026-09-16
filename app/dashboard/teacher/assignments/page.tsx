"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { ASSIGNMENT_STATUS_LABEL, formatDate } from "@/components/teacher/teacherLabels";

interface AssignmentListItem {
  id: string;
  title: string;
  courseName: string;
  type: string;
  status: string;
  availableFrom: string | null;
  dueAt: string | null;
  questionCount: number;
  submissionCount: number;
  toGradeCount: number;
  gradedCount: number;
}

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "draft", label: "Brouillons" },
  { key: "published", label: "Publiés" },
  { key: "closed", label: "Fermés" },
  { key: "archived", label: "Archivés" },
];

export default function TeacherAssignmentsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AssignmentListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (status) params.set("status", status);
      const res = await fetch(`/api/assessment/assignments?${params.toString()}`);
      if (!res.ok) throw new Error("request_failed");
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError("Impossible de charger vos TP.");
    }
  }, [status, page]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Espace enseignant</p>
          <h1 className="mt-1 text-2xl font-bold text-acadia-navy sm:text-3xl">Mes TP</h1>
        </div>

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
              <ClipboardList className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Aucun TP dans cette catégorie.</p>
            </div>
          )}
          {!error && items !== null && items.length > 0 && (
            <div className="space-y-3">
              {items.map((a) => {
                const badge = ASSIGNMENT_STATUS_LABEL[a.status] ?? { label: a.status, className: "bg-slate-100 text-slate-600" };
                return (
                  <Link
                    key={a.id}
                    href={`/dashboard/teacher/assignments/${a.id}`}
                    className="block rounded-2xl border border-slate-100 p-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{a.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          {a.courseName} · {a.questionCount} question{a.questionCount > 1 ? "s" : ""}
                          {a.dueAt ? ` · Échéance ${formatDate(a.dueAt)}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ${badge.className}`}>{badge.label}</span>
                    </div>
                    {a.submissionCount > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Progression de correction</span>
                          <span>
                            {a.gradedCount} / {a.submissionCount} corrigées
                            {a.toGradeCount > 0 ? ` · ${a.toGradeCount} à corriger` : ""}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-acadia-blue"
                            style={{ width: `${a.submissionCount > 0 ? Math.round((a.gradedCount / a.submissionCount) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {items !== null && total > pageSize && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="font-semibold text-acadia-blue disabled:text-slate-300"
              >
                Précédent
              </button>
              <span className="text-slate-400">
                Page {page} / {Math.max(1, Math.ceil(total / pageSize))}
              </span>
              <button
                type="button"
                disabled={page * pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
                className="font-semibold text-acadia-blue disabled:text-slate-300"
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
