// ============================================================
// ACADIA — MOTEUR DE CONCLUSION SCIENTIFIQUE GÉNÉRALE (Mission 7, bloc 1)
//
// 100% déterministe — synthétise researchQuestionConclusion +
// objectiveConclusions + hypothesisConclusions. N'introduit AUCUNE
// information nouvelle (voir mission §24) : uniquement un décompte
// factuel de ce qui a déjà été établi par les moteurs précédents.
// ============================================================

import type { HypothesisConclusion, ObjectiveConclusion, ResearchQuestionConclusion } from "./ScientificConclusionTypes";

export interface GeneralConclusionResult {
  generalConclusion: string;
  limitations: string[];
  warnings: string[];
}

export function buildGeneralConclusion(
  researchQuestionConclusion: ResearchQuestionConclusion | undefined,
  objectiveConclusions: ObjectiveConclusion[],
  hypothesisConclusions: HypothesisConclusion[]
): GeneralConclusionResult {
  const parts: string[] = [];

  if (researchQuestionConclusion) {
    parts.push(researchQuestionConclusion.conclusion);
  }

  if (hypothesisConclusions.length > 0) {
    const supported = hypothesisConclusions.filter((h) => h.decision === "SUPPORTED").length;
    const notSupported = hypothesisConclusions.filter((h) => h.decision === "NOT_SUPPORTED").length;
    const partiallySupported = hypothesisConclusions.filter((h) => h.decision === "PARTIALLY_SUPPORTED").length;
    const inconclusive = hypothesisConclusions.filter((h) => h.decision === "INCONCLUSIVE").length;

    parts.push(
      `Sur ${hypothesisConclusions.length} hypothèse(s) évaluée(s) : ${supported} reçoivent un soutien empirique, ${notSupported} n'en reçoivent pas, ${partiallySupported} de façon partielle, et ${inconclusive} restent non tranchée(s) faute de preuve statistique suffisante.`
    );
  } else {
    parts.push("Aucune hypothèse n'a encore pu être évaluée avec les résultats statistiques actuellement disponibles.");
  }

  const generalConclusion = parts.join(" ");

  const limitations = [...new Set(hypothesisConclusions.flatMap((h) => h.limitations))];

  const warnings: string[] = [];
  const uncoveredObjectives = objectiveConclusions.filter((o) => o.coverage.status === "NONE");
  if (uncoveredObjectives.length > 0) {
    warnings.push(
      `${uncoveredObjectives.length} objectif(s) spécifique(s) ne sont pas couverts par les données et analyses actuellement disponibles.`
    );
  }

  return { generalConclusion, limitations, warnings };
}
