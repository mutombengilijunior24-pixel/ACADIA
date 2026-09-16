// ============================================================
// ACADIA — AI GRADING SERVICE (mission AI Grading Engine)
//
// Orchestrateur : ne construit AUCUNE intelligence de correction
// lui-même — délègue à DeterministicGrading.ts (MC/TF/NUMERIC) ou
// GradingAI.ts (OPEN_TEXT/SHORT_ANSWER/CALCULATION), puis persiste via
// EvaluationService.recordAiProposedEvaluation, le SEUL chemin
// d'écriture d'une proposition d'évaluation (mission Academic
// Assessment Core, jamais dupliqué ici).
//
// PERFORMANCE (mission §34) : AUCUNE transaction Prisma n'englobe
// l'appel réseau OpenAI — le chargement (lecture pure), l'appel IA
// (hors transaction) et la persistance (transaction courte, interne à
// recordAiProposedEvaluation) restent trois étapes séparées.
//
// GARDE ANTI-ÉCRASEMENT (own reasoned decision) : une Evaluation déjà
// DÉCIDÉE par un enseignant (accepted/modified/rejected/finalized)
// n'est jamais re-proposée silencieusement — recordAiProposedEvaluation
// réinitialise TOUJOURS le statut à "ai_proposed" par construction
// (mission Academic Assessment Core), ce qui effacerait une décision
// humaine si on le laissait faire sans garde. `force: true` autorise
// explicitement un nouveau cycle de correction (ex. relance après
// modification de la grille) — jamais un comportement par défaut.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { AssessmentAnswer, Question } from "@prisma/client";
import {
  AssessmentForbiddenError,
  AssessmentNotFoundError,
  type QuestionContent,
  type QuestionType,
  type StudentAnswerContent,
} from "@/lib/core/assessment/AssessmentTypes";
import type { AIGradingCriterionInput, AIGradingRequest, AIGradingResult } from "@/lib/core/assessment/AIGradingContract";
import { gradeDeterministically, isDeterministicallyGradable, DETERMINISTIC_GRADING_MODEL_TAG } from "./DeterministicGrading";
import { gradeAnswerWithAI } from "@/lib/ai/openai/GradingAI";
import { selectModel } from "@/lib/server/ai/ModelRouter";
import { recordAiProposedEvaluation } from "./EvaluationService";
import { getRubric } from "./RubricService";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import { createNotification } from "@/lib/supervision/NotificationStore";
import type { AITrackingInput } from "@/lib/ai/openai/SubjectUnderstandingAI";

const DECIDED_EVALUATION_STATUSES = new Set(["accepted", "modified", "rejected", "finalized"]);

export interface GradeSubmissionOptions {
  /** Autorise une nouvelle proposition même si une décision humaine existe déjà pour une réponse (mission : relance après modification de la grille). Jamais true par défaut. */
  force?: boolean;
}

export type GradeAnswerOutcome = "graded" | "skipped_already_decided" | "skipped_no_content" | "failed";

export interface GradeAnswerResult {
  answerId: string;
  questionId: string;
  questionType: QuestionType;
  outcome: GradeAnswerOutcome;
  source: "deterministic" | "ai" | null;
  evaluationId?: string;
  errorMessage?: string;
}

async function loadSubmissionForGrading(teacherId: string, submissionId: string) {
  const submission = await prisma.assessmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: true,
      answers: { include: { question: true, evaluation: true } },
    },
  });
  if (!submission) throw new AssessmentNotFoundError("Soumission introuvable.");
  if (submission.assignment.teacherId !== teacherId) {
    await logAudit({ actorId: teacherId, action: "ACCESS_DENIED", entityType: "AssessmentSubmission", entityId: submissionId, metadata: { reason: "not_owner" } });
    throw new AssessmentForbiddenError("Cette soumission n'appartient pas à l'un de vos assignments.");
  }
  return submission;
}

function parseQuestionContent(metadata: string | null): QuestionContent | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as QuestionContent;
  } catch {
    return null;
  }
}

function parseStudentAnswer(answerData: string | null): StudentAnswerContent | null {
  if (!answerData) return null;
  try {
    return JSON.parse(answerData) as StudentAnswerContent;
  } catch {
    return null;
  }
}

/** Concatène le vocabulaire de sortie du moteur en un texte pédagogique unique (EvaluationFeedback.text) — findings/limitations/warnings jamais perdus, mais jamais non plus éclatés en colonnes supplémentaires alors qu'aiRawProposal les conserve déjà intégralement. */
function buildFeedbackText(result: AIGradingResult): string | undefined {
  const parts: string[] = [];
  if (result.feedback.length) parts.push(result.feedback.join(" "));
  if (result.findings.length) parts.push(`Constats : ${result.findings.join(" ")}`);
  if (result.limitations.length) parts.push(`Limites de la correction : ${result.limitations.join(" ")}`);
  if (result.warnings.length) parts.push(`Avertissements : ${result.warnings.join(" ")}`);
  return parts.length ? parts.join("\n\n") : undefined;
}

