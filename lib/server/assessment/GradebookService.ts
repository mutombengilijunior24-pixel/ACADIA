// ============================================================
// ACADIA — GRADEBOOK SERVICE (mission Teacher Workspace + Gradebook)
//
// RÈGLE ABSOLUE (mission §26) : la moyenne officielle et chaque note
// affichée utilisent EXCLUSIVEMENT Evaluation.finalScore — jamais
// aiScore, jamais une soumission dont le statut n'est pas "graded"/
// "returned". Une soumission non finalisée affiche "Pas encore de
// résultat" (finalScore: null), jamais un score partiel/en cours.
//
// Une resoumission (mission Student Submission Engine) crée une
// NOUVELLE ligne AssessmentSubmission (version+1) sans jamais supprimer
// l'ancienne — le gradebook ne doit montrer que la version COURANTE de
// chaque étudiant (`distinct` + `orderBy version desc`), jamais compter
// deux fois le même étudiant à cause de son historique de versions.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import { getAssignmentForTeacher } from "./AssignmentService";
import { computeSubmissionTotal } from "./EvaluationService";
import { DECIDED_EVALUATION_STATUSES, FINALIZED_SUBMISSION_STATUSES } from "./TeacherWorkspaceService";
import type { AssessmentSubmissionStatus } from "@/lib/core/assessment/AssessmentTypes";

export interface GradebookRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  submissionId: string;
  status: AssessmentSubmissionStatus;
  submittedAt: Date | null;
  finalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
}

export interface GradebookSummary {
  studentCount: number;
  submittedCount: number;
  underReviewCount: number;
  gradedCount: number;
  returnedCount: number;
  gradedForAverageCount: number;
  averagePercentage: number | null;
  /** Non-null uniquement si tous les résultats finalisés partagent le même barème (cas courant) — sinon, seule averagePercentage reste comparable (mission §23 : ne jamais supposer un barème /20 uniforme). */
  averageOnUniformScale: { score: number; maxScore: number } | null;
}

export interface GradebookResult {
  assignmentId: string;
  assignmentTitle: string;
  rows: GradebookRow[];
  summary: GradebookSummary;
}

export async function getGradebook(teacherId: string, assignmentId: string): Promise<GradebookResult> {
  const assignment = await getAssignmentForTeacher(teacherId, assignmentId);

  const submissions = await prisma.assessmentSubmission.findMany({
    where: { assignmentId, status: { not: "draft" } },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      answers: { include: { evaluation: true, question: { select: { maxScore: true } } } },
    },
    orderBy: [{ studentId: "asc" }, { version: "desc" }],
    distinct: ["studentId"],
  });

  const rows: GradebookRow[] = submissions
    .map((s) => {
      const isFinal = FINALIZED_SUBMISSION_STATUSES.has(s.status as AssessmentSubmissionStatus);
      const totals = isFinal
        ? computeSubmissionTotal(
            s.answers
              .filter((a) => a.evaluation && DECIDED_EVALUATION_STATUSES.has(a.evaluation.status))
              .map((a) => ({ maxScore: Number(a.question.maxScore.toString()), finalScore: Number((a.evaluation!.finalScore ?? 0).toString()) }))
          )
        : null;
      return {
        studentId: s.studentId,
        studentName: [s.student.firstName, s.student.lastName].filter(Boolean).join(" ").trim(),
        studentEmail: s.student.email,
        submissionId: s.id,
        status: s.status as AssessmentSubmissionStatus,
        submittedAt: s.submittedAt,
        finalScore: totals ? totals.totalScore : null,
        maxScore: totals ? totals.totalMaxScore : null,
        percentage: totals ? totals.percentage : null,
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  const gradedRows = rows.filter((r) => r.finalScore !== null && r.maxScore !== null);
  const distinctMaxScores = new Set(gradedRows.map((r) => r.maxScore));
  const uniformMaxScore = distinctMaxScores.size === 1 ? [...distinctMaxScores][0] : null;

  const summary: GradebookSummary = {
    studentCount: rows.length,
    submittedCount: rows.filter((r) => r.status === "submitted").length,
    underReviewCount: rows.filter((r) => r.status === "under_review").length,
    gradedCount: rows.filter((r) => r.status === "graded").length,
    returnedCount: rows.filter((r) => r.status === "returned").length,
    gradedForAverageCount: gradedRows.length,
    averagePercentage: gradedRows.length > 0 ? gradedRows.reduce((sum, r) => sum + (r.percentage ?? 0), 0) / gradedRows.length : null,
    averageOnUniformScale:
      uniformMaxScore !== null && gradedRows.length > 0
        ? { score: gradedRows.reduce((sum, r) => sum + (r.finalScore ?? 0), 0) / gradedRows.length, maxScore: uniformMaxScore }
        : null,
  };

  return { assignmentId, assignmentTitle: assignment.title, rows, summary };
}
