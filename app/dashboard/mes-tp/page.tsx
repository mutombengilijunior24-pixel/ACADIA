"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, KeyRound, GraduationCap } from "lucide-react";

interface StudentAssignment {
  assignmentId: string;
  title: string;
  courseName: string;
  teacherName: string;
  status: string;
  dueAt: string | null;
  submissionStatus: string | null;
}

interface MyCohort {
  id: string;
  name: string;
  academicYear: string | null;
  programName: string;
  facultyName: string;
  institutionName: string;
}

const SUBMISSION_LABEL: Record<string, { label: string; className: string }> = {
  draft: { label: "Brouillon en cours", className: "bg-slate-100 text-slate-600" },
  submitted: { label: "Soumis", className: "bg-blue-100 text-blue-700" },
  under_review: { label: "En revue", className: "bg-amber-100 text-amber-700" },
  graded: { label: "Corrigé", className: "bg-emerald-100 text-emerald-700" },
  returned: { label: "Retourné", className: "bg-emerald-100 text-emerald-700" },
};

export default function MesTpPage() {
  const [assignments, setAssignments] = useState<StudentAssignment[] | null>(null);
  const [cohorts, setCohorts] = useState<MyCohort[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [assignRes, cohortRes] = await Promise.all([fetch("/api/assessment/student/assignments"), fetch("/api/assessment/student/cohorts")]);
      if (!assignRes.ok || !cohortRes.ok) throw new Error("request_failed");
      const assignData = await assignRes.json();
      const cohortData = await cohortRes.json();
      setAssignments(assignData.items);
      setCohorts(cohortData.cohorts);
    } catch {
      setError("Impossible de charger vos TP.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function handleJoin() {
    setJoinError(null);
    setJoinBusy(true);
    try {
      const res = await fetch("/api/assessment/student/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Code invalide.");
      }
      setJoinCode("");
      await load();
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Code invalide.");
    } finally {
      setJoinBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Travaux pratiques</p>
          <h1 className="mt-1 text-2xl font-bold text-acadia-navy sm:text-3xl">Mes TP</h1>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-acadia-blue" />
            <p className="text-sm font-semibold text-slate-800">Rejoindre une classe</p>
          </div>
          <p className="mt-1 text-sm text-slate-500">Entrez le code de classe communiqué par votre enseignant pour voir apparaître ses TP ici.</p>
          {joinError && <p className="mt-2 text-sm text-rose-600">{joinError}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Ex. AB12CD34"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm uppercase tracking-wider"
            />
            <button type="button" onClick={handleJoin} disabled={!joinCode.trim() || joinBusy} className="rounded-full bg-acadia-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Rejoindre
            </button>
          </div>
        </div>

        {cohorts !== null && cohorts.length > 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-slate-400" />
              <p className="text-sm font-bold uppercase tracking-wider text-slate-400">Mes classes</p>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {cohorts.map((c) => (
                <li key={c.id} className="text-slate-700">
                  <span className="font-semibold">{c.name}</span> — {c.programName}, {c.facultyName} ({c.institutionName})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!error && assignments === null && <p className="text-center text-sm text-slate-400">Chargement...</p>}
          {!error && assignments !== null && assignments.length === 0 && (
            <div className="py-10 text-center">
              <ClipboardList className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">
                {cohorts && cohorts.length === 0 ? "Rejoignez une classe ci-dessus pour voir vos TP." : "Aucun TP disponible pour l'instant."}
              </p>
            </div>
          )}
          {!error && assignments !== null && assignments.length > 0 && (
            <div className="space-y-3">
              {assignments.map((a) => {
                const badge = a.submissionStatus ? SUBMISSION_LABEL[a.submissionStatus] : { label: "À faire", className: "bg-slate-100 text-slate-600" };
                return (
                  <Link key={a.assignmentId} href={`/dashboard/mes-tp/${a.assignmentId}`} className="block rounded-2xl border border-slate-100 p-4 hover:bg-slate-50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{a.title}</p>
                        <p className="text-sm text-slate-500">{a.courseName} · Enseignant : {a.teacherName || "Non renseigné"}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ${badge?.className ?? "bg-slate-100 text-slate-600"}`}>
                        {badge?.label ?? a.submissionStatus}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