async function persistGradingResult(answerId: string, aiModel: string, result: AIGradingResult) {
  const criterionScores = result.criterionScores.map((c) => ({
    criterionId: c.criterionId,
    score: c.score,
    maxScore: c.maxScore,
    confidence: c.confidence,
    evidence: c.evidence || undefined,
    comment: c.justification || undefined,
  }));

  return recordAiProposedEvaluation({
    answerId,
    aiScore: result.score,
    aiModel,
    confidence: result.confidence,
    criterionScores: criterionScores.length ? criterionScores : undefined,
    feedbackText: buildFeedbackText(result),
    aiRawProposal: JSON.stringify(result),
  });
}

async function buildAiRequest(question: Question, answer: AssessmentAnswer): Promise<AIGradingRequest> {
  const rubric = await getRubric(question.id);
  const criteria: AIGradingCriterionInput[] = (rubric?.criteria ?? []).map((c) => ({
    criterionId: c.id,
    name: c.name,
    description: c.description,
    maxScore: Number(c.maxScore.toString()),
    expectedElements: c.expectedElements ? (JSON.parse(c.expectedElements) as string[]) : null,
  }));

  return {
    questionId: question.id,
    questionType: question.type as QuestionType,
    statement: question.statement,
    expectedAnswer: question.expectedAnswer,
    maxScore: Number(question.maxScore.toString()),
    criteria,
    studentAnswerText: answer.answerText,
    studentAnswerData: answer.answerData,
  };
}

/**
 * Corrige UNE réponse. Ne lève jamais d'exception pour un échec du
 * moteur de correction lui-même (réseau OpenAI, sortie invalide) — le
 * résultat porte `outcome: "failed"`, l'appelant décide (mission :
 * une réponse difficile ne doit jamais interrompre la correction des
 * autres réponses de la même soumission).
 */
