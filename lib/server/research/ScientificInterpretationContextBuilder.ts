// ============================================================
// ACADIA — CONSTRUCTION DU CONTEXTE IA POUR L'INTERPRÉTATION (Mission 6)
//
// Factorise la construction de ScientificInterpretationContext,
// partagée entre /formulate (incrément 2, appel OpenAI) et PATCH
// /[interpretationId] (incrément 4, ré-exécution des garde-fous après
// une édition humaine) — jamais dupliquée entre les deux routes.
// Ne calcule ni ne recalcule aucune statistique : ne fait qu'assembler
// et arrondir pour l'affichage des valeurs déjà produites par
// StatisticalExecutionEngine (Mission 5).
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { StatisticalAnalysisRun } from "@/lib/core/statistics/StatisticalTypes";
import type { HypothesisAssessment } from "@/lib/core/analysis/ScientificInterpretationTypes";
import type {
  ScientificInterpretationContext,
  ScientificInterpretationResultContext,
} from "@/lib/ai/openai/ScientificInterpretationAI";

/**
 * Arrondit à 6 chiffres significatifs — une p-value comme
 * 2.5396285894708624e-10 (mantisse brute d'un flottant JS) reste
 * exacte non arrondie mais produit une prose illisible si l'IA (ou un
 * chercheur relisant le contexte) la recopie telle quelle. 6 chiffres
 * significatifs préservent l'ordre de grandeur sans jamais arrondir à
 * un faux zéro.
 */
function roundSignificant(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return value;
  return Number(value.toPrecision(6));
}

export function buildScientificInterpretationContext(
  project: ResearchProject,
  run: StatisticalAnalysisRun,
  hypothesisAssessments: HypothesisAssessment[]
): ScientificInterpretationContext {
  const variableById = new Map(project.variables.map((v) => [v.id, v]));

  const results: ScientificInterpretationResultContext[] = run.results
    .filter((r) => r.status === "completed")
    .map((r) => ({
      id: r.id,
      analysisType: r.analysisType,
      label: r.variableIds.map((vid) => variableById.get(vid)?.name ?? vid).join(" × "),
      n: r.n,
      warnings: r.warnings,
      descriptive: r.descriptive
        ? {
            frequencyTable: r.descriptive.frequencyTable?.map((f) => ({
              label: f.label,
              count: f.count,
              percentage: f.percentage,
              validPercentage: f.validPercentage,
            })),
            numericalStatistics: r.descriptive.numericalStatistics
              ? {
                  min: roundSignificant(r.descriptive.numericalStatistics.min),
                  max: roundSignificant(r.descriptive.numericalStatistics.max),
                  mean: roundSignificant(r.descriptive.numericalStatistics.mean),
                  median: roundSignificant(r.descriptive.numericalStatistics.median),
                  standardDeviation: roundSignificant(r.descriptive.numericalStatistics.standardDeviation),
                }
              : undefined,
          }
        : undefined,
      bivariate: r.bivariate
        ? {
            method: r.bivariate.method,
            chiSquare: r.bivariate.chiSquare
              ? {
                  pValue: roundSignificant(r.bivariate.chiSquare.pValue),
                  cramersV: roundSignificant(r.bivariate.chiSquare.cramersV),
                  assumptionsMet: r.bivariate.chiSquare.assumptionsMet,
                }
              : undefined,
            pearson: r.bivariate.pearson
              ? { coefficient: roundSignificant(r.bivariate.pearson.coefficient), pValue: roundSignificant(r.bivariate.pearson.pValue) }
              : undefined,
            spearman: r.bivariate.spearman
              ? { coefficient: roundSignificant(r.bivariate.spearman.coefficient), pValue: roundSignificant(r.bivariate.spearman.pValue) }
              : undefined,
          }
        : undefined,
    }));

  return {
    project: {
      title: project.title,
      researchType: project.researchType,
      domain: project.domain,
    },
    sampleSize: run.results.reduce((max, r) => Math.max(max, r.n), 0),
    alpha: run.alpha,
    hypotheses: hypothesisAssessments.map((a) => ({
      hypothesisId: a.hypothesisId,
      statement: a.statement,
      decision: a.decision,
      confidence: a.confidence,
      rationale: a.rationale,
    })),
    results,
  };
}

/**
 * Une interprétation est obsolète si le dataset ou le plan d'analyse
 * ont été modifiés depuis sa génération (incrément 4) — jamais
 * persisté : toujours recalculé à la lecture pour ne jamais risquer
 * un indicateur d'obsolescence lui-même obsolète.
 */
export function isInterpretationOutdated(
  currentDatasetUpdatedAt: string | undefined,
  currentAnalysisPlanUpdatedAt: string | undefined,
  interpretation: { datasetUpdatedAt: string; analysisPlanUpdatedAt: string }
): boolean {
  return (
    (currentDatasetUpdatedAt ?? "") !== interpretation.datasetUpdatedAt ||
    (currentAnalysisPlanUpdatedAt ?? "") !== interpretation.analysisPlanUpdatedAt
  );
}
