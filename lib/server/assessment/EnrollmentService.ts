// ============================================================
// ACADIA — ENROLLMENT SERVICE (mission Student Enrollment — comble le
// gap documenté depuis Student Submission Engine : aucun lien
// étudiant↔cohorte n'existait, empêchant toute page "Mes TP" côté
// étudiant).
//
// Modèle retenu (retour utilisateur) : un code de classe RÉUTILISABLE
// par cohorte (pattern "Google Classroom"), jamais une invitation
// nominative à usage unique comme SupervisorInvitation — une cohorte
// représente une promotion entière, pas une relation 1:1.
// ============================================================

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/server/db/prisma";
import type { CohortMembership } from "@prisma/client";
import { AssessmentForbiddenError, AssessmentNotFoundError } from "@/lib/core/assessment/AssessmentTypes";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

// Alphabet sans caractères ambigus (0/O, 1/I/L) — un code destiné à être recopié à la main.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateJoinCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

/** Génère paresseusement le code d'une cohorte s'il n'existe pas encore — jamais recréé si déjà présent (un enseignant qui le partage ne doit jamais le voir changer sous ses yeux). */
export async function ensureCohortJoinCode(cohortId: string): Promise<string> {
  const cohort = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } });
  if (cohort.joinCode) return cohort.joinCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const updated = await prisma.cohort.update({ where: { id: cohortId }, data: { joinCode: generateJoinCode() } });
      return updated.joinCode!;
    } catch {
      // Collision (extrêmement improbable, 32^8 possibilités) — on retente avec un nouveau tirage.
    }
  }
  throw new Error("Impossible de générer un code de classe unique après plusieurs tentatives.");
}

/** Enseignant : code de la cohorte d'un de SES cours — jamais exposé pour une cohorte étrangère. */
export async function getCohortJoinCodeForTeacher(teacherId: string, cohortId: string): Promise<string> {
  const ownsCourseInCohort = await prisma.course.findFirst({ where: { cohortId, teacherId }, select: { id: true } });
  if (!ownsCourseInCohort) throw new AssessmentForbiddenError("Vous n'avez aucun cours dans cette cohorte.");
  return ensureCohortJoinCode(cohortId);
}

/**
 * Rejoindre une cohorte via son code — idempotent (rejoindre deux fois
 * la même cohorte ne crée jamais de doublon ni d'erreur pour
 * l'étudiant, cf. le même patron "getOrCreate" que
 * SubmissionService.getOrCreateDraftSubmission).
 */
export async function joinCohortByCode(studentId: string, rawCode: string): Promise<CohortMembership> {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new AssessmentNotFoundError("Code de classe invalide.");

  const cohort = await prisma.cohort.findUnique({ where: { joinCode: code } });
  if (!cohort) throw new AssessmentNotFoundError("Aucune classe ne correspond à ce code.");

  const membership = await prisma.cohortMembership.upsert({
    where: { studentId_cohortId: { studentId, cohortId: cohort.id } },
    create: { studentId, cohortId: cohort.id },
    update: {},
  });

  await logAudit({ actorId: studentId, action: "COHORT_JOINED", entityType: "CohortMembership", entityId: membership.id, metadata: { cohortId: cohort.id } });
  void trackProductEvent({ userId: studentId, eventType: "COHORT_JOINED", metadata: { cohortId: cohort.id } });

  return membership;
}

export interface MyCohortView {
  id: string;
  name: string;
  academicYear: string | null;
  programName: string;
  facultyName: string;
  institutionName: string;
}

export async function listMyCohorts(studentId: string): Promise<MyCohortView[]> {
  const memberships = await prisma.cohortMembership.findMany({
    where: { studentId },
    include: { cohort: { include: { program: { include: { faculty: { include: { institution: true } } } } } } },
    orderBy: { joinedAt: "desc" },
  });
  return memberships.map((m) => ({
    id: m.cohort.id,
    name: m.cohort.name,
    academicYear: m.cohort.academicYear,
    programName: m.cohort.program.name,
    facultyName: m.cohort.program.faculty.name,
    institutionName: m.cohort.program.faculty.institution.name,
  }));
}

export interface StudentAssignmentView {
  assignmentId: string;
  title: string;
  courseName: string;
  teacherName: string;
  status: string;
  dueAt: Date | null;
  submissionStatus: string | null;
}

export interface ListStudentAssignmentsResult {
  items: StudentAssignmentView[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * TP visibles pour un étudiant : uniquement les Assignment "published"/
 * "closed" (jamais "draft"/"archived", même règle que
 * AssignmentService.getAssignmentForStudent) des cours rattachés à une
 * cohorte où l'étudiant est réellement inscrit — jamais tous les TP de
 * la base.
 */
export async function listStudentAssignments(studentId: string, options: { page?: number; pageSize?: number } = {}): Promise<ListStudentAssignmentsResult> {
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(options.pageSize ?? 20)));

  const cohortIds = (await prisma.cohortMembership.findMany({ where: { studentId }, select: { cohortId: true } })).map((m) => m.cohortId);
  if (cohortIds.length === 0) return { items: [], total: 0, page, pageSize };

  const where = { cohortId: { in: cohortIds }, status: { in: ["published", "closed"] } };
  const [total, assignments] = await Promise.all([
    prisma.assignment.count({ where }),
    prisma.assignment.findMany({
      where,
      include: { course: true, teacher: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const submissions = await prisma.assessmentSubmission.findMany({
    where: { assignmentId: { in: assignments.map((a) => a.id) }, studentId },
    orderBy: [{ assignmentId: "asc" }, { version: "desc" }],
    distinct: ["assignmentId"],
    select: { assignmentId: true, status: true },
  });
  const submissionByAssignment = new Map(submissions.map((s) => [s.assignmentId, s.status]));

  return {
    items: assignments.map((a) => ({
      assignmentId: a.id,
      title: a.title,
      courseName: a.course.name,
      teacherName: [a.teacher.firstName, a.teacher.lastName].filter(Boolean).join(" ").trim(),
      status: a.status,
      dueAt: a.dueAt,
      submissionStatus: submissionByAssignment.get(a.id) ?? null,
    })),
    total,
    page,
    pageSize,
  };
}
