// ============================================================
// ACADIA — MOTEUR D'AUDIT DE COUVERTURE DE RECHERCHE (Mission 7, bloc 2)
//
// 100% déterministe. Détecte les éléments non reliés au reste du
// pipeline scientifique (objectif/hypothèse/variable/indicateur/
// résultat) — jamais un jugement de qualité, uniquement des faits de
// traçabilité. Un résultat "orphelin" (UNLINKED_RESULT) n'est jamais
// utilisé automatiquement dans la conclusion générale (voir mission
// §36) — ScientificConclusionEngine.ts ne consomme déjà que les
// résultats reliés à une hypothèse ou descriptifs d'une variable liée
// à un objectif ; findOrphans() ne fait qu'exposer ce même filtre
// explicitement, à des fins d'audit.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { AnalysisPlan } from "./AnalysisPlanTypes";
import type { StatisticalAnalysisRun } from "@/lib/core/statistics/StatisticalTypes";

export type OrphanType = "ORPHAN_OBJECTIVE" | "ORPHAN_HYPOTHESIS" | "ORPHAN_VARIABLE" | "ORPHAN_INDICATOR" | "UNLINKED_RESULT";

export interface OrphanFinding {
  type: OrphanType;
  id: string;
  label: string;
  reason: string;
}

function isSpecific(role: string | undefined, type: string | undefined): boolean {
  return role === "specific" || type === "specific";
}

export function findOrphans(project: ResearchProject, plan?: AnalysisPlan, run?: StatisticalAnalysisRun): OrphanFinding[] {
  const findings: OrphanFinding[] = [];

  for (const objective of project.objectives.filter((o) => isSpecific(o.role, o.type))) {
    const hasHypothesis = project.hypotheses.some((h) => h.objectiveId === objective.id);
    const hasIndicators = (objective.indicators?.length ?? 0) > 0;
    if (!hasHypothesis && !hasIndicators) {
      findings.push({
        type: "ORPHAN_OBJECTIVE",
        id: objective.id,
        label: objective.text,
        reason: "Aucune hypothèse ni indicateur relié à cet objectif.",
      });
    }
  }

  for (const hypothesis of project.hypotheses) {
    if (!hypothesis.objectiveId) {
      findings.push({
        type: "ORPHAN_HYPOTHESIS",
        id: hypothesis.id,
        label: hypothesis.statement,
        reason: "Non reliée à un objectif spécifique.",
      });
    }
  }

  for (const variable of project.variables) {
    const referencedByHypothesis = project.hypotheses.some((h) => h.variableIds?.includes(variable.id));
    if (variable.linkedObjectiveIds.length === 0 && !referencedByHypothesis) {
      findings.push({
        type: "ORPHAN_VARIABLE",
        id: variable.id,
        label: variable.name,
        reason: "Non reliée à un objectif ni à une hypothèse.",
      });
    }
  }

  const referencedIndicatorIds = new Set(project.objectives.flatMap((o) => o.indicators ?? []));
  for (const variable of project.variables) {
    const allIndicators = [...variable.indicators, ...variable.dimensions.flatMap((d) => d.indicators)];
    for (const indicator of allIndicators) {
      if (!referencedIndicatorIds.has(indicator.id)) {
        findings.push({
          type: "ORPHAN_INDICATOR",
          id: indicator.id,
          label: indicator.name,
          reason: "Non référencé par aucun objectif.",
        });
      }
    }
  }

  if (plan && run) {
    const itemById = new Map(plan.items.map((i) => [i.id, i]));
    const objectiveLinkedVariableIds = new Set(project.variables.filter((v) => v.linkedObjectiveIds.length > 0).map((v) => v.id));

    for (const result of run.results) {
      if (result.status !== "completed") continue;
      const item = itemById.get(result.analysisItemId);
      const isHypothesisLinked = Boolean(item?.hypothesisId);
      const isObjectiveLinkedDescriptive =
        result.analysisType === "DESCRIPTIVE" && result.variableIds.some((vid) => objectiveLinkedVariableIds.has(vid));

      if (!isHypothesisLinked && !isObjectiveLinkedDescriptive) {
        findings.push({
          type: "UNLINKED_RESULT",
          id: result.id,
          label: `${result.analysisType} (${result.variableIds.join(", ")})`,
          reason: "Résultat exploratoire non directement rattaché à une hypothèse ou à un objectif — non utilisé dans la conclusion générale.",
        });
      }
    }
  }

  return findings;
}
