// ============================================================
// ACADIA — TEACHER WORKSPACE SERVICE (mission Teacher Workspace + Gradebook)
//
// Assemble des vues LECTURE SEULE pour le cockpit enseignant à partir
// des services déjà existants (AssignmentService/SubmissionService/
// EvaluationService/AssignmentValidation) — ne réimplémente AUCUNE
// règle métier déjà construite dans les missions 3 à 6 : ownership,
// machine d'état, séparation aiScore/humanScore/finalScore restent
// entièrement définies là-bas. Ce module ne fait que LIRE et AGRÉGER.
//
// "Étudiants" ici signifie toujours "étudiants ayant une soumission" —
// aucun modèle d'inscription (cohort↔student) n'existe dans ACADIA
// (gap documenté depuis la Mission 5, non comblé ici, hors périmètre).
// Ne jamais présenter ce compte comme "l'effectif de la classe".
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import { Prisma } from "@prisma/client";
import { AssessmentNotFoundError, type AssessmentSubmissionStatus, type AssignmentStatus } from "@/lib/core/assessment/AssessmentTypes";
import { getAssignmentForTeacher } from "./AssignmentService";
import { getSubmissionForTeacher } from "./SubmissionService";
import { buildAssignmentDiagnostic } from "./AssignmentValidation";
import { computeSubmissionTotal } from "./EvaluationService";
import { ensureCohortJoinCode } from "./EnrollmentService";

export const DECIDED_EVALUATION_STATUSES = new Set(["accepted", "modified", "rejected", "finalized"]);
export const FINALIZED_SUBMISSION_STATUSES = new Set<AssessmentSubmissionStatus>(["graded", "returned"]);
const TEACHER_VISIBLE_SUBMISSION_STATUSES: AssessmentSubmissionStatus[] = ["submitted", "under_review", "graded", "returned"];

export interface PageOptions {
  page?: number;
  pageSize?: number;
}

