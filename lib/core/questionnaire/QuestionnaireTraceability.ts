// ============================================================
// ACADIA — TRAÇABILITÉ D'UNE QUESTION (P15, Partie 8)
//
// Reconstruit, pour une question donnée, la chaîne réelle
// indicateur → dimension → variable → hypothèse. N'invente
// aucune relation : une question sans variableId/dimensionId/
// indicatorId établi par QuestionnaireGenerationEngine (protégé)
// reste "non traçable", jamais complétée par une supposition.
// ============================================================

import type { ResearchProject, MeasurementType } from "@/lib/core/research/ResearchTypes";
import type { QuestionnaireQuestion } from "./QuestionnaireTypes";

const MEASUREMENT_TYPE_LABELS: Record<MeasurementType, string> = {
  frequence: "Fréquence",
  montant: "Montant",
  pourcentage: "Pourcentage",
  score: "Score",
  echelle_likert: "Échelle de Likert",
  ratio: "Ratio",
  binaire: "Binaire",
  categorielle: "Catégorielle",
  continue: "Continue",
};

export interface QuestionExplanation {
  measure?: string;
  indicator?: string;
  dimension?: string;
  variable?: string;
  hypothesis?: string;
}

export function explainQuestion(
  project: ResearchProject,
  question: QuestionnaireQuestion
): QuestionExplanation {
  if (!question.variableId) return {};

  const variable = project.variables.find((v) => v.id === question.variableId);
  if (!variable) return {};

  const dimension = question.dimensionId
    ? variable.dimensions.find((d) => d.id === question.dimensionId)
    : undefined;

  const indicatorPool = dimension?.indicators ?? variable.indicators ?? [];
  const indicator = question.indicatorId
    ? indicatorPool.find((i) => i.id === question.indicatorId)
    : undefined;

  // L'hypothèse secondaire est construite par HypothesisProposalEngine
  // avec l'id déterministe `hypothesis-secondary-${dimension.id}` —
  // ce n'est pas une supposition, c'est la même clé que celle utilisée
  // pour la créer.
  const linkedHypothesis =
    (dimension &&
      project.hypotheses.find(
        (h) => h.id === `hypothesis-secondary-${dimension.id}` && h.status !== "rejected"
      )) ??
    project.hypotheses.find((h) => h.role === "general" && h.status !== "rejected");

  return {
    measure: indicator?.measurementType ? MEASUREMENT_TYPE_LABELS[indicator.measurementType] : undefined,
    indicator: indicator?.name,
    dimension: dimension?.name,
    variable: variable.name,
    hypothesis: linkedHypothesis?.statement,
  };
}