async function gradeOneAnswer(
  answer: AssessmentAnswer & { question: Question; evaluation: { status: string } | null },
  teacherId: string,
  tracking: AITrackingInput,
  options: GradeSubmissionOptions
): Promise<GradeAnswerResult> {
  const questionType = answer.question.type as QuestionType;
  const base = { answerId: answer.id, questionId: answer.question.id, questionType };

  if (answer.evaluation && DECIDED_EVALUATION_STATUSES.has(answer.evaluation.status) && !options.force) {
    return { ...base, outcome: "skipped_already_decided", source: null };
  }

  const questionContent = parseQuestionContent(answer.question.metadata);
  const studentAnswer = parseStudentAnswer(answer.answerData);
  const maxScore = Number(answer.question.maxScore.toString());

  try {
    if (isDeterministicallyGradable(questionType)) {
      const result = gradeDeterministically(questionType, questionContent, studentAnswer, maxScore);
      if (!result) return { ...base, outcome: "skipped_no_content", source: null };
      const evaluation = await persistGradingResult(answer.id, DETERMINISTIC_GRADING_MODEL_TAG, result);
      return { ...base, outcome: "graded", source: "deterministic", evaluationId: evaluation.id };
    }

    if (!answer.answerText && !studentAnswer) {
      return { ...base, outcome: "skipped_no_content", source: null };
    }

    const request = await buildAiRequest(answer.question, answer);
    const { model } = selectModel("ASSESSMENT_GRADING");
    const result = await gradeAnswerWithAI(request, tracking);
    const evaluation = await persistGradingResult(answer.id, model, result);
    return { ...base, outcome: "graded", source: "ai", evaluationId: evaluation.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue lors de la correction.";
    await logAudit({
      actorId: teacherId,
      action: "AI_GRADING_FAILED",
      entityType: "AssessmentAnswer",
      entityId: answer.id,
      metadata: { questionType, reason: errorMessage.slice(0, 200) },
    });
    await trackProductEvent({ userId: teacherId, eventType: "AI_GRADING_FAILED", metadata: { answerId: answer.id } });
    return { ...base, outcome: "failed", source: null, errorMessage };
  }
}

/**
 * Corrige TOUTES les réponses non encore décidées d'UNE soumission
 * (jamais un lot inter-classe — mission : un enseignant déclenche une
 * correction sur une copie à la fois). Chaque réponse échoue
 * indépendamment des autres.
 */
export async function gradeSubmission(
  teacherId: string,
  submissionId: string,
  tracking: AITrackingInput = {},
  options: GradeSubmissionOptions = {}
): Promise<GradeAnswerResult[]> {
  const submission = await loadSubmissionForGrading(teacherId, submissionId);

  await logAudit({ actorId: teacherId, action: "AI_GRADING_REQUESTED", entityType: "AssessmentSubmission", entityId: submissionId, metadata: { answerCount: submission.answers.length, force: !!options.force } });
  await trackProductEvent({ userId: teacherId, eventType: "AI_GRADING_REQUESTED", metadata: { submissionId } });

  const results: GradeAnswerResult[] = [];
  for (const answer of submission.answers) {
    results.push(await gradeOneAnswer(answer, teacherId, tracking, options));
  }
  return results;
}

/** Enseignant uniquement (mission : "Student B ne peut pas lire la proposition IA de Student A" — s'étend ici à "un étudiant, quel qu'il soit, ne lit jamais une proposition IA avant validation enseignante"). */
export async function getEvaluationForTeacher(teacherId: string, answerId: string) {
  const answer = await prisma.assessmentAnswer.findUnique({
    where: { id: answerId },
    include: {
      question: true,
      submission: { include: { assignment: true } },
      evaluation: { include: { criterionScores: true, feedbacks: true } },
    },
  });
  if (!answer) throw new AssessmentNotFoundError("Réponse introuvable.");
  if (answer.submission.assignment.teacherId !== teacherId) {
    await logAudit({ actorId: teacherId, action: "ACCESS_DENIED", entityType: "AssessmentAnswer", entityId: answerId, metadata: { reason: "not_owner" } });
    throw new AssessmentForbiddenError("Cette réponse n'appartient pas à l'un de vos assignments.");
  }
  if (!answer.evaluation) throw new AssessmentNotFoundError("Aucune évaluation n'existe encore pour cette réponse.");
  return answer.evaluation;
}

/** Même garde que getEvaluationForTeacher, mais adressée par (submission, question) — c'est ce que l'UI enseignant connaît réellement (une réponse est adressée par sa question au sein d'une copie, jamais par un answerId brut côté client). */
export async function getEvaluationForTeacherBySubmissionAndQuestion(teacherId: string, submissionId: string, questionId: string) {
  const answer = await prisma.assessmentAnswer.findUnique({
    where: { submissionId_questionId: { submissionId, questionId } },
  });
  if (!answer) throw new AssessmentNotFoundError("Réponse introuvable pour cette question.");
  return getEvaluationForTeacher(teacherId, answer.id);
}

// ============================================================
// MISSION 9 — CORRECTION AUTOMATIQUE À LA SOUMISSION
//
// Appelée depuis app/api/assessment/submissions/[id]/submit/route.ts
// via `after()` (next/server) — donc TOUJOURS hors du corps de la
// réponse HTTP envoyée à l'étudiant, jamais un facteur de lenteur pour
// lui. Réutilise gradeSubmission telle quelle (aucune logique de
// correction dupliquée) : l'"enseignant déclencheur" est simplement
// résolu comme le vrai propriétaire du TP, jamais un utilisateur système
// fictif — la garde de propriété de gradeSubmission reste donc
// pleinement valide même pour un déclenchement automatique.
//
// Ne lève JAMAIS d'exception vers l'appelant (le callback `after()` n'a
// personne à qui la remonter) — toute erreur inattendue se traduit par
// une notification honnête invitant à une correction manuelle, jamais
// par un échec silencieux.
// ============================================================

export async function autoGradeSubmissionAfterSubmit(submissionId: string): Promise<void> {
  const submission = await prisma.assessmentSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: true },
  });
  if (!submission) return;

  const teacherId = submission.assignment.teacherId;

  await logAudit({ actorId: teacherId, action: "AI_GRADING_AUTO_TRIGGERED", entityType: "AssessmentSubmission", entityId: submissionId });
  await trackProductEvent({ userId: teacherId, eventType: "AI_GRADING_AUTO_TRIGGERED", metadata: { submissionId } });

  try {
    const results = await gradeSubmission(teacherId, submissionId, { userId: teacherId });
    const gradedCount = results.filter((r) => r.outcome === "graded").length;
    const hasFailure = results.some((r) => r.outcome === "failed");

    await createNotification({
      userId: teacherId,
      type: "grading_ready",
      title: hasFailure ? "Copie reçue — correction automatique incomplète" : "Nouvelle copie prête à valider",
      body: hasFailure
        ? `${gradedCount}/${results.length} réponse(s) corrigée(s) automatiquement. Une partie a échoué — vérifiez et corrigez manuellement si besoin.`
        : `${gradedCount} réponse(s) corrigée(s) automatiquement, prête(s) à être validée(s).`,
      relatedSubmissionId: submissionId,
    });
  } catch (error) {
    await logAudit({ actorId: teacherId, action: "AI_GRADING_FAILED", entityType: "AssessmentSubmission", entityId: submissionId, metadata: { reason: error instanceof Error ? error.message.slice(0, 200) : "Erreur inconnue" } });
    await createNotification({
      userId: teacherId,
      type: "grading_ready",
      title: "Nouvelle copie reçue",
      body: "Une copie a été soumise mais la correction automatique n'a pas pu démarrer — à corriger manuellement.",
      relatedSubmissionId: submissionId,
    });
  }
}
