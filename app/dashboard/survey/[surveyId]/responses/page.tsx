"use client";

// ============================================================
// ACADIA SURVEY — Tableau des réponses (propriétaire)
//
// Filtres dynamiques (jamais un filtre pour une variable inexistante),
// combinables, recalcul instantané côté serveur. Chaque ligne s'ouvre
// sur un panneau de détail. Pagination côté client volontairement
// simple ici (le serveur ne renvoie que les réponses filtrées, jamais
// l'ensemble non filtré chargé en mémoire côté client sur de gros volumes
// n'est pas garanti à ce stade — voir rapport final du module).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, X, Filter } from "lucide-react";
import type { SurveyResponseDetail, SurveyResponseSummary } from "@/lib/core/survey/SurveyTypes";

interface FilterValues {
  institutions: string[];
  faculties: string[];
  categories: { id: string; label: string }[];
}

export default function SurveyResponsesPage() {
  const params = useParams<{ surveyId: string }>();
  const surveyId = params.surveyId;

  const [responses, setResponses] = useState<SurveyResponseSummary[] | null>(null);
  const [filterValues, setFilterValues] = useState<FilterValues | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [institution, setInstitution] = useState("");
  const [faculty, setFaculty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SurveyResponseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (categoryId) qs.set("categoryId", categoryId);
      if (institution) qs.set("institution", institution);
      if (faculty) qs.set("faculty", faculty);
      const res = await fetch(`/api/survey/${surveyId}/responses?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 403 ? "Cette enquête ne vous appartient pas." : "Impossible de charger les réponses.");
        return;
      }
      const data = await res.json();
      setResponses(data.responses ?? []);
      setFilterValues(data.filterValues ?? null);
    } catch {
      setError("Impossible de contacter le serveur.");
    }
  }, [surveyId, categoryId, institution, faculty]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function openDetail(responseId: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/survey/${surveyId}/responses/${responseId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setSelected(data.response);
    } finally {
      setDetailLoading(false);
    }
  }

  const hasFilters = Boolean(filterValues && (filterValues.categories.length || filterValues.institutions.length || filterValues.faculties.length));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <Link href={`/dashboard/survey/${surveyId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-acadia-blue">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour à l&apos;enquête
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-acadia-navy sm:text-3xl">Réponses{responses ? ` (${responses.length})` : ""}</h1>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

        {hasFilters && (
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
            <Filter className="h-4 w-4 text-slate-400" />
            {filterValues!.categories.length > 0 && (
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
                <option value="">Toutes catégories</option>
                {filterValues!.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            )}
            {filterValues!.institutions.length > 0 && (
              <select value={institution} onChange={(e) => setInstitution(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
                <option value="">Toutes institutions</option>
                {filterValues!.institutions.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            )}
            {filterValues!.faculties.length > 0 && (
              <select value={faculty} onChange={(e) => setFaculty(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
                <option value="">Toutes facultés</option>
                {filterValues!.faculties.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}
            {(categoryId || institution || faculty) && (
              <button type="button" onClick={() => { setCategoryId(""); setInstitution(""); setFaculty(""); }} className="text-xs font-semibold text-slate-400 hover:text-red-500">
                Réinitialiser
              </button>
            )}
          </div>
        )}

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-2xs font-bold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Reçue le</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Faculté</th>
                <th className="px-4 py-3">Niveau</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {responses === null ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Chargement...</td></tr>
              ) : responses.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Aucune réponse pour le moment.</td></tr>
              ) : (
                responses.map((r) => (
                  <tr key={r.id} onClick={() => openDetail(r.id)} className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{new Date(r.startedAt).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3 text-slate-600">{r.categoryLabel ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.institution ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.faculty ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.level ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-2xs font-bold ${r.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {r.status === "completed" ? "Terminée" : r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-acadia-blue">Voir</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-acadia-navy/40 sm:items-center" onClick={() => setSelected(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-acadia-navy">Détail de la réponse</p>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fermer" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-2xs text-slate-500">
              {selected.categoryLabel && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold">{selected.categoryLabel}</span>}
              {selected.institution && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold">{selected.institution}</span>}
              {selected.faculty && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold">{selected.faculty}</span>}
            </div>
            <div className="mt-5 space-y-4">
              {selected.answers.map((a, i) => (
                <div key={`${a.questionId}_${i}`}>
                  <p className="text-xs font-semibold text-slate-500">{a.questionText}</p>
                  <p className="mt-1 text-sm text-acadia-navy">{a.optionLabel ?? a.valueText ?? "—"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {detailLoading && !selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-acadia-navy/20 text-sm font-medium text-white">Chargement...</div>}
    </div>
  );
}
