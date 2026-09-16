// ============================================================
// ACADIA — VALIDATION LAYER (mission Assignment Builder + TP Intelligence)
//
// Couche de validation dédiée, entre les services CRUD (AssignmentService/
// QuestionService/RubricService) et Prisma — exactement la position
// prévue par l'architecture cible de la mission (§4). Deux
// responsabilités distinctes, jamais mélangées :
//
// - validateForPublication() : contrôle BLOQUANT (mission §11 A-K),
//   appelé par AssignmentService.publishAssignment() avant toute
//   transition de statut.
// - buildAssignmentDiagnostic() : rapport INFORMATIF (mission §12),
//   déterministe, JAMAIS un appel OpenAI — préparatoire au futur
//   Teacher Copilot, pas une décision de blocage en soi (même s'il
//   réutilise les mêmes erreurs que validateForPublication).
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import {
  validateQuestionContent,
  TYPES_REQUIRING_STRUCTURED_CONTENT,
  type QuestionType,
  InvalidQuestionContentError,
} from "@/lib/core/assessment/AssessmentTypes";

const OBJECTIVE_TYPES: readonly QuestionType[] = ["MULTIPLE_CHOICE", "TRUE_FALSE", "NUMERIC"];
const OPEN_TYPES: readonly QuestionType[] = ["OPEN_TEXT", "SHORT_ANSWER"];

function parseMetadata(metadata: string | null): unknown {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Contrôle complet avant publication (mission §11, points A à I — J et K
 * sont des garanties structurelles déjà assurées par QuestionService,
 * pas des propriétés vérifiables sur l'état courant de la base).
 */
export async function validateForPublication(assignmentId: string): Promise<ValidationResult> {
  const errors: string[] = [];

  const questions = await prisma.question.findMany({
    where: { assignmentId, supersededAt: null },
    include: { rubric: { include: { criteria: true } } },
    orderBy: { order: "asc" },
  });

  // A — au moins une question.
  if (questions.length === 0) {
    errors.push("L'assignment ne possède aucune question.");
    return { valid: false, errors };
  }

  // C/D — pas d'ordre ambigu (deux questions courantes avec le même order).
  const orderCounts = new Map<number, number>();
  for (const q of questions) {
    orderCounts.set(q.order, (orderCounts.get(q.order) ?? 0) + 1);
  }
  for (const [order, count] of orderCounts) {
    if (count > 1) {
      errors.push(`${count} questions partagent le même ordre (${order}) — l'ordre doit être unique.`);
    }
  }

  for (const q of questions) {
    const maxScore = Number(q.maxScore.toString());
    const type = q.type as QuestionType;

    // B/F — maxScore valide et jamais négatif.
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      errors.push(`Question "${q.statement.slice(0, 40)}..." : maxScore invalide (${maxScore}).`);
      continue;
    }

    // E/G — rubrique cohérente avec le barème (mission §7/§8 — exigence
    // d'ÉGALITÉ stricte à la publication, plus stricte que le contrôle
    // "≤" déjà appliqué par RubricService.setRubric à l'écriture).
    if (q.rubric) {
      const criteriaTotal = q.rubric.criteria.reduce((sum, c) => sum + Number(c.maxScore.toString()), 0);
      if (criteriaTotal !== maxScore) {
        errors.push(
          `Le total des critères (${criteriaTotal}) ne correspond pas au barème de la question (${maxScore}).`
        );
      }
      for (const c of q.rubric.criteria) {
        const cMax = Number(c.maxScore.toString());
        if (cMax < 0) errors.push(`Critère "${c.name}" : score négatif interdit.`);
        if (cMax > maxScore) errors.push(`Critère "${c.name}" (${cMax}) dépasse le barème de la question (${maxScore}).`);
      }
    }

    // H — données structurées nécessaires pour les types objectifs.
    if (TYPES_REQUIRING_STRUCTURED_CONTENT.includes(type)) {
      try {
        validateQuestionContent(type, parseMetadata(q.metadata), maxScore);
      } catch (error) {
        if (error instanceof InvalidQuestionContentError) errors.push(error.message);
        else throw error;
      }
    }

    // I — contexte d'évaluation complet : expectedAnswer, OU rubric, OU
    // (types objectifs) contenu structuré déjà validé ci-dessus.
    const hasEvaluationContext =
      Boolean(q.expectedAnswer?.trim()) || Boolean(q.rubric) || TYPES_REQUIRING_STRUCTURED_CONTENT.includes(type);
    if (!hasEvaluationContext) {
      errors.push(`Question "${q.statement.slice(0, 40)}..." : aucun contexte d'évaluation (ni expectedAnswer, ni rubrique).`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export interface AssignmentDiagnostic {
  assignmentId: string;
  title: string;
  questionCount: number;
  totalPoints: number;
  distribution: {
    objective: { count: number; points: number };
    open: { count: number; points: number };
    calculation: { count: number; points: number };
  };
  questionsWithoutRubric: string[];
  /** Heuristique déterministe (jamais IA) : un critère unique OU aucune description sur la rubrique. */
  genericRubricWarnings: string[];
  publishable: boolean;
  errors: string[];
}

/**
 * Diagnostic informatif, déterministe (mission §12 — "NE PAS utiliser
 * OpenAI pour ces contrôles"). Préparatoire au futur Teacher Copilot,
 * ne bloque rien par lui-même — seul validateForPublication() bloque.
 */
export async function buildAssignmentDiagnostic(assignmentId: string): Promise<AssignmentDiagnostic> {
  const assignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
  const questions = await prisma.question.findMany({
    where: { assignmentId, supersededAt: null },
    include: { rubric: { include: { criteria: true } } },
    orderBy: { order: "asc" },
  });

  const distribution = {
    objective: { count: 0, points: 0 },
    open: { count: 0, points: 0 },
    calculation: { count: 0, points: 0 },
  };
  const questionsWithoutRubric: string[] = [];
  const genericRubricWarnings: string[] = [];
  let totalPoints = 0;

  for (const q of questions) {
    const maxScore = Number(q.maxScore.toString());
    totalPoints += maxScore;
    const type = q.type as QuestionType;

    if (OBJECTIVE_TYPES.includes(type)) {
      distribution.objective.count += 1;
      distribution.objective.points += maxScore;
    } else if (OPEN_TYPES.includes(type)) {
      distribution.open.count += 1;
      distribution.open.points += maxScore;
    } else if (type === "CALCULATION") {
      distribution.calculation.count += 1;
      distribution.calculation.points += maxScore;
    }

    if ((OPEN_TYPES.includes(type) || type === "CALCULATION") && !q.rubric) {
      questionsWithoutRubric.push(q.id);
    }

    if (q.rubric) {
      const criteria = q.rubric.criteria;
      const looksGeneric = criteria.length <= 1 || criteria.every((c) => !c.description?.trim());
      if (looksGeneric) genericRubricWarnings.push(q.id);
    }
  }

  const { valid, errors } = await validateForPublication(assignmentId);

  return {
    assignmentId,
    title: assignment.title,
    questionCount: questions.length,
    totalPoints,
    distribution,
    questionsWithoutRubric,
    genericRubricWarnings,
    publishable: valid,
    errors,
  };
}
