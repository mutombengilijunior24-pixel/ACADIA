// ============================================================
// ACADIA — MOTEUR DE CONCLUSION D'HYPOTHÈSE (Mission 7, bloc 1)
//
// 100% déterministe, zéro appel OpenAI. Enveloppe chaque
// HypothesisAssessment déjà tranché par HypothesisAssessmentEngine.ts
// (Mission 6) dans une prose académique prudente — ne redécide
// JAMAIS `decision`, se contente de la reformuler fidèlement selon un
// gabarit fixe. Ajoute une limitation méthodologique automatique
// (corrélation/association ≠ causalité) dès que la preuve provient
// d'un test du χ² ou d'une corrélation — jamais une causalité non
// justifiée par le design (voir mission §14/§15).
// ============================================================

import type { ResearchHypothesis } from "@/lib/core/research/ResearchTypes";
import type { HypothesisAssessment, HypothesisAssessmentDecision } from "./ScientificInterpretationTypes";
import type { StatisticalAnalysisRun } from "@/lib/core/statistics/StatisticalTypes";
import type { HypothesisConclusion } from "./ScientificConclusionTypes";

const NON_CAUSAL_ANALYSIS_TYPES = new Set(["CHI_SQUARE", "CORRELATION", "CROSS_TABULATION"]);

const CONCLUSION_TEMPLATES: Record<HypothesisAssessmentDecision, (statement: string) => string> = {
  SUPPORTED: (statement) =>
    `Les résultats fournissent un soutien empirique à l'hypothèse « ${statement} » dans l'échantillon étudié, au seuil de significativité retenu.`,
  NOT_SUPPORTED: (statement) =>
    `Les résultats ne fournissent pas suffisamment d'évidence statistique pour soutenir l'hypothèse « ${statement} ».`,
  PARTIALLY_SUPPORTED: (statement) =>
    `Les résultats fournissent un soutien empirique partiel à l'hypothèse « ${statement} » : certains résultats associés la soutiennent, d'autres non.`,
  INCONCLUSIVE: (statement) =>
    `Les résultats disponibles ne permettent pas de statuer scientifiquement sur l'hypothèse « ${statement} ».`,
};

export function buildHypothesisConclusions(
  hypotheses: ResearchHypothesis[],
  hypothesisAssessments: HypothesisAssessment[],
  run: StatisticalAnalysisRun
): HypothesisConclusion[] {
  return hypothesisAssessments.map((assessment) => {
    const hypothesis = hypotheses.find((h) => h.id === assessment.hypothesisId);
    const statement = hypothesis?.statement ?? assessment.statement;

    const sourceResults = run.results.filter((r) => assessment.basis.includes(r.id));
    const hasNonCausalMethod = sourceResults.some((r) => NON_CAUSAL_ANALYSIS_TYPES.has(r.analysisType));

    const limitations = [...assessment.rationale];
    if (hasNonCausalMethod) {
      limitations.push(
        "Ce résultat traduit une association statistique entre les variables et ne permet pas, à lui seul, d'établir une relation causale."
      );
    }

    return {
      hypothesisId: assessment.hypothesisId,
      decision: assessment.decision,
      conclusion: CONCLUSION_TEMPLATES[assessment.decision](statement),
      confidence: assessment.confidence,
      limitations,
      sourceResultIds: assessment.basis,
      sourceAnalysisRunId: run.id,
    };
  });
}
