// ============================================================
// ACADIA — CONTRAT DU MOTEUR DE CORRECTION IA (préparé Mission 4,
// devenu la référence centrale de la mission AI Grading Engine)
//
// Ce fichier était mort avant cette mission (aucun import ailleurs dans
// le repo, confirmé par audit) — il est ÉTENDU ici, jamais remplacé par
// un second contrat. La forme d'origine (AIGradingRequest/AIGradingResult)
// est conservée ; les champs manquants identifiés par l'audit
// (justification par critère, findings, limitations, niveau de
// confiance normalisé) sont ajoutés.
//
// RÈGLE ABSOLUE (mission §2) : ce contrat ne transporte jamais
// FINAL_SCORE — uniquement une PROPOSITION. Voir
// EvaluationService.applyTeacherDecision pour la seule fonction
// autorisée à déterminer une note finale.
// ============================================================

import type { QuestionType } from "./AssessmentTypes";

export interface AIGradingCriterionInput {
  criterionId: string;
  name: string;
  description: string | null;
  maxScore: number;
  expectedElements: string[] | null;
}

/**
 * Tout ce que le moteur reçoit pour évaluer UNE réponse — jamais moins
 * (mission §1/§4). `studentAnswerText`/`studentAnswerData` sont une
 * DONNÉE NON FIABLE (mission §13) — jamais interprétée comme une
 * instruction par le moteur (voir lib/ai/openai/GradingAI.ts).
 */
export interface AIGradingRequest {
  questionId: string;
  questionType: QuestionType;
  statement: string;
  /** Repère pédagogique — jamais une chaîne à comparer exactement (mission §8/§9). */
  expectedAnswer: string | null;
  maxScore: number;
  criteria: AIGradingCriterionInput[];
  studentAnswerText: string | null;
  studentAnswerData: string | null;
  /** Contexte du cours — optionnel, jamais requis pour évaluer une réponse isolée. */
  courseContext?: { courseName: string; domain?: string };
}

export interface AIGradingCriterionResult {
  criterionId: string;
  score: number;
  maxScore: number;
  confidence: number;
  /** Élément concret de la réponse étudiante qui justifie le score (mission §7 : "evidence"). */
  evidence: string;
  /** Raisonnement du moteur pour CE critère (mission §7 : "justification", distinct d'evidence). */
  justification: string;
}

// ------------------------------------------------------------
// NIVEAU DE CONFIANCE NORMALISÉ (mission §5) — distinct du score
// numérique `confidence` (0..1, déjà porté par Evaluation.confidence
// depuis la Mission 3). Un niveau élevé signifie seulement que le
// moteur estime disposer de suffisamment d'éléments pour proposer une
// évaluation — jamais que la note est scientifiquement certaine
// (mission §5, dernier paragraphe). Calculé par toConfidenceLevel(),
// jamais stocké séparément — source unique de vérité : le score
// numérique déjà persisté.
// ------------------------------------------------------------

export const GRADING_CONFIDENCE_LEVELS = ["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;
export type GradingConfidenceLevel = (typeof GRADING_CONFIDENCE_LEVELS)[number];

export function toConfidenceLevel(confidence: number): GradingConfidenceLevel {
  if (confidence < 0.2) return "VERY_LOW";
  if (confidence < 0.4) return "LOW";
  if (confidence < 0.6) return "MEDIUM";
  if (confidence < 0.8) return "HIGH";
  return "VERY_HIGH";
}

/**
 * Ce que le moteur doit retourner — directement mappable vers
 * Evaluation.{aiScore,confidence,needsHumanReview,aiRawProposal},
 * EvaluationCriterionScore[] (via criterionScores) et EvaluationFeedback
 * (via feedback+findings+warnings+limitations, concaténés en un texte
 * structuré unique — voir EvaluationService.recordAiProposedEvaluation).
 * Ne détermine JAMAIS finalScore — seule une décision humaine le fait
 * (mission §2/§19 : "AI proposes, teacher validates").
 */
export interface AIGradingResult {
  score: number;
  maxScore: number;
  confidence: number;
  needsHumanReview: boolean;
  criterionScores: AIGradingCriterionResult[];
  /** Éléments observés dans la réponse (constats objectifs) — mission §1 exemple. */
  findings: string[];
  /** Commentaire pédagogique destiné à l'étudiant/enseignant. */
  feedback: string[];
  evidence: string[];
  errors: string[];
  warnings: string[];
  /** Ce que le moteur n'a PAS pu vérifier/évaluer avec certitude — jamais une invention pour combler (mission §39). */
  limitations: string[];
}
