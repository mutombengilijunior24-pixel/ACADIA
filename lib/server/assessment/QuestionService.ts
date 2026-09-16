// ============================================================
// ACADIA — QUESTION SERVICE (mission Academic Assessment Core, étendu
// par la mission Assignment Builder + TP Intelligence)
//
// VERSIONING (mission §8, exigence critique) : tant que l'assignment
// est "draft", une question peut être modifiée en place (rien n'a
// encore été soumis). Dès que l'assignment n'est plus "draft", toute
// modification crée une NOUVELLE ligne Question (version+1, même
// groupKey) et marque l'ancienne "supersededAt" — jamais un écrasement.
// Une AssessmentAnswer déjà créée continue de référencer l'ancienne
// version, immuable, avec son propre Rubric (voir RubricService.ts).
//
// CONTENU STRUCTURÉ (mission Assignment Builder §9) : MULTIPLE_CHOICE/
// TRUE_FALSE/NUMERIC exigent un `metadata` structuré et validé — jamais
// transformées en questions ouvertes par défaut.
// ============================================================

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db/prisma";
import type { Question } from "@prisma/client";
import {
  AssessmentForbiddenError,
  AssessmentNotFoundError,
  AssessmentConflictError,
  InvalidAssignmentStateError,
  InvalidQuestionContentError,
  TYPES_REQUIRING_STRUCTURED_CONTENT,
  validateQuestionContent,
  type QuestionType,
} from "@/lib/core/assessment/AssessmentTypes";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export interface AddQuestionInput {
  teacherId: string;
  assignmentId: string;
  statement: string;
  type: QuestionType;
  maxScore: number;
  order?: number;
  expectedAnswer?: string;
  instructions?: string;
  metadata?: string;
}

async function requireOwnedAssignment(teacherId: string, assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new AssessmentNotFoundError("Assignment introuvable.");
  if (assignment.teacherId !== teacherId) throw new AssessmentForbiddenError("Cet assignment ne vous appartient pas.");
  return assignment;
}

/** Valide le contenu structuré déclaré (metadata) pour les types objectifs — lève InvalidQuestionContentError si absent/incohérent (mission §9/§11.H). Ne concerne pas OPEN_TEXT/SHORT_ANSWER/CALCULATION (préparatoire, non bloquant — voir mission §10). */
function assertStructuredContentIfNeeded(type: QuestionType, metadata: string | undefined, maxScore: number): void {
  if (!TYPES_REQUIRING_STRUCTURED_CONTENT.includes(type)) return;
  let parsed: unknown = null;
  if (metadata) {
    try {
      parsed = JSON.parse(metadata);
    } catch {
      throw new InvalidQuestionContentError(`Question ${type} : metadata n'est pas un JSON valide.`);
    }
  }
  validateQuestionContent(type, parsed, maxScore);
}

/** Ajout d'une question — uniquement tant que l'assignment est "draft" (ajouter une question après publication changerait le contrat déjà vu par des étudiants, hors scope de cette mission). */
export async function addQuestion(input: AddQuestionInput): Promise<Question> {
  const assignment = await requireOwnedAssignment(input.teacherId, input.assignmentId);
  if (assignment.status !== "draft") {
    throw new InvalidAssignmentStateError("Impossible d'ajouter une question à un assignment déjà publié.");
  }
  assertStructuredContentIfNeeded(input.type, input.metadata, input.maxScore);

  const question = await prisma.question.create({
    data: {
      assignmentId: input.assignmentId,
      groupKey: randomUUID(),
      version: 1,
      order: input.order ?? 0,
      statement: input.statement,
      type: input.type,
      maxScore: input.maxScore,
      expectedAnswer: input.expectedAnswer,
      instructions: input.instructions,
      metadata: input.metadata,
    },
  });

  await logAudit({ actorId: input.teacherId, action: "QUESTION_CREATED", entityType: "Question", entityId: question.id, metadata: { assignmentId: input.assignmentId, type: input.type } });
  await trackProductEvent({ userId: input.teacherId, eventType: "QUESTION_CREATED", metadata: { assignmentId: input.assignmentId, questionType: input.type } });

  return question;
}

export interface UpdateQuestionInput {
  statement?: string;
  type?: QuestionType;
  maxScore?: number;
  order?: number;
  expectedAnswer?: string;
  instructions?: string;
  metadata?: string;
}

