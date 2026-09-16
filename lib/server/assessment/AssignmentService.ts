// ============================================================
// ACADIA — ASSIGNMENT SERVICE (mission Academic Assessment Core,
// étendu par la mission Assignment Builder + TP Intelligence)
//
// Ownership : un Assignment n'est visible/modifiable que par son
// teacherId (même pattern que ResearchProject.ownerId — jamais un id
// envoyé par le client sans vérification, voir apiAuth.ts). Un
// étudiant ne peut jamais voir/soumettre un Assignment "draft" ou
// "archived" (mission §6).
//
// COURSE OWNERSHIP (mission Assignment Builder §5) : createAssignment
// vérifie désormais que le Course existe réellement, qu'il appartient
// à l'enseignant (Course.teacherId), et que le cohortId fourni
// correspond bien à celui du Course (cohérence de la dénormalisation
// Assignment.cohortId, voir Mission 3 §17).
//
// DELETE POLICY (mission §26) : aucune fonction de suppression réelle
// n'existe ici — seulement archiveAssignment(), qui refuse le
// hard-delete implicite en marquant "archived". L'historique
// académique n'est jamais détruit.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import {
  ACTIVE_ASSIGNMENT_TYPES,
  type AssignmentType,
  AssessmentForbiddenError,
  AssessmentNotFoundError,
  InvalidAssignmentStateError,
} from "@/lib/core/assessment/AssessmentTypes";
import { validateForPublication } from "./AssignmentValidation";
import type { Assignment } from "@prisma/client";

export interface CreateAssignmentInput {
  teacherId: string;
  courseId: string;
  cohortId: string;
  title: string;
  description?: string;
  instructions?: string;
  type: AssignmentType;
  availableFrom?: Date;
  dueAt?: Date;
}

/** Vérifie que l'enseignant possède réellement le Course, et que cohortId correspond au Course (mission Assignment Builder §5). */
async function requireOwnedCourse(teacherId: string, courseId: string, cohortId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AssessmentNotFoundError("Cours introuvable.");
  if (course.teacherId !== teacherId) {
    throw new AssessmentForbiddenError("Ce cours ne vous appartient pas.");
  }
  if (course.cohortId !== cohortId) {
    throw new InvalidAssignmentStateError("La cohorte indiquée ne correspond pas à celle du cours.");
  }
  return course;
}

export async function createAssignment(input: CreateAssignmentInput): Promise<Assignment> {
  if (!ACTIVE_ASSIGNMENT_TYPES.includes(input.type)) {
    throw new InvalidAssignmentStateError(
      `Le type "${input.type}" n'est pas encore activé (seul TP l'est dans cette version).`
    );
  }
  if (!input.title.trim()) {
    throw new InvalidAssignmentStateError("Le titre est obligatoire.");
  }
  await requireOwnedCourse(input.teacherId, input.courseId, input.cohortId);

  const assignment = await prisma.assignment.create({
    data: {
      teacherId: input.teacherId,
      courseId: input.courseId,
      cohortId: input.cohortId,
      title: input.title,
      description: input.description,
      instructions: input.instructions,
      type: input.type,
      status: "draft",
      availableFrom: input.availableFrom,
      dueAt: input.dueAt,
    },
  });

  await logAudit({
    actorId: input.teacherId,
    action: "ASSIGNMENT_CREATED",
    entityType: "Assignment",
    entityId: assignment.id,
    metadata: { type: input.type, courseId: input.courseId },
  });
  await trackProductEvent({
    userId: input.teacherId,
    eventType: "ASSIGNMENT_CREATED",
    metadata: { assignmentId: assignment.id, type: input.type },
  });

  return assignment;
}

async function requireOwnedAssignment(teacherId: string, assignmentId: string): Promise<Assignment> {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new AssessmentNotFoundError("Assignment introuvable.");
  if (assignment.teacherId !== teacherId) {
    await logAudit({
      actorId: teacherId,
      action: "ACCESS_DENIED",
      entityType: "Assignment",
      entityId: assignmentId,
      metadata: { reason: "not_owner" },
    });
    throw new AssessmentForbiddenError("Cet assignment ne vous appartient pas.");
  }
  return assignment;
}

/** Lecture pour l'enseignant propriétaire — lève 403/404 sinon (mission §19). */
export async function getAssignmentForTeacher(teacherId: string, assignmentId: string): Promise<Assignment> {
  return requireOwnedAssignment(teacherId, assignmentId);
}

