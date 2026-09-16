// ============================================================
// ACADIA — RUBRIC SERVICE (mission Academic Assessment Core)
//
// Un Rubric est lié 1:1 à UNE version précise de Question (mission
// §8/§9) — jamais partagé entre versions. expectedElements reste une
// liste de repères pédagogiques, jamais une formulation exacte exigée
// (mission §9, dernier paragraphe : "la réponse modèle n'est PAS
// l'unique formulation acceptable").
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { Rubric, RubricCriterion } from "@prisma/client";
import { AssessmentForbiddenError, AssessmentNotFoundError, InvalidAssignmentStateError, assertValidScore } from "@/lib/core/assessment/AssessmentTypes";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export interface RubricCriterionInput {
  name: string;
  description?: string;
  maxScore: number;
  expectedElements?: string[];
  weight?: number;
  order?: number;
}

/**
 * Remplace intégralement le barème d'UNE version de question. Autorisé
 * uniquement tant que l'assignment est "draft" — au-delà, changer le
 * barème d'une question déjà publiée doit passer par
 * QuestionService.updateQuestion (nouvelle version), jamais par une
 * mutation silencieuse du barème existant déjà vu par des étudiants.
 *
 * Contrôle appliqué ICI : la somme des critères ne doit jamais DÉPASSER
 * le maxScore de la question (garde-fou immédiat pendant la
 * construction, un enseignant peut légitimement ajouter ses critères un
 * rubric à la fois avant d'atteindre le total visé). L'EXIGENCE
 * D'ÉGALITÉ STRICTE (mission Assignment Builder §7/§8) est appliquée
 * plus tard, au moment de la publication — voir
 * AssignmentValidation.validateForPublication(), qui bloque toute
 * publication tant que la somme n'égale pas exactement le barème.
 */
export async function setRubric(teacherId: string, questionId: string, criteria: RubricCriterionInput[]): Promise<Rubric & { criteria: RubricCriterion[] }> {
  const question = await prisma.question.findUnique({ where: { id: questionId }, include: { assignment: true } });
  if (!question) throw new AssessmentNotFoundError("Question introuvable.");
  if (question.assignment.teacherId !== teacherId) throw new AssessmentForbiddenError("Cette question ne vous appartient pas.");
  if (question.assignment.status !== "draft") {
    throw new InvalidAssignmentStateError("Impossible de modifier le barème d'un assignment déjà publié.");
  }

  const questionMaxScore = Number(question.maxScore.toString());
  const criteriaTotal = criteria.reduce((sum, c) => sum + c.maxScore, 0);
  if (criteriaTotal > questionMaxScore) {
    throw new InvalidAssignmentStateError(
      `La somme des critères (${criteriaTotal}) dépasse le maxScore de la question (${questionMaxScore}).`
    );
  }
  for (const c of criteria) {
    assertValidScore(0, c.maxScore, `Critère "${c.name}"`);
  }

  const rubric = await prisma.$transaction(async (tx) => {
    await tx.rubric.deleteMany({ where: { questionId } }); // cascade supprime les anciens critères
    return tx.rubric.create({
      data: {
        questionId,
        criteria: {
          create: criteria.map((c, index) => ({
            name: c.name,
            description: c.description,
            maxScore: c.maxScore,
            expectedElements: c.expectedElements ? JSON.stringify(c.expectedElements) : null,
            weight: c.weight,
            order: c.order ?? index,
          })),
        },
      },
      include: { criteria: true },
    });
  }, { timeout: 15000 }); // latence réseau observée vers Supabase — voir même correctif en Mission 2 (PaymentService)

  await logAudit({ actorId: teacherId, action: "RUBRIC_CREATED", entityType: "Rubric", entityId: rubric.id, metadata: { questionId, criteriaCount: criteria.length } });
  await trackProductEvent({ userId: teacherId, eventType: "RUBRIC_CREATED", metadata: { questionId } });

  return rubric;
}

export async function getRubric(questionId: string) {
  return prisma.rubric.findUnique({ where: { questionId }, include: { criteria: { orderBy: { order: "asc" } } } });
}
