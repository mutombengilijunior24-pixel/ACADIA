// ============================================================
// ACADIA — EVALUATION SERVICE (mission Academic Assessment Core)
//
// RÈGLE ABSOLUE (mission §13/§18) : aiScore et humanScore ne sont
// JAMAIS écrasés l'un par l'autre — deux colonnes distinctes, toujours
// conservées telles quelles. AI proposes, teacher validates : aucune
// Evaluation n'atteint finalScore sans une décision humaine explicite
// (accept/modify/reject) via applyTeacherDecision(). Ce module ne
// construit AUCUNE intelligence de correction IA — recordAiProposedEvaluation
// reçoit un score déjà calculé ailleurs (futur moteur, hors scope).
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { Evaluation } from "@prisma/client";
import { logAudit, type AuditAction } from "@/lib/server/audit/AuditLog";
import { trackProductEvent, type ProductEventType } from "@/lib/server/analytics/ProductEvents";
import {
  AssessmentForbiddenError,
  AssessmentNotFoundError,
  InvalidSubmissionStateError,
  assertValidScore,
  canTransitionSubmissionStatus,
  type TeacherDecision,
  type AssessmentSubmissionStatus,
} from "@/lib/core/assessment/AssessmentTypes";

export interface CriterionScoreInput {
  criterionId: string;
  score: number;
  maxScore: number;
  confidence?: number;
  evidence?: string;
  comment?: string;
}

export interface RecordAiProposedEvaluationInput {
  answerId: string;
  aiScore: number;
  aiModel?: string;
  confidence?: number;
  criterionScores?: CriterionScoreInput[];
  feedbackText?: string;
  /** Proposition complète validée (JSON de AIGradingResult — mission AI Grading Engine) — traçabilité intégrale au-delà du texte de feedback condensé, jamais interprétée ici. */
  aiRawProposal?: string;
}

async function getAnswerWithQuestion(answerId: string) {
  const answer = await prisma.assessmentAnswer.findUnique({
    where: { id: answerId },
    include: { question: true, submission: { include: { assignment: true } } },
  });
  if (!answer) throw new AssessmentNotFoundError("Réponse introuvable.");
  return answer;
}

/**
 * Enregistre une proposition IA — needsHumanReview reste TOUJOURS true
 * (mission §18, "AI proposes") : aucune Evaluation créée ici ne peut
 * devenir finale sans passer par applyTeacherDecision().
 */
export async function recordAiProposedEvaluation(input: RecordAiProposedEvaluationInput): Promise<Evaluation> {
  const answer = await getAnswerWithQuestion(input.answerId);
  assertValidScore(input.aiScore, Number(answer.question.maxScore.toString()), "aiScore");
  for (const c of input.criterionScores ?? []) {
    assertValidScore(c.score, c.maxScore, `Critère ${c.criterionId}`);
  }

  const evaluation = await prisma.$transaction(async (tx) => {
    const created = await tx.evaluation.upsert({
      where: { answerId: input.answerId },
      create: {
        answerId: input.answerId,
        aiScore: input.aiScore,
        confidence: input.confidence,
        aiModel: input.aiModel,
        aiRawProposal: input.aiRawProposal,
        status: "ai_proposed",
        needsHumanReview: true,
      },
      update: {
        aiScore: input.aiScore,
        confidence: input.confidence,
        aiModel: input.aiModel,
        aiRawProposal: input.aiRawProposal,
        status: "ai_proposed",
        needsHumanReview: true,
        // finalScore/humanScore NE SONT JAMAIS touchés ici — une
        // re-proposition IA ne doit jamais effacer une décision
        // humaine déjà enregistrée par le passé pour cette réponse.
      },
    });

    if (input.criterionScores?.length) {
      await tx.evaluationCriterionScore.deleteMany({ where: { evaluationId: created.id } });
      await tx.evaluationCriterionScore.createMany({
        data: input.criterionScores.map((c) => ({
          evaluationId: created.id,
          criterionId: c.criterionId,
          score: c.score,
          maxScore: c.maxScore,
          confidence: c.confidence,
          evidence: c.evidence,
          comment: c.comment,
        })),
      });
    }

    if (input.feedbackText) {
      await tx.evaluationFeedback.create({
        data: { evaluationId: created.id, source: "ai", text: input.feedbackText },
      });
    }

    return created;
  }, { timeout: 15000 }); // latence réseau observée vers Supabase — voir même correctif en Mission 2

  await logAudit({ action: "EVALUATION_CREATED", entityType: "Evaluation", entityId: evaluation.id, metadata: { answerId: input.answerId, aiScore: input.aiScore } });
  await trackProductEvent({ eventType: "AI_GRADING_PROPOSED", metadata: { answerId: input.answerId } });

  return evaluation;
}