async function requireCurrentQuestionOwnedBy(teacherId: string, questionId: string) {
  const question = await prisma.question.findUnique({ where: { id: questionId }, include: { assignment: true } });
  if (!question) throw new AssessmentNotFoundError("Question introuvable.");
  if (question.supersededAt) throw new InvalidAssignmentStateError("Cette version de la question n'est plus la version active.");
  if (question.assignment.teacherId !== teacherId) throw new AssessmentForbiddenError("Cette question ne vous appartient pas.");
  return question;
}

/**
 * Modifie une question. Tant que l'assignment est "draft" : mutation en
 * place (rien n'a encore été vu/répondu). Sinon : verrouillage par
 * versioning (mission §8) — la ligne actuelle est marquée
 * supersededAt, une NOUVELLE ligne (version+1) est créée avec le
 * contenu patché ; toute AssessmentAnswer déjà écrite continue de
 * pointer l'ancienne version, inchangée.
 *
 * CONCURRENCE (mission §16) : deux appels simultanés sur la même
 * question liraient la même `version` de départ — la contrainte unique
 * Question(assignmentId, groupKey, version) fait échouer proprement la
 * transaction perdante (AssessmentConflictError, traduite en 409) au
 * lieu de produire silencieusement deux lignes "version+1" concurrentes.
 */
export async function updateQuestion(teacherId: string, questionId: string, patch: UpdateQuestionInput): Promise<Question> {
  const question = await requireCurrentQuestionOwnedBy(teacherId, questionId);
  const finalType = (patch.type ?? question.type) as QuestionType;
  const finalMaxScore = patch.maxScore ?? Number(question.maxScore.toString());
  const finalMetadata = patch.metadata ?? question.metadata ?? undefined;
  assertStructuredContentIfNeeded(finalType, finalMetadata, finalMaxScore);

  let result: Question;
  let isNewVersion = false;

  if (question.assignment.status === "draft") {
    result = await prisma.question.update({
      where: { id: questionId },
      data: {
        statement: patch.statement,
        type: patch.type,
        maxScore: patch.maxScore,
        order: patch.order,
        expectedAnswer: patch.expectedAnswer,
        instructions: patch.instructions,
        metadata: patch.metadata,
      },
    });
  } else {
    isNewVersion = true;
    try {
      result = await prisma.$transaction(async (tx) => {
        await tx.question.update({ where: { id: questionId }, data: { supersededAt: new Date() } });
        return tx.question.create({
          data: {
            assignmentId: question.assignmentId,
            groupKey: question.groupKey,
            version: question.version + 1,
            order: patch.order ?? question.order,
            statement: patch.statement ?? question.statement,
            type: patch.type ?? (question.type as QuestionType),
            maxScore: patch.maxScore ?? Number(question.maxScore.toString()),
            expectedAnswer: patch.expectedAnswer ?? question.expectedAnswer,
            instructions: patch.instructions ?? question.instructions,
            metadata: patch.metadata ?? question.metadata,
          },
        });
      }, { timeout: 15000 }); // latence réseau observée vers Supabase — voir même correctif en Mission 2
    } catch (error) {
      // Cette transaction ne fait que deux choses simples (marquer
      // l'ancienne version, créer la nouvelle) — tout échec Prisma ici
      // signifie en pratique une course avec une autre modification de
      // LA MÊME question : soit la contrainte unique
      // (assignmentId, groupKey, version) est violée (P2002, le cas
      // attendu), soit — constaté RÉELLEMENT en test sous forte latence
      // réseau (voir rapport, §16) — le pool de transactions Prisma
      // refuse une deuxième transaction concurrente sur la même ligne
      // ("Unable to start a transaction in the given time") avant même
      // d'atteindre la contrainte unique. Dans les deux cas, la réponse
      // à l'appelant est la même : recharger et réessayer, jamais un 500
      // générique pour ce qui reste une situation normale de concurrence.
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AssessmentConflictError(
          "Une autre modification de cette question vient d'être enregistrée en même temps — rechargez la question et réessayez."
        );
      }
      throw error;
    }
  }

  await logAudit({ actorId: teacherId, action: "QUESTION_UPDATED", entityType: "Question", entityId: result.id, metadata: { newVersion: isNewVersion, previousQuestionId: isNewVersion ? questionId : undefined } });
  await trackProductEvent({ userId: teacherId, eventType: "QUESTION_UPDATED", metadata: { questionId: result.id, newVersion: isNewVersion } });

  return result;
}

