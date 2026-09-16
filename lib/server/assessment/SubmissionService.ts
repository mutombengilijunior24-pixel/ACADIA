// ============================================================
// ACADIA — ASSESSMENT SUBMISSION SERVICE (mission Academic Assessment
// Core, renforcé par la mission Student Submission Engine)
//
// Nommé "AssessmentSubmission" (jamais "Submission" seul) pour ne
// jamais être confondu avec le modèle Submission existant (supervision
// de mémoire — voir audit Mission 3). Une resoumission ne fait JAMAIS
// disparaître la précédente (mission §22) : resubmitAfterReturn crée
// une NOUVELLE ligne (version+1) plutôt que d'écraser.
//
// CONCURRENCE (mission §8/§18/§19/§32) : toute opération qui dépend du
// statut COURANT d'une AssessmentSubmission (upsertAnswer, submit,
// markUnderReview, returnSubmission) verrouille la ligne via
// `SELECT ... FOR UPDATE` (voir lockSubmission ci-dessous) au sein
// d'une transaction, avant de lire son statut — jamais une simple
// lecture non verrouillée suivie d'une écriture séparée, qui laisserait
// une fenêtre de course (ex. SAVE et SUBMIT simultanés, mission §32.D).
// Deux appels concurrents sur LA MÊME ligne sont ainsi sérialisés par
// Postgres lui-même — aucun état mémoire local, conforme mission §41.
//
// OWNERSHIP (mission §26) : un étudiant ne voit/modifie que ses propres
// AssessmentSubmission ; un enseignant ne voit que celles de ses
// propres Assignment.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import { Prisma, type AssessmentSubmission, type AssessmentAnswer, type PrismaClient } from "@prisma/client";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import {
  AssessmentForbiddenError,
  AssessmentNotFoundError,
  InvalidSubmissionStateError,
  InvalidAnswerError,
  validateAnswerForQuestion,
  canTransitionSubmissionStatus,
  type AssessmentSubmissionStatus,
  type QuestionContent,
  type QuestionType,
} from "@/lib/core/assessment/AssessmentTypes";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/**
 * Verrouille la ligne AssessmentSubmission (SELECT ... FOR UPDATE) puis
 * la relit typée — DOIT être appelée à l'intérieur d'une transaction
 * (`tx`). Toute transaction concurrente qui tente de verrouiller la
 * MÊME ligne attend que celle-ci se termine (commit/rollback) avant de
 * lire à son tour — c'est le mécanisme qui sérialise réellement les
 * opérations concurrentes (mission §32), pas une convention applicative
 * fragile.
 */
async function lockSubmission(tx: Tx, submissionId: string): Promise<AssessmentSubmission | null> {
  await tx.$queryRawUnsafe('SELECT id FROM "AssessmentSubmission" WHERE id = $1 FOR UPDATE', submissionId);
  return tx.assessmentSubmission.findUnique({ where: { id: submissionId } });
}

function parseQuestionContent(metadata: string | null): QuestionContent | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as QuestionContent;
  } catch {
    return null;
  }
}

/** Version la plus récente (courante) d'une soumission pour (assignment, student) — jamais recalculée ailleurs. */
export async function getCurrentSubmission(assignmentId: string, studentId: string): Promise<AssessmentSubmission | null> {
  return prisma.assessmentSubmission.findFirst({
    where: { assignmentId, studentId },
    orderBy: { version: "desc" },
  });
}

/**
 * Récupère le brouillon courant ou en crée un nouveau (version 1).
 * L'assignment DOIT être "published" — jamais "draft" (mission §4) ni
 * "closed"/"archived" pour une PREMIÈRE soumission. Vérifie également
 * assignment.type === "TP" (mission §4, point 3 — défensif : aucun
 * autre type ne peut être créé aujourd'hui, mais la règle doit être
 * vérifiée ici aussi, pas seulement supposée).
 *
 * CONCURRENCE (mission §8/§32.A) : deux appels simultanés peuvent tous
 * deux constater "aucune soumission existante" avant que l'un des deux
 * n'écrive — la contrainte unique Assessment­Submission(assignmentId,
 * studentId, version) fait échouer le second `create()` (P2002).
 * Plutôt que de renvoyer une erreur à l'appelant perdant, on relit et
 * renvoie la ligne gagnante : "getOrCreate" reste idempotent du point
 * de vue de l'appelant, jamais un 409 pour ce qui est en réalité un
 * succès (une seule copie active existe bien, comme demandé).
 */
