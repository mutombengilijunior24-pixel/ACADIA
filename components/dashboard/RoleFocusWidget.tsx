"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, ClipboardCheck, BookOpenCheck } from "lucide-react";

// ============================================================
// ACADIA — WIDGET D'ACCUEIL ADAPTÉ AU RÔLE (mission dashboard par rôle)
//
// Retour utilisateur : "un étudiant atterrit sur ses TP, un prof sur
// ses copies à corriger" — sans réorganiser toute l'application
// (décision assumée : même socle /dashboard pour tous, contenu
// différencié en haut de page). Réutilise intégralement les données
// déjà exposées (teacher/dashboard, student/assignments) — aucune
// nouvelle route, aucun calcul dupliqué. Rien n'est affiché si
// l'utilisateur n'est ni enseignant ni inscrit à une classe — jamais
// une statistique inventée pour combler un état vide (mission §5,
// Teacher Workspace).
// ============================================================

interface TeacherSummary {
  submissionCounts: { submitted: number; under_review: number; graded: number; returned: number };
}

interface StudentAssignmentsSummary {
  total: number;
  items: { submissionStatus: string | null }[];
}

export default function RoleFocusWidget() {
  const [isTeacher, setIsTeacher] = useState<boolean | null>(null);
  const [teacherSummary, setTeacherSummary] = useState<TeacherSummary | null>(null);
  const [studentSummary, setStudentSummary] = useState<StudentAssignmentsSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const statusRes = await fetch("/api/assessment/teacher/status");
        const statusData = statusRes.ok ? await statusRes.json() : { isTeacher: false };
        if (cancelled) return;
        setIsTeacher(!!statusData.isTeacher);

        if (statusData.isTeacher) {
          const res = await fetch("/api/assessment/teacher/dashboard");
          if (res.ok && !cancelled) setTeacherSummary((await res.json()).summary);
        } else {
          const res = await fetch("/api/assessment/student/assignments?pageSize=100");
          if (res.ok && !cancelled) setStudentSummary(await res.json());
        }
      } catch {
        // Silencieux : ce widget est un raccourci de confort, jamais un blocage de la page d'accueil.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isTeacher === null) return null;

  if (isTeacher) {
    const toGrade = teacherSummary ? teacherSummary.submissionCounts.submitted + teacherSummary.submissionCounts.under_review : 0;
    return (
      <Link
        href="/dashboard/teacher"
        className="flex items-center justify-between gap-4 rounded-3xl border border-acadia-blue-100 bg-gradient-to-r from-acadia-blue-50 to-white p-6 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-acadia-blue text-white">
            <Inbox className="h-7 w-7" />
          </div>
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-acadia-blue">Espace enseignant</p>
            <p className="text-lg font-bold text-acadia-navy">
              {teacherSummary === null ? "Chargement..." : toGrade > 0 ? `${toGrade} copie${toGrade > 1 ? "s" : ""} à corriger` : "Aucune copie à corriger"}
            </p>
          </div>
        </div>
        <ClipboardCheck className="h-6 w-6 shrink-0 text-acadia-blue" />
      </Link>
    );
  }

  if (!studentSummary || studentSummary.total === 0) return null;

  const todo = studentSummary.items.filter((a) => !a.submissionStatus || a.submissionStatus === "draft").length;

  return (
    <Link
      href="/dashboard/mes-tp"
      className="flex items-center justify-between gap-4 rounded-3xl border border-acadia-blue-100 bg-gradient-to-r from-acadia-blue-50 to-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-acadia-blue text-white">
          <BookOpenCheck className="h-7 w-7" />
        </div>
        <div>
          <p className="text-2xs font-bold uppercase tracking-wider text-acadia-blue">Mes TP</p>
          <p className="text-lg font-bold text-acadia-navy">
            {todo > 0 ? `${todo} TP à faire` : `${studentSummary.total} TP suivi${studentSummary.total > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
      <ClipboardCheck className="h-6 w-6 shrink-0 text-acadia-blue" />
    </Link>
  );
}