async function requireEvaluationOwnedByTeacher(teacherId: string, evaluationId: string) {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: { answer: { include: { question: true, submission: { include: { assignment: true } } } } },
  });
  if (!evaluation) throw new AssessmentNotFoundError("Évaluation introuvable.");
  if (evaluation.answer.submission.assignment.teacherId !== teacherId) {
    await logAudit({ actorId: teacherId, action: "ACCESS_DENIED", entityType: "Evaluation", entityId: evaluationId, metadata: { reason: "not_owner" } });
    throw new AssessmentForbiddenError("Cette évaluation n'appartient pas à l'un de vos assignments.");
  }
  return evaluation;
}

export interface ApplyTeacherDecisionInput {
  teacherId: string;
  evaluationId: string;
  decision: TeacherDecision;
  /** Requis pour "modify" et "reject" — jamais halluciné, toujours fourni explicitement par l'enseignant. */
  humanScore?: number;
  feedbackText?: string;
}

const DECISION_TO_STATUS = { accept: "accepted", modify: "modified", reject: "rejected" } as const;
const DECISION_TO_AUDIT_ACTION: Record<TeacherDecision, AuditAction> = {
  accept: "EVALUATION_ACCEPTED",
  modify: "EVALUATION_MODIFIED",
  reject: "EVALUATION_REJECTED",
};
const DECISION_TO_PRODUCT_EVENT: Record<TeacherDecision, ProductEventType> = {
  accept: "AI_GRADING_ACCEPTED",
  modify: "AI_GRADING_MODIFIED",
  reject: "AI_GRADING_REJECTED",
};

/**
 * LA seule fonction qui fait progresser une Evaluation au-delà de
 * "ai_proposed". aiScore n'est JAMAIS modifié ici, quelle que soit la
 * décision (mission §13) — seul humanScore/finalScore/status changent.
 */
export async function applyTeacherDecision(input: ApplyTeacherDecisionInput): Promise<Evaluation> {
  const evaluation = await requireEvaluationOwnedByTeacher(input.teacherId, input.evaluationId);
  const maxScore = Number(evaluation.answer.question.maxScore.toString());

  let humanScore: number | null = null;
  let finalScore: number;

  if (input.decision === "accept") {
    if (evaluation.aiScore === null) {
      throw new InvalidSubmissionStateError("Impossible d'accepter — aucun score IA n'a été proposé.");
    }
    finalScore = Number(evaluation.aiScore.toString());
  } else {
    // "modify" et "reject" exigent tous deux un score humain explicite
    // — la seule différence est le degré d'accord avec l'IA, pas la
    // mécanique de calcul.
    if (input.humanScore === undefined) {
      throw new InvalidSubmissionStateError(`La décision "${input.decision}" requiert un humanScore.`);
    }
    assertValidScore(input.humanScore, maxScore, "humanScore");
    humanScore = input.humanScore;
    finalScore = input.humanScore;
  }

  const updated = await prisma.evaluation.update({
    where: { id: input.evaluationId },
    data: {
      humanScore,
      finalScore,
      status: DECISION_TO_STATUS[input.decision],
      needsHumanReview: false,
    },
  });

  if (input.feedbackText) {
    await prisma.evaluationFeedback.create({
      data: { evaluationId: input.evaluationId, source: "teacher", text: input.feedbackText },
    });
  }

  await logAudit({
    actorId: input.teacherId,
    action: DECISION_TO_AUDIT_ACTION[input.decision],
    entityType: "Evaluation",
    entityId: input.evaluationId,
    metadata: { finalScore, humanScore: humanScore ?? undefined },
  });
  await trackProductEvent({ userId: input.teacherId, eventType: DECISION_TO_PRODUCT_EVENT[input.decision], metadata: { evaluationId: input.evaluationId } });

  return updated;
}