export async function getOrCreateDraftSubmission(studentId: string, assignmentId: string): Promise<AssessmentSubmission> {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new AssessmentNotFoundError("Assignment introuvable.");
  if (assignment.type !== "TP") {
    throw new InvalidSubmissionStateError(`Seuls les assignments de type "TP" sont soumissibles actuellement.`);
  }

  const current = await getCurrentSubmission(assignmentId, studentId);
  if (current) {
    if (current.status === "draft") return current;
    throw new InvalidSubmissionStateError(
      `Une soumission existe déjà avec le statut "${current.status}" — utilisez resubmitAfterReturn() si elle a été retournée.`
    );
  }

  if (assignment.status !== "published") {
    throw new InvalidSubmissionStateError(
      `Impossible de soumettre un travail pour un assignment "${assignment.status}".`
    );
  }

  try {
    const submission = await prisma.assessmentSubmission.create({
      data: { assignmentId, studentId, version: 1, status: "draft" },
    });
    await logAudit({ actorId: studentId, action: "SUBMISSION_CREATED", entityType: "AssessmentSubmission", entityId: submission.id });
    return submission;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const winner = await getCurrentSubmission(assignmentId, studentId);
      if (winner) return winner;
    }
    throw error;
  }
}

async function requireSubmissionForStudent(studentId: string, submissionId: string): Promise<AssessmentSubmission> {
  const submission = await prisma.assessmentSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) throw new AssessmentNotFoundError("Soumission introuvable.");
  if (submission.studentId !== studentId) {
    await logAudit({ actorId: studentId, action: "ACCESS_DENIED", entityType: "AssessmentSubmission", entityId: submissionId, metadata: { reason: "not_owner" } });
    throw new AssessmentForbiddenError("Cette soumission ne vous appartient pas.");
  }
  return submission;
}

export async function getSubmissionForStudent(studentId: string, submissionId: string): Promise<AssessmentSubmission> {
  return requireSubmissionForStudent(studentId, submissionId);
}

/**
 * Réponses déjà enregistrées d'une soumission (mission Student
 * Enrollment — nécessaire pour recharger un brouillon dans l'UI, gap
 * non comblé par la Mission Student Submission Engine qui ne
 * construisait que le moteur, pas la page). answerData est reparsé en
 * JSON — jamais renvoyé comme chaîne brute au client.
 */
export async function listAnswersForSubmission(studentId: string, submissionId: string) {
  await requireSubmissionForStudent(studentId, submissionId);
  const answers = await prisma.assessmentAnswer.findMany({ where: { submissionId } });
  return answers.map((a) => ({
    questionId: a.questionId,
    answerText: a.answerText,
    answerData: a.answerData ? (JSON.parse(a.answerData) as unknown) : null,
  }));
}

/** Enseignant : ne peut lire qu'une soumission de l'un de SES assignments (mission §26). */
export async function getSubmissionForTeacher(teacherId: string, submissionId: string): Promise<AssessmentSubmission> {
  const submission = await prisma.assessmentSubmission.findUnique({ where: { id: submissionId }, include: { assignment: true } });
  if (!submission) throw new AssessmentNotFoundError("Soumission introuvable.");
  if (submission.assignment.teacherId !== teacherId) {
    await logAudit({ actorId: teacherId, action: "ACCESS_DENIED", entityType: "AssessmentSubmission", entityId: submissionId, metadata: { reason: "not_owner" } });
    throw new AssessmentForbiddenError("Cette soumission n'appartient pas à l'un de vos assignments.");
  }
  return submission;
}

export interface UpsertAnswerInput {
  answerText?: string;
  answerData?: unknown;
  attachmentRef?: string;
}

/**
 * Écrit/modifie une réponse — uniquement tant que la soumission est
 * "draft" (mission §17/§20). La réponse est validée selon le TYPE RÉEL
 * de la question (mission §11-§16) : jamais de jugement sur la
 * justesse, uniquement sur la forme (mission §12).
 *
 * CONCURRENCE (mission §18/§32.B/§32.D) : verrouille la ligne
 * AssessmentSubmission avant de vérifier son statut — une soumission
 * concurrente (SUBMIT) ne peut pas passer "sous les pieds" de cette
 * écriture ; deux sauvegardes concurrentes sur LA MÊME question
 * utilisent l'upsert Postgres (ON CONFLICT), déjà atomique par
 * construction sur la contrainte unique (submissionId, questionId) —
 * jamais deux lignes incohérentes.
 */
