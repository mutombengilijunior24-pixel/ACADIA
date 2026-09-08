// ============================================================
// ACADIA — MOTEUR DE COUVERTURE D'OBJECTIF (Mission 7, bloc 1)
//
// 100% déterministe. Ne produit jamais un pourcentage artificiel
// (voir mission §22) — le statut FULL/PARTIAL/NONE est fondé
// uniquement sur des éléments réellement présents : indicateurs
// reliés, hypothèses reliées, hypothèses effectivement évaluées
// (HypothesisAssessment avec `basis` non vide — voir Mission 6), et
// résultats descriptifs complétés pour les variables reliées à
// l'objectif lorsqu'aucune hypothèse ne lui est directement associée
// (objectif purement descriptif).
//
// Ne considère que project.objectives dont role/type === "specific"
// — un objectif général n'est pas évalué individuellement (voir
// ResearchQuestionConclusionEngine.ts, qui opère au niveau agrégé).
// ============================================================

import type { ResearchProject, ResearchIndicator } from "@/lib/core/research/ResearchTypes";
import type { HypothesisAssessment } from "./ScientificInterpretationTypes";
import type { StatisticalAnalysisRun } from "@/lib/core/statistics/StatisticalTypes";
import type { ObjectiveCoverage, ObjectiveCoverageStatus } from "./ScientificConclusionTypes";

function isSpecific(role: string | undefined, type: string | undefined): boolean {
  return role === "specific" || type === "specific";
}

/** Aplati les indicateurs, qu'ils soient rattachés directement à une variable ou à une dimension de celle-ci — jamais une seconde source de vérité parallèle (project.matrix n'est pas garanti peuplé). */
function collectIndicatorVariableMap(project: ResearchProject): Map<string, string> {
  const map = new Map<string, string>();
  const register = (indicator: ResearchIndicator, fallbackVariableId: string) => {
    map.set(indicator.id, indicator.variableId ?? fallbackVariableId);
  };
  for (const variable of project.variables) {
    for (const indicator of variable.indicators) register(indicator, variable.id);
    for (const dimension of variable.dimensions) {
      for (const indicator of dimension.indicators) register(indicator, variable.id);
    }
  }
  return map;
}

export function computeObjectiveCoverage(
  project: ResearchProject,
  run: StatisticalAnalysisRun,
  hypothesisAssessments: HypothesisAssessment[]
): ObjectiveCoverage[] {
  const indicatorVariableMap = collectIndicatorVariableMap(project);

  return project.objectives
    .filter((o) => isSpecific(o.role, o.type))
    .map((objective) => {
      const indicatorIds = objective.indicators ?? [];
      const linkedVariableIds = new Set(
        indicatorIds.map((id) => indicatorVariableMap.get(id)).filter((v): v is string => Boolean(v))
      );
      for (const variable of project.variables) {
        if (variable.linkedObjectiveIds.includes(objective.id)) linkedVariableIds.add(variable.id);
      }

      const linkedHypotheses = project.hypotheses.filter((h) => h.objectiveId === objective.id);
      const evaluatedHypotheses = linkedHypotheses.filter((h) => {
        const assessment = hypothesisAssessments.find((a) => a.hypothesisId === h.id);
        return Boolean(assessment && assessment.basis.length > 0);
      });

      const hasCompletedDescriptiveResult = run.results.some(
        (r) => r.status === "completed" && r.analysisType === "DESCRIPTIVE" && r.variableIds.some((vid) => linkedVariableIds.has(vid))
      );

      let status: ObjectiveCoverageStatus;
      let reason: string;

      if (linkedHypotheses.length === 0 && linkedVariableIds.size === 0) {
        status = "NONE";
        reason = "Cet objectif n'est relié à aucune variable, indicateur ou hypothèse.";
      } else if (linkedHypotheses.length > 0) {
        if (evaluatedHypotheses.length === 0) {
          status = "NONE";
          reason = "Aucune des hypothèses reliées à cet objectif n'a pu être évaluée avec les résultats statistiques actuellement disponibles.";
        } else if (evaluatedHypotheses.length < linkedHypotheses.length) {
          status = "PARTIAL";
          reason = `${evaluatedHypotheses.length} hypothèse(s) évaluée(s) sur ${linkedHypotheses.length} reliée(s) à cet objectif.`;
        } else {
          status = "FULL";
          reason = `Les ${linkedHypotheses.length} hypothèse(s) reliée(s) à cet objectif ont toutes été évaluées.`;
        }
      } else if (hasCompletedDescriptiveResult) {
        status = "FULL";
        reason = "Aucune hypothèse n'est directement reliée à cet objectif, mais les variables associées disposent de statistiques descriptives calculées.";
      } else {
        status = "NONE";
        reason = "Les variables reliées à cet objectif n'ont pas encore de résultat statistique calculé.";
      }

      return {
        objectiveId: objective.id,
        status,
        linkedIndicatorCount: indicatorIds.length,
        linkedHypothesisIds: linkedHypotheses.map((h) => h.id),
        evaluatedHypothesisIds: evaluatedHypotheses.map((h) => h.id),
        reason,
      };
    });
}
