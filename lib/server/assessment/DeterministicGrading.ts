// ============================================================
// ACADIA — CORRECTION DÉTERMINISTE (mission AI Grading Engine)
//
// Pour MULTIPLE_CHOICE / TRUE_FALSE / NUMERIC : la question porte déjà
// toute l'information nécessaire pour vérifier la réponse (option
// correcte, booléen attendu, valeur exacte + tolérance — voir
// QuestionContent dans AssessmentTypes.ts). Comparer ces valeurs est une
// opération arithmétique/booléenne triviale : appeler l'IA pour ça
// ajouterait coût, latence et risque sans bénéfice (mission §—
// "réduction coût/latence/risque").
//
// NUMERIC est une extension volontaire au-delà des deux types cités
// explicitement par la mission : exactValue/tolerance sont déjà des
// données structurées fournies par l'enseignant (voir NumericContent),
// donc |valeur étudiante - exactValue| <= tolerance n'est PAS "un
// moteur de calcul" — seulement la même comparaison de forme qu'un QCM.
// CALCULATION reste volontairement HORS de cette fonction : aucune
// valeur numérique unique ne peut fiablement représenter une démarche
// de calcul (formule/étapes/raisonnement) — voir GradingAI.ts, qui la
// force systématiquement vers needsHumanReview=true.
//
// Ce module ne persiste rien et n'appelle jamais AIUsageLedger : il n'y
// a aucun coût IA à tracer pour une comparaison déterministe. La
// persistance passe par le MÊME EvaluationService.recordAiProposedEvaluation
// que la voie IA (mission : "réutiliser Evaluation, jamais un second
// système") — voir AIGradingService.ts.
// ============================================================

import type { QuestionContent, QuestionType, StudentAnswerContent } from "@/lib/core/assessment/AssessmentTypes";
import type { AIGradingResult } from "@/lib/core/assessment/AIGradingContract";

/** Identifiant tracé dans Evaluation.aiModel pour distinguer une proposition déterministe d'un vrai appel OpenAI (jamais un nom de modèle IA). */
export const DETERMINISTIC_GRADING_MODEL_TAG = "deterministic-rules:v1";

export const DETERMINISTICALLY_GRADABLE_TYPES: readonly QuestionType[] = ["MULTIPLE_CHOICE", "TRUE_FALSE", "NUMERIC"];

export function isDeterministicallyGradable(type: QuestionType): boolean {
  return DETERMINISTICALLY_GRADABLE_TYPES.includes(type);
}

/**
 * Retourne `null` si le type de question n'est pas éligible à une
 * correction déterministe (l'appelant doit alors passer par GradingAI) —
 * ne lève jamais d'erreur pour un type non éligible, ce n'est pas un cas
 * anormal.
 */
export function gradeDeterministically(
  type: QuestionType,
  questionContent: QuestionContent | null,
  studentAnswer: StudentAnswerContent | null,
  maxScore: number
): AIGradingResult | null {
  if (!isDeterministicallyGradable(type)) return null;

  if (!questionContent || !studentAnswer) {
    return {
      score: 0,
      maxScore,
      confidence: 0,
      needsHumanReview: true,
      criterionScores: [],
      findings: [],
      feedback: [],
      evidence: [],
      errors: ["Contenu de question ou réponse étudiante structurée manquant pour une correction déterministe."],
      warnings: [],
      limitations: ["Correction déterministe impossible sans contenu structuré complet — nécessite une vérification humaine."],
    };
  }

  if (type === "MULTIPLE_CHOICE") {
    if (questionContent.kind !== "MULTIPLE_CHOICE" || studentAnswer.kind !== "MULTIPLE_CHOICE") {
      return mismatchedContentResult(maxScore, type);
    }
    const isCorrect = studentAnswer.selectedOptionId === questionContent.correctOptionId;
    const selected = questionContent.options.find((o) => o.id === studentAnswer.selectedOptionId);
    return {
      score: isCorrect ? maxScore : 0,
      maxScore,
      confidence: 1,
      needsHumanReview: false,
      criterionScores: [],
      findings: [
        selected
          ? `Option sélectionnée : "${selected.text}".`
          : "Option sélectionnée introuvable dans la liste des options.",
      ],
      feedback: isCorrect
        ? ["Réponse correcte."]
        : [questionContent.explanation ? `Réponse incorrecte. ${questionContent.explanation}` : "Réponse incorrecte."],
      evidence: [],
      errors: [],
      warnings: [],
      limitations: [],
    };
  }

  if (type === "TRUE_FALSE") {
    if (questionContent.kind !== "TRUE_FALSE" || studentAnswer.kind !== "TRUE_FALSE") {
      return mismatchedContentResult(maxScore, type);
    }
    const isCorrect = studentAnswer.value === questionContent.correctAnswer;
    return {
      score: isCorrect ? maxScore : 0,
      maxScore,
      confidence: 1,
      needsHumanReview: false,
      criterionScores: [],
      findings: [`Réponse étudiante : ${studentAnswer.value ? "Vrai" : "Faux"}.`],
      feedback: isCorrect
        ? ["Réponse correcte."]
        : [questionContent.explanation ? `Réponse incorrecte. ${questionContent.explanation}` : "Réponse incorrecte."],
      evidence: [],
      errors: [],
      warnings: [],
      limitations: [],
    };
  }

  // NUMERIC
  if (questionContent.kind !== "NUMERIC" || studentAnswer.kind !== "NUMERIC") {
    return mismatchedContentResult(maxScore, type);
  }
  const tolerance = questionContent.tolerance ?? 0;
  const diff = Math.abs(studentAnswer.value - questionContent.exactValue);
  const isCorrect = diff <= tolerance;
  const unit = questionContent.unit ? ` ${questionContent.unit}` : "";
  return {
    score: isCorrect ? maxScore : 0,
    maxScore,
    confidence: 1,
    needsHumanReview: false,
    criterionScores: [],
    findings: [`Valeur étudiante : ${studentAnswer.value}${unit}. Écart avec la valeur attendue : ${diff}${unit}.`],
    feedback: isCorrect
      ? ["Réponse correcte."]
      : [`Réponse incorrecte. Valeur attendue : ${questionContent.exactValue}${unit} (tolérance ${tolerance}${unit}).`],
    evidence: [],
    errors: [],
    warnings: [],
    limitations: [],
  };
}

/**
 * Cas anormal : le type déclaré de la question ne correspond pas au
 * `kind` du contenu structuré chargé (incohérence de données, pas une
 * réponse étudiante invalide — celle-ci est déjà validée en amont par
 * `validateAnswerForQuestion` avant tout enregistrement). Renvoyé
 * plutôt que de lever une exception : une correction ne doit jamais
 * faire planter la route appelante, seulement signaler qu'elle
 * nécessite une vérification humaine.
 */
function mismatchedContentResult(maxScore: number, type: QuestionType): AIGradingResult {
  return {
    score: 0,
    maxScore,
    confidence: 0,
    needsHumanReview: true,
    criterionScores: [],
    findings: [],
    feedback: [],
    evidence: [],
    errors: [`Incohérence entre le type de question déclaré (${type}) et le contenu structuré chargé.`],
    warnings: [],
    limitations: ["Correction déterministe impossible — nécessite une vérification humaine."],
  };
}