export async function upsertAnswer(
  studentId: string,
  submissionId: string,
  questionId: string,
  input: UpsertAnswerInput
): Promise<AssessmentAnswer> {
  return prisma.$transaction(async (tx) => {
    const submission = await lockSubmission(tx, submissionId);
    if (!submission) throw new AssessmentNotFoundError("Soumission introuvable.");
    if (submission.studentId !== studentId) throw new AssessmentForbiddenError("Cette soumission ne vous appartient pas.");
    if (submission.status !== "draft") {
      throw new InvalidSubmissionStateError(`Impossible de modifier une réponse — la soumission est "${submission.status}".`);
    }

    const question = await tx.question.findUnique({ where: { id: questionId } });
    if (!question || question.assignmentId !== submission.assignmentId) {
      throw new AssessmentNotFoundError("Question introuvable pour cet assignment.");
    }

    const answerData = input.answerData !== undefined ? JSON.stringify(input.answerData) : undefined;
    validateAnswerForQuestion(
      question.type as QuestionType,
      { answerText: input.answerText, answerData: input.answerData, attachmentRef: input.attachmentRef },
      parseQuestionContent(question.metadata)
    );

    return tx.assessmentAnswer.upsert({
      where: { submissionId_questionId: { submissionId, questionId } },
      create: { submissionId, questionId, answerText: input.answerText, answerData, attachmentRef: input.attachmentRef },
      update: { answerText: input.answerText, answerData, attachmentRef: input.attachmentRef },
    });
  }, { timeout: 15000 }); // latence réseau observée vers Supabase — voir même correctif en Missions 2/4
}

/** Supprime une réponse — uniquement tant que la soumission est "draft" (mission §17 : "supprimer une réponse si le modèle le permet"). */
export async function deleteAnswer(studentId: string, submissionId: string, questionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const submission = await lockSubmission(tx, submissionId);
    if (!submission) throw new AssessmentNotFoundError("Soumission introuvable.");
    if (submission.studentId !== studentId) throw new AssessmentForbiddenError("Cette soumission ne vous appartient pas.");
    if (submission.status !== "draft") {
      throw new InvalidSubmissionStateError(`Impossible de supprimer une réponse — la soumission est "${submission.status}".`);
    }
    await tx.assessmentAnswer.deleteMany({ where: { submissionId, questionId } });
  }, { timeout: 15000 });
}

/** Erreur de forme sur une réponse — traduite en 400 par la route (voir httpErrors.ts). */
export { InvalidAnswerError };

/**
 * draft → submitted (mission §19, transactionnelle). Verrouille la
 * ligne AVANT de vérifier le statut (voir lockSubmission) — un SUBMIT
 * concurrent ou une SAVE concurrente sont sérialisés par Postgres, pas
 * par une convention applicative (mission §32.C/§32.D).
 *
 * RÈGLE AUDITÉE (mission §19) : le système actuel n'exige PAS que
 * toutes les questions aient une réponse avant soumission — cette règle
 * n'existait pas avant cette mission et n'est PAS inventée ici
 * (conforme à la consigne explicite de ne pas l'ajouter sans mandat).
 * Une soumission avec des réponses manquantes reste soumissible ; le
 * futur moteur de correction / l'enseignant verra ces questions sans
 * AssessmentAnswer associée. Voir rapport, section dédiée.
 */
export async function submitSubmission(studentId: string, submissionId: string): Promise<AssessmentSubmission> {
  const updated = await prisma.$transaction(async (tx) => {
    const submission = await lockSubmission(tx, submissionId);
    if (!submission) throw new AssessmentNotFoundError("Soumission introuvable.");
    if (submission.studentId !== studentId) throw new AssessmentForbiddenError("Cette soumission ne vous appartient pas.");
    if (!canTransitionSubmissionStatus(submission.status as AssessmentSubmissionStatus, "submitted")) {
      throw new InvalidSubmissionStateError(`Impossible de soumettre — statut actuel "${submission.status}".`);
    }

    const assignment = await tx.assignment.findUnique({ where: { id: submission.assignmentId } });
    if (!assignment || assignment.status !== "published") {
      throw new InvalidSubmissionStateError(`Impossible de soumettre — l'assignment n'est plus publié ("${assignment?.status}").`);
    }

    return tx.assessmentSubmission.update({
      where: { id: submissionId },
      data: { status: "submitted", submittedAt: new Date() },
    });
  }, { timeout: 15000 });

  await logAudit({ actorId: studentId, action: "SUBMISSION_SUBMITTED", entityType: "AssessmentSubmission", entityId: submissionId });
  await trackProductEvent({ userId: studentId, eventType: "ASSIGNMENT_SUBMITTED", metadata: { assignmentId: updated.assignmentId, submissionId } });

  return updated;
}

