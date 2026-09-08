// ============================================================
// ACADIA — MOTEUR DE CONCLUSION SCIENTIFIQUE (Mission 7, bloc 1)
//
// Orchestration pure : compose HypothesisConclusionEngine,
// ObjectiveCoverageEngine, ObjectiveConclusionEngine,
// ResearchQuestionConclusionEngine et GeneralScientificConclusionEngine
// dans cet ordre précis (chacun consomme la sortie du précédent).
// Ne recalcule et ne redécide RIEN — assemble uniquement.
// ============================================================

import { randomUUID } from "node:crypto";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { StatisticalAnalysisRun } from "@/lib/core/statistics/StatisticalTypes";
import type { HypothesisAssessment } from "./ScientificInterpretationTypes";
import type { ScientificConclusion } from "./ScientificConclusionTypes";
import { buildHypothesisConclusions } from "./HypothesisConclusionEngine";
import { computeObjectiveCoverage } from "./ObjectiveCoverageEngine";
import { buildObjectiveConclusions } from "./ObjectiveConclusionEngine";
import { buildResearchQuestionConclusion } from "./ResearchQuestionConclusionEngine";
import { buildGeneralConclusion } from "./GeneralScientificConclusionEngine";

export function buildScientificConclusion(
  project: ResearchProject,
  run: StatisticalAnalysisRun,
  hypothesisAssessments: HypothesisAssessment[],
  datasetUpdatedAt: string,
  analysisPlanUpdatedAt: string,
  interpretationId?: string
): ScientificConclusion {
  const hypothesisConclusions = buildHypothesisConclusions(project.hypotheses, hypothesisAssessments, run);
  const coverages = computeObjectiveCoverage(project, run, hypothesisAssessments);
  const objectiveConclusions = buildObjectiveConclusions(project, coverages, hypothesisConclusions);
  const researchQuestionConclusion = buildResearchQuestionConclusion(project, objectiveConclusions);
  const { generalConclusion, limitations, warnings } = buildGeneralConclusion(
    researchQuestionConclusion,
    objectiveConclusions,
    hypothesisConclusions
  );

  return {
    id: randomUUID(),
    projectId: project.id,
    statisticalRunId: run.id,
    interpretationId,
    hypothesisConclusions,
    objectiveConclusions,
    researchQuestionConclusion,
    generalConclusion,
    limitations,
    warnings,
    datasetUpdatedAt,
    analysisPlanUpdatedAt,
    createdAt: new Date().toISOString(),
  };
}