/**
 * Finalise la note d'une soumission — exige que TOUTES les réponses
 * aient une Evaluation déjà décidée (accepted/modified/rejected),
 * jamais encore "ai_proposed"/"human_review" (mission §18 : rien n'est
 * définitif sans validation humaine complète). Le statut de la
 * soumission DOIT permettre la transition vers "graded" (mission
 * Student Submission Engine §21 — canTransitionSubmissionStatus) :
 * corrige une lacune réelle de la Mission 3/4, où cette fonction
 * pouvait auparavant faire passer une soumission "draft" directement à
 * "graded" (voir rapport, incidents).
 */
export async function finalizeSubmissionGrade(teacherId: string, submissionId: string): Promise<{ totalScore: number; totalMaxScore: number; percentage: number }> {
  const submission = await prisma.assessmentSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: true, answers: { include: { evaluation: true, question: true } } },
  });
  if (!submission) throw new AssessmentNotFoundError("Soumission introuvable.");
  if (submission.assignment.teacherId !== teacherId) throw new AssessmentForbiddenError("Cette soumission n'appartient pas à l'un de vos assignments.");
  if (!canTransitionSubmissionStatus(submission.status as AssessmentSubmissionStatus, "graded")) {
    throw new InvalidSubmissionStateError(`Impossible de finaliser une note — statut actuel "${submission.status}".`);
  }

  const decidedStatuses = new Set(["accepted", "modified", "rejected", "finalized"]);
  const undecided = submission.answers.filter((a) => !a.evaluation || !decidedStatuses.has(a.evaluation.status));
  if (undecided.length > 0) {
    throw new InvalidSubmissionStateError(
      `Impossible de finaliser — ${undecided.length} réponse(s) n'ont pas encore de décision humaine.`
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const answer of submission.answers) {
      if (answer.evaluation && answer.evaluation.status !== "finalized") {
        await tx.evaluation.update({ where: { id: answer.evaluation.id }, data: { status: "finalized" } });
      }
    }
    await tx.assessmentSubmission.update({
      where: { id: submissionId },
      data: { status: "graded", finalizedAt: new Date() },
    });
  }, { timeout: 15000 }); // latence réseau observée vers Supabase — voir même correctif en Mission 2

  await logAudit({ actorId: teacherId, action: "GRADE_FINALIZED", entityType: "AssessmentSubmission", entityId: submissionId });
  await trackProductEvent({ userId: teacherId, eventType: "ASSIGNMENT_GRADED", metadata: { submissionId, assignmentId: submission.assignmentId } });

  return computeSubmissionTotal(submission.answers.map((a) => ({ maxScore: Number(a.question.maxScore.toString()), finalScore: a.evaluation ? Number((a.evaluation.finalScore ?? 0).toString()) : 0 })));
}

/**
 * Calcul PUR, jamais stocké (mission §16 : "ne pas mélanger score de
 * question / note globale / moyenne de période" — la note globale d'une
 * soumission reste un calcul dérivé, pas une table Grade dupliquant les
 * Evaluation sous-jacentes tant qu'aucun besoin réel ne le justifie).
 */
export function computeSubmissionTotal(answers: { maxScore: number; finalScore: number }[]): { totalScore: number; totalMaxScore: number; percentage: number } {
  const totals = answers.reduce(
    (acc, a) => ({ totalScore: acc.totalScore + a.finalScore, totalMaxScore: acc.totalMaxScore + a.maxScore }),
    { totalScore: 0, totalMaxScore: 0 }
  );
  return { ...totals, percentage: totals.totalMaxScore > 0 ? (totals.totalScore / totals.totalMaxScore) * 100 : 0 };
}