/** submitted → under_review (prise en charge par l'enseignant, optionnel dans le flux). */
export async function markUnderReview(teacherId: string, submissionId: string): Promise<AssessmentSubmission> {
  const updated = await prisma.$transaction(async (tx) => {
    const submission = await lockSubmission(tx, submissionId);
    if (!submission) throw new AssessmentNotFoundError("Soumission introuvable.");
    const assignment = await tx.assignment.findUnique({ where: { id: submission.assignmentId } });
    if (!assignment || assignment.teacherId !== teacherId) {
      throw new AssessmentForbiddenError("Cette soumission n'appartient pas à l'un de vos assignments.");
    }
    if (!canTransitionSubmissionStatus(submission.status as AssessmentSubmissionStatus, "under_review")) {
      throw new InvalidSubmissionStateError(`Impossible de prendre en revue — statut actuel "${submission.status}".`);
    }
    return tx.assessmentSubmission.update({ where: { id: submissionId }, data: { status: "under_review" } });
  }, { timeout: 15000 });
  return updated;
}

/** Enseignant renvoie la copie à l'étudiant (ex. incomplète) — seul moyen d'autoriser une resoumission (mission §21/§22). */
export async function returnSubmission(teacherId: string, submissionId: string): Promise<AssessmentSubmission> {
  const updated = await prisma.$transaction(async (tx) => {
    const submission = await lockSubmission(tx, submissionId);
    if (!submission) throw new AssessmentNotFoundError("Soumission introuvable.");
    const assignment = await tx.assignment.findUnique({ where: { id: submission.assignmentId } });
    if (!assignment || assignment.teacherId !== teacherId) {
      throw new AssessmentForbiddenError("Cette soumission n'appartient pas à l'un de vos assignments.");
    }
    if (!canTransitionSubmissionStatus(submission.status as AssessmentSubmissionStatus, "returned")) {
      throw new InvalidSubmissionStateError(`Impossible de retourner une soumission "${submission.status}".`);
    }
    return tx.assessmentSubmission.update({ where: { id: submissionId }, data: { status: "returned" } });
  }, { timeout: 15000 });

  await logAudit({ actorId: teacherId, action: "SUBMISSION_RETURNED", entityType: "AssessmentSubmission", entityId: submissionId });
  return updated;
}

/**
 * Crée une NOUVELLE version (jamais un écrasement, mission §22) —
 * uniquement si la version courante est "returned". Repart d'un
 * brouillon VIDE (mission §23, décision explicitement conservée telle
 * quelle depuis Mission 3) : "Lors d'une resoumission, les réponses
 * précédentes ne sont pas automatiquement préchargées." Le
 * préchargement pourra être décidé ultérieurement — non modifié ici.
 *
 * CONCURRENCE (mission §32.E) : même mécanisme qu'à la création
 * initiale (contrainte unique + relecture idempotente en cas de
 * course, voir getOrCreateDraftSubmission).
 */
export async function resubmitAfterReturn(studentId: string, assignmentId: string): Promise<AssessmentSubmission> {
  const current = await getCurrentSubmission(assignmentId, studentId);
  if (!current || current.studentId !== studentId) {
    throw new AssessmentForbiddenError("Aucune soumission retournée pour cet étudiant.");
  }
  if (current.status !== "returned") {
    throw new InvalidSubmissionStateError(`Impossible de resoumettre — statut actuel "${current.status}" (seul "returned" l'autorise).`);
  }

  try {
    const submission = await prisma.assessmentSubmission.create({
      data: { assignmentId, studentId, version: current.version + 1, status: "draft" },
    });
    await logAudit({ actorId: studentId, action: "SUBMISSION_CREATED", entityType: "AssessmentSubmission", entityId: submission.id, metadata: { resubmissionOf: current.id, version: submission.version } });
    return submission;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const winner = await getCurrentSubmission(assignmentId, studentId);
      if (winner && winner.version === current.version + 1) return winner;
    }
    throw error;
  }
}