/** Questions ACTUELLEMENT actives (non supersédées) d'un assignment, ordonnées. */
export async function getCurrentQuestions(assignmentId: string): Promise<Question[]> {
  return prisma.question.findMany({
    where: { assignmentId, supersededAt: null },
    orderBy: { order: "asc" },
  });
}

// ============================================================
// VUE ÉTUDIANTE (mission Student Submission Engine)
//
// Ne JAMAIS exposer expectedAnswer, Rubric/RubricCriteria, ni les
// champs "réponse correcte" du contenu structuré (correctOptionId,
// correctAnswer, exactValue, tolerance, expectedResult, expectedMethod,
// expectedSteps) — mission §13 : "ne jamais exposer inutilement la
// bonne réponse au client".
// ============================================================

export interface StudentQuestion {
  id: string;
  assignmentId: string;
  order: number;
  statement: string;
  type: string;
  maxScore: number;
  instructions: string | null;
  /** Contenu structuré ASSAINI (options sans indication de la bonne réponse pour MULTIPLE_CHOICE, unité seule pour NUMERIC/CALCULATION) — jamais expectedAnswer/correctOptionId/correctAnswer/exactValue/tolerance/expectedResult/expectedMethod/expectedSteps. */
  content: unknown;
}

function sanitizeQuestionContentForStudent(type: string, rawMetadata: string | null): unknown {
  if (!rawMetadata) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawMetadata);
  } catch {
    return null;
  }
  if (type === "MULTIPLE_CHOICE") {
    return { kind: "MULTIPLE_CHOICE", options: parsed.options };
  }
  if (type === "TRUE_FALSE") {
    return { kind: "TRUE_FALSE" };
  }
  if (type === "NUMERIC") {
    return { kind: "NUMERIC", unit: parsed.unit };
  }
  if (type === "CALCULATION") {
    return { kind: "CALCULATION", unit: parsed.unit };
  }
  return null;
}

function toStudentQuestion(question: Question): StudentQuestion {
  return {
    id: question.id,
    assignmentId: question.assignmentId,
    order: question.order,
    statement: question.statement,
    type: question.type,
    maxScore: Number(question.maxScore.toString()),
    instructions: question.instructions,
    content: sanitizeQuestionContentForStudent(question.type, question.metadata),
  };
}

/** Questions courantes d'un assignment, ASSAINIES pour un étudiant (mission §13) — jamais expectedAnswer/rubric/réponse correcte. */
export async function getQuestionsForStudent(assignmentId: string): Promise<StudentQuestion[]> {
  const questions = await getCurrentQuestions(assignmentId);
  return questions.map(toStudentQuestion);
}

/**
 * Questions pertinentes pour UNE soumission précise (mission §9/§10) :
 * pour chaque question logique (groupKey), utilise la version DÉJÀ
 * RÉPONDUE si une AssessmentAnswer existe pour cette soumission —
 * jamais la version courante dans ce cas, même si la question a été
 * versionnée depuis. Les questions pas encore répondues utilisent la
 * version courante. Garantit qu'une soumission ne "bascule" jamais
 * silencieusement vers une autre version après le début des réponses.
 */
export async function getQuestionsForSubmission(submissionId: string): Promise<StudentQuestion[]> {
  const submission = await prisma.assessmentSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) return [];

  const [currentQuestions, answers] = await Promise.all([
    getCurrentQuestions(submission.assignmentId),
    prisma.assessmentAnswer.findMany({ where: { submissionId }, include: { question: true } }),
  ]);

  const byGroupKey = new Map<string, Question>();
  for (const q of currentQuestions) byGroupKey.set(q.groupKey, q);
  // Les versions déjà répondues écrasent la version courante dans cette map —
  // c'est exactement le comportement "figé une fois répondu" recherché.
  for (const a of answers) byGroupKey.set(a.question.groupKey, a.question);

  return Array.from(byGroupKey.values())
    .sort((a, b) => a.order - b.order)
    .map(toStudentQuestion);
}