function normalizePage(options: PageOptions, maxPageSize = 100, defaultPageSize = 20) {
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.min(maxPageSize, Math.max(1, Math.trunc(options.pageSize ?? defaultPageSize)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function studentDisplayName(student: { firstName: string; lastName: string | null }): string {
  return [student.firstName, student.lastName].filter(Boolean).join(" ").trim();
}

// ============================================================
// A. TEACHER DASHBOARD
// ============================================================

export interface TeacherDashboardSummary {
  assignmentCounts: Record<AssignmentStatus, number>;
  submissionCounts: Record<Exclude<AssessmentSubmissionStatus, "draft">, number>;
  courses: { id: string; name: string; cohortName: string }[];
  recentSubmissions: {
    id: string;
    assignmentId: string;
    assignmentTitle: string;
    studentName: string;
    status: AssessmentSubmissionStatus;
    submittedAt: Date | null;
  }[];
}

/** Aucune statistique inventée (mission §5) : chaque compteur vient d'un `count()`/`groupBy()` réel — un enseignant sans TP obtient des zéros, jamais une valeur fictive. */
export async function getTeacherDashboard(teacherId: string): Promise<TeacherDashboardSummary> {
  const [assignmentGroups, submissionGroups, courses, recent] = await Promise.all([
    prisma.assignment.groupBy({ by: ["status"], where: { teacherId }, _count: { _all: true } }),
    prisma.assessmentSubmission.groupBy({
      by: ["status"],
      where: { status: { not: "draft" }, assignment: { teacherId } },
      _count: { _all: true },
    }),
    prisma.course.findMany({ where: { teacherId }, include: { cohort: true }, orderBy: { name: "asc" } }),
    prisma.assessmentSubmission.findMany({
      where: { status: { not: "draft" }, assignment: { teacherId } },
      include: { student: { select: { firstName: true, lastName: true } }, assignment: { select: { title: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  const assignmentCounts: Record<AssignmentStatus, number> = { draft: 0, published: 0, closed: 0, archived: 0 };
  for (const g of assignmentGroups) assignmentCounts[g.status as AssignmentStatus] = g._count._all;

  const submissionCounts: Record<Exclude<AssessmentSubmissionStatus, "draft">, number> = {
    submitted: 0,
    under_review: 0,
    graded: 0,
    returned: 0,
  };
  for (const g of submissionGroups) submissionCounts[g.status as Exclude<AssessmentSubmissionStatus, "draft">] = g._count._all;

  return {
    assignmentCounts,
    submissionCounts,
    courses: courses.map((c) => ({ id: c.id, name: c.name, cohortName: c.cohort.name })),
    recentSubmissions: recent.map((s) => ({
      id: s.id,
      assignmentId: s.assignmentId,
      assignmentTitle: s.assignment.title,
      studentName: studentDisplayName(s.student),
      status: s.status as AssessmentSubmissionStatus,
      submittedAt: s.submittedAt,
    })),
  };
}

// ============================================================
// B. ASSIGNMENT LIST
// ============================================================

export interface AssignmentListItem {
  id: string;
  title: string;
  courseName: string;
  type: string;
  status: AssignmentStatus;
  availableFrom: Date | null;
  dueAt: Date | null;
  questionCount: number;
  submissionCount: number;
  toGradeCount: number;
  gradedCount: number;
}

export interface ListAssignmentsOptions extends PageOptions {
  status?: AssignmentStatus;
}

export async function listAssignmentsForTeacher(
  teacherId: string,
  options: ListAssignmentsOptions = {}
): Promise<{ items: AssignmentListItem[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, skip, take } = normalizePage(options);
  const where: Prisma.AssignmentWhereInput = { teacherId, ...(options.status ? { status: options.status } : {}) };

  const [total, assignments] = await Promise.all([
    prisma.assignment.count({ where }),
    prisma.assignment.findMany({ where, include: { course: true }, orderBy: { createdAt: "desc" }, skip, take }),
  ]);

  if (assignments.length === 0) return { items: [], total, page, pageSize };

  const assignmentIds = assignments.map((a) => a.id);
  const [questionGroups, submissionGroups] = await Promise.all([
    prisma.question.groupBy({ by: ["assignmentId"], where: { assignmentId: { in: assignmentIds }, supersededAt: null }, _count: { _all: true } }),
    prisma.assessmentSubmission.groupBy({ by: ["assignmentId", "status"], where: { assignmentId: { in: assignmentIds }, status: { not: "draft" } }, _count: { _all: true } }),
  ]);

  const questionCountByAssignment = new Map(questionGroups.map((g) => [g.assignmentId, g._count._all]));
  const submissionStatsByAssignment = new Map<string, { total: number; toGrade: number; graded: number }>();
  for (const g of submissionGroups) {
    const stats = submissionStatsByAssignment.get(g.assignmentId) ?? { total: 0, toGrade: 0, graded: 0 };
    stats.total += g._count._all;
    if (g.status === "submitted" || g.status === "under_review") stats.toGrade += g._count._all;
    if (g.status === "graded" || g.status === "returned") stats.graded += g._count._all;
    submissionStatsByAssignment.set(g.assignmentId, stats);
  }

  const items: AssignmentListItem[] = assignments.map((a) => {
    const stats = submissionStatsByAssignment.get(a.id) ?? { total: 0, toGrade: 0, graded: 0 };
    return {
      id: a.id,
      title: a.title,
      courseName: a.course.name,
      type: a.type,
      status: a.status as AssignmentStatus,
      availableFrom: a.availableFrom,
      dueAt: a.dueAt,
      questionCount: questionCountByAssignment.get(a.id) ?? 0,
      submissionCount: stats.total,
      toGradeCount: stats.toGrade,
      gradedCount: stats.graded,
    };
  });

  return { items, total, page, pageSize };
}

// ============================================================
// C. ASSIGNMENT OVERVIEW
// ============================================================

export interface AssignmentOverview {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  courseName: string;
  cohortName: string;
  type: string;
  status: AssignmentStatus;
  availableFrom: Date | null;
  dueAt: Date | null;
  questionCount: number;
  totalPoints: number;
  studentCount: number;
  submissionCount: number;
  gradedCount: number;
  publishable: boolean;
  validationErrors: string[];
  /** Code que les étudiants saisissent pour rejoindre cette cohorte (mission Student Enrollment) — jamais régénéré tant qu'il existe déjà. */
  cohortJoinCode: string;
}

export async function getAssignmentOverview(teacherId: string, assignmentId: string): Promise<AssignmentOverview> {
  const assignment = await getAssignmentForTeacher(teacherId, assignmentId);
  const [diagnostic, course, distinctStudents, submissionGroups, cohortJoinCode] = await Promise.all([
    buildAssignmentDiagnostic(assignmentId),
    prisma.course.findUniqueOrThrow({ where: { id: assignment.courseId }, include: { cohort: true } }),
    prisma.assessmentSubmission.findMany({ where: { assignmentId, status: { not: "draft" } }, distinct: ["studentId"], select: { studentId: true } }),
    prisma.assessmentSubmission.groupBy({ by: ["status"], where: { assignmentId, status: { not: "draft" } }, _count: { _all: true } }),
    ensureCohortJoinCode(assignment.cohortId),
  ]);

  let submissionCount = 0;
  let gradedCount = 0;
  for (const g of submissionGroups) {
    submissionCount += g._count._all;
    if (g.status === "graded" || g.status === "returned") gradedCount += g._count._all;
  }

  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    instructions: assignment.instructions,
    courseName: course.name,
    cohortName: course.cohort.name,
    type: assignment.type,
    status: assignment.status as AssignmentStatus,
    availableFrom: assignment.availableFrom,
    dueAt: assignment.dueAt,
    questionCount: diagnostic.questionCount,
    totalPoints: diagnostic.totalPoints,
    studentCount: distinctStudents.length,
    submissionCount,
    gradedCount,
    publishable: diagnostic.publishable,
    validationErrors: diagnostic.errors,
    cohortJoinCode,
  };
}

// ============================================================
// D. SUBMISSION INBOX
// ============================================================

export type SubmissionPriority = "human_review_required" | "ai_proposal_pending" | "validated";

export interface SubmissionInboxItem {
  id: string;
  studentId: string;
  studentName: string;
  status: AssessmentSubmissionStatus;
  version: number;
  submittedAt: Date | null;
  priority: SubmissionPriority;
  gradingProgress: { decided: number; total: number };
  finalScore: number | null;
  maxScore: number | null;
}

export interface ListSubmissionsOptions extends PageOptions {
  status?: AssessmentSubmissionStatus;
}

function computePriority(decided: number, proposed: number, total: number): SubmissionPriority {
  if (total > 0 && decided === total) return "validated";
  if (proposed > 0) return "ai_proposal_pending";
  return "human_review_required";
}

export async function listSubmissionsForAssignment(
  teacherId: string,
  assignmentId: string,
  options: ListSubmissionsOptions = {}
): Promise<{ items: SubmissionInboxItem[]; total: number; page: number; pageSize: number }> {
  await getAssignmentForTeacher(teacherId, assignmentId);
  const { page, pageSize, skip, take } = normalizePage(options);

  const statusFilter = options.status && TEACHER_VISIBLE_SUBMISSION_STATUSES.includes(options.status) ? options.status : undefined;
  const where: Prisma.AssessmentSubmissionWhereInput = {
    assignmentId,
    status: statusFilter ? statusFilter : { in: TEACHER_VISIBLE_SUBMISSION_STATUSES },
  };

  const [total, submissions] = await Promise.all([
    prisma.assessmentSubmission.count({ where }),
    prisma.assessmentSubmission.findMany({
      where,
      include: { student: { select: { firstName: true, lastName: true } }, answers: { include: { evaluation: true, question: { select: { maxScore: true } } } } },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
  ]);

  const items: SubmissionInboxItem[] = submissions.map((s) => {
    const totalAnswers = s.answers.length;
    const decided = s.answers.filter((a) => a.evaluation && DECIDED_EVALUATION_STATUSES.has(a.evaluation.status)).length;
    const proposed = s.answers.filter((a) => a.evaluation && !DECIDED_EVALUATION_STATUSES.has(a.evaluation.status)).length;
    const isFinal = FINALIZED_SUBMISSION_STATUSES.has(s.status as AssessmentSubmissionStatus);
    const totals = isFinal
      ? computeSubmissionTotal(
          s.answers
            .filter((a) => a.evaluation && DECIDED_EVALUATION_STATUSES.has(a.evaluation.status))
            .map((a) => ({ maxScore: Number(a.question.maxScore.toString()), finalScore: Number((a.evaluation!.finalScore ?? 0).toString()) }))
        )
      : null;
    return {
      id: s.id,
      studentId: s.studentId,
      studentName: studentDisplayName(s.student),
      status: s.status as AssessmentSubmissionStatus,
      version: s.version,
      submittedAt: s.submittedAt,
      priority: computePriority(decided, proposed, totalAnswers),
      gradingProgress: { decided, total: totalAnswers },
      finalScore: totals?.totalScore ?? null,
      maxScore: totals?.totalMaxScore ?? null,
    };
  });

  return { items, total, page, pageSize };
}

// ============================================================
// E. SUBMISSION REVIEW (question par question)
// ============================================================

export interface ReviewCriterionScore {
  criterionId: string;
  name: string;
  score: number;
  maxScore: number;
  confidence: number | null;
  evidence: string | null;
  comment: string | null;
}

export interface ReviewEvaluation {
  id: string;
  status: string;
  aiScore: number | null;
  humanScore: number | null;
  finalScore: number | null;
  confidence: number | null;
  aiModel: string | null;
  needsHumanReview: boolean;
  criterionScores: ReviewCriterionScore[];
  aiFeedback: string[];
  teacherFeedback: string[];
  findings: string[];
  warnings: string[];
  limitations: string[];
}

export interface ReviewQuestionItem {
  questionId: string;
  order: number;
  statement: string;
  type: string;
  maxScore: number;
  answerText: string | null;
  answerData: unknown;
  evaluation: ReviewEvaluation | null;
}

export interface SubmissionReviewPayload {
  submissionId: string;
  status: AssessmentSubmissionStatus;
  version: number;
  submittedAt: Date | null;
  student: { id: string; name: string; email: string };
  assignmentId: string;
  assignmentTitle: string;
  courseName: string;
  items: ReviewQuestionItem[];
  decidedCount: number;
  totalCount: number;
  allDecided: boolean;
  canFinalize: boolean;
  runningTotal: { score: number; maxScore: number } | null;
}

/**
 * `aiRawProposal` (mission §30) n'est JAMAIS renvoyé tel quel — seuls
 * les champs déjà structurés (findings/feedback/evidence/warnings/
 * limitations, déjà validés par GradingAI.ts) sont extraits pour un
 * affichage pédagogique côté page. Si le JSON est absent/corrompu, on
 * dégrade silencieusement vers des tableaux vides plutôt que de faire
 * échouer toute la revue de copie pour une seule question.
 */
function extractReadableAiInsights(aiRawProposal: string | null): { findings: string[]; warnings: string[]; limitations: string[]; feedback: string[] } {
  if (!aiRawProposal) return { findings: [], warnings: [], limitations: [], feedback: [] };
  try {
    const parsed = JSON.parse(aiRawProposal) as { findings?: string[]; warnings?: string[]; limitations?: string[]; feedback?: string[] };
    return {
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      limitations: Array.isArray(parsed.limitations) ? parsed.limitations : [],
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
    };
  } catch {
    return { findings: [], warnings: [], limitations: [], feedback: [] };
  }
}

export async function getSubmissionReviewForTeacher(teacherId: string, submissionId: string): Promise<SubmissionReviewPayload> {
  const submission = await getSubmissionForTeacher(teacherId, submissionId);

  const [student, assignment, answers] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: submission.studentId }, select: { id: true, firstName: true, lastName: true, email: true } }),
    prisma.assignment.findUniqueOrThrow({ where: { id: submission.assignmentId }, include: { course: true } }),
    prisma.assessmentAnswer.findMany({
      where: { submissionId },
      include: {
        question: true,
        evaluation: { include: { criterionScores: { include: { criterion: true } }, feedbacks: true } },
      },
    }),
  ]);

  const items: ReviewQuestionItem[] = answers
    .map((a) => {
      let evaluation: ReviewEvaluation | null = null;
      if (a.evaluation) {
        const insights = extractReadableAiInsights(a.evaluation.aiRawProposal);
        evaluation = {
          id: a.evaluation.id,
          status: a.evaluation.status,
          aiScore: a.evaluation.aiScore !== null ? Number(a.evaluation.aiScore.toString()) : null,
          humanScore: a.evaluation.humanScore !== null ? Number(a.evaluation.humanScore.toString()) : null,
          finalScore: a.evaluation.finalScore !== null ? Number(a.evaluation.finalScore.toString()) : null,
          confidence: a.evaluation.confidence !== null ? Number(a.evaluation.confidence.toString()) : null,
          aiModel: a.evaluation.aiModel,
          needsHumanReview: a.evaluation.needsHumanReview,
          criterionScores: a.evaluation.criterionScores.map((c) => ({
            criterionId: c.criterionId,
            name: c.criterion.name,
            score: Number(c.score.toString()),
            maxScore: Number(c.maxScore.toString()),
            confidence: c.confidence !== null ? Number(c.confidence.toString()) : null,
            evidence: c.evidence,
            comment: c.comment,
          })),
          aiFeedback: [...insights.feedback, ...a.evaluation.feedbacks.filter((f) => f.source === "ai").map((f) => f.text)],
          teacherFeedback: a.evaluation.feedbacks.filter((f) => f.source === "teacher").map((f) => f.text),
          findings: insights.findings,
          warnings: insights.warnings,
          limitations: insights.limitations,
        };
      }
      return {
        questionId: a.question.id,
        order: a.question.order,
        statement: a.question.statement,
        type: a.question.type,
        maxScore: Number(a.question.maxScore.toString()),
        answerText: a.answerText,
        answerData: a.answerData ? safeJsonParse(a.answerData) : null,
        evaluation,
      };
    })
    .sort((x, y) => x.order - y.order);

  const decidedCount = items.filter((i) => i.evaluation && DECIDED_EVALUATION_STATUSES.has(i.evaluation.status)).length;
  const totalCount = items.length;
  const allDecided = totalCount > 0 && decidedCount === totalCount;

  const runningTotal =
    decidedCount > 0
      ? computeSubmissionTotal(
          items
            .filter((i) => i.evaluation && DECIDED_EVALUATION_STATUSES.has(i.evaluation.status))
            .map((i) => ({ maxScore: i.maxScore, finalScore: i.evaluation!.finalScore ?? 0 }))
        )
      : null;

  return {
    submissionId: submission.id,
    status: submission.status as AssessmentSubmissionStatus,
    version: submission.version,
    submittedAt: submission.submittedAt,
    student: { id: student.id, name: studentDisplayName(student), email: student.email },
    assignmentId: assignment.id,
    assignmentTitle: assignment.title,
    courseName: assignment.course.name,
    items,
    decidedCount,
    totalCount,
    allDecided,
    canFinalize: allDecided && submission.status !== "graded" && submission.status !== "returned",
    runningTotal: runningTotal ? { score: runningTotal.totalScore, maxScore: runningTotal.totalMaxScore } : null,
  };
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// ============================================================
// F. STUDENT DETAIL (dans le contexte des assignments du professeur)
// ============================================================

export interface StudentResultRow {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  courseName: string;
  status: AssessmentSubmissionStatus;
  submittedAt: Date | null;
  finalScore: number | null;
  maxScore: number | null;
}

export interface StudentResultsForTeacher {
  student: { id: string; name: string; email: string };
  results: StudentResultRow[];
}

/** Ownership imposée DANS la requête (`assignment: { teacherId }`) — un enseignant ne peut structurellement recevoir que ses propres TP, jamais un filtre après-coup. */
export async function getStudentResultsForTeacher(teacherId: string, studentId: string): Promise<StudentResultsForTeacher> {
  const student = await prisma.user.findUnique({ where: { id: studentId }, select: { id: true, firstName: true, lastName: true, email: true } });
  if (!student) throw new AssessmentNotFoundError("Étudiant introuvable.");

  const submissions = await prisma.assessmentSubmission.findMany({
    where: { studentId, status: { not: "draft" }, assignment: { teacherId } },
    include: {
      assignment: { include: { course: true } },
      answers: { include: { evaluation: true, question: { select: { maxScore: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const results: StudentResultRow[] = submissions.map((s) => {
    const isFinal = FINALIZED_SUBMISSION_STATUSES.has(s.status as AssessmentSubmissionStatus);
    const totals = isFinal
      ? computeSubmissionTotal(
          s.answers
            .filter((a) => a.evaluation && DECIDED_EVALUATION_STATUSES.has(a.evaluation.status))
            .map((a) => ({ maxScore: Number(a.question.maxScore.toString()), finalScore: Number((a.evaluation!.finalScore ?? 0).toString()) }))
        )
      : null;
    return {
      submissionId: s.id,
      assignmentId: s.assignmentId,
      assignmentTitle: s.assignment.title,
      courseName: s.assignment.course.name,
      status: s.status as AssessmentSubmissionStatus,
      submittedAt: s.submittedAt,
      finalScore: totals?.totalScore ?? null,
      maxScore: totals?.totalMaxScore ?? null,
    };
  });

  return { student: { id: student.id, name: studentDisplayName(student), email: student.email }, results };
}