/** Lecture pour un étudiant — seul un Assignment publié ou clos est visible (mission §6/§19). */
export async function getAssignmentForStudent(assignmentId: string): Promise<Assignment> {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new AssessmentNotFoundError("Assignment introuvable.");
  if (assignment.status !== "published" && assignment.status !== "closed") {
    throw new AssessmentNotFoundError("Assignment introuvable.");
  }
  return assignment;
}

export interface UpdateAssignmentInput {
  title?: string;
  description?: string;
  instructions?: string;
  availableFrom?: Date | null;
  dueAt?: Date | null;
}

/**
 * Édite les métadonnées d'un Assignment (titre/description/consignes/
 * dates) — uniquement tant qu'il est "draft" (mission Assignment
 * Builder §5, "Assignment Builder"). Au-delà, mêmes garanties
 * qu'ailleurs dans ce domaine : rien n'est modifié silencieusement une
 * fois publié.
 */
export async function updateAssignment(teacherId: string, assignmentId: string, patch: UpdateAssignmentInput): Promise<Assignment> {
  const assignment = await requireOwnedAssignment(teacherId, assignmentId);
  if (assignment.status !== "draft") {
    throw new InvalidAssignmentStateError(`Impossible de modifier un assignment "${assignment.status}" — seul "draft" l'autorise.`);
  }
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new InvalidAssignmentStateError("Le titre ne peut pas être vide.");
  }

  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      title: patch.title,
      description: patch.description,
      instructions: patch.instructions,
      availableFrom: patch.availableFrom,
      dueAt: patch.dueAt,
    },
  });

  await logAudit({ actorId: teacherId, action: "ASSIGNMENT_UPDATED", entityType: "Assignment", entityId: assignmentId });
  await trackProductEvent({ userId: teacherId, eventType: "ASSIGNMENT_UPDATED", metadata: { assignmentId } });

  return updated;
}

/**
 * Publie un Assignment — exige désormais une validation pédagogique
 * complète (mission Assignment Builder §11, points A à I), pas
 * seulement "au moins une question" (Mission 3). Voir
 * AssignmentValidation.validateForPublication() pour le détail des
 * règles ; toutes les erreurs trouvées sont rapportées ensemble, pas
 * seulement la première, pour éviter à l'enseignant un aller-retour par
 * erreur.
 */
export async function publishAssignment(teacherId: string, assignmentId: string): Promise<Assignment> {
  const assignment = await requireOwnedAssignment(teacherId, assignmentId);
  if (assignment.status !== "draft") {
    throw new InvalidAssignmentStateError(`Impossible de publier un assignment "${assignment.status}".`);
  }

  const { valid, errors } = await validateForPublication(assignmentId);
  if (!valid) {
    throw new InvalidAssignmentStateError(errors.join(" "));
  }

  const updated = await prisma.assignment.update({ where: { id: assignmentId }, data: { status: "published" } });

  await logAudit({ actorId: teacherId, action: "ASSIGNMENT_PUBLISHED", entityType: "Assignment", entityId: assignmentId });
  await trackProductEvent({ userId: teacherId, eventType: "ASSIGNMENT_PUBLISHED", metadata: { assignmentId } });

  return updated;
}

export async function closeAssignment(teacherId: string, assignmentId: string): Promise<Assignment> {
  const assignment = await requireOwnedAssignment(teacherId, assignmentId);
  if (assignment.status !== "published") {
    throw new InvalidAssignmentStateError(`Impossible de clore un assignment "${assignment.status}".`);
  }

  const updated = await prisma.assignment.update({ where: { id: assignmentId }, data: { status: "closed" } });
  await logAudit({ actorId: teacherId, action: "ASSIGNMENT_CLOSED", entityType: "Assignment", entityId: assignmentId });
  return updated;
}

/** Jamais de suppression réelle (mission §26) — un assignment ayant reçu des soumissions ne doit jamais disparaître. */
export async function archiveAssignment(teacherId: string, assignmentId: string): Promise<Assignment> {
  const assignment = await requireOwnedAssignment(teacherId, assignmentId);
  const updated = await prisma.assignment.update({ where: { id: assignmentId }, data: { status: "archived" } });
  await logAudit({ actorId: teacherId, action: "ASSIGNMENT_CLOSED", entityType: "Assignment", entityId: assignmentId, metadata: { archived: true, previousStatus: assignment.status } });
  return updated;
}
