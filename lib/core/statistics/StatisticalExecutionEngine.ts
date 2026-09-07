// ============================================================
// ACADIA — STATISTICAL EXECUTION ENGINE (Mission 5, incrément 1)
//
// N'implémente AUCUN calcul statistique — orchestre uniquement les
// moteurs déjà écrits et déjà utilisés par l'UI d'analyse existante :
// - DescriptiveAnalysisEngine.buildDescriptiveAnalysis (fréquences,
//   %, % valide, statistiques numériques)
// - BivariateAnalysisEngine.buildBivariateAnalysis (tableau croisé,
//   Khi² avec p-value et effectifs attendus, Pearson, Spearman)
// Aucun de ces deux fichiers n'est modifié.
//
// N'exécute que les AnalysisItem d'un AnalysisPlan (Module 4) dont
// le chercheur a explicitement validé le statut ("accepted" ou
// "modified") et dont la priorité n'est pas "not_recommended" —
// jamais une analyse rejetée ou encore simplement "proposed".
//
// Zéro appel OpenAI — 100% déterministe, testable sans clé API.
// ============================================================

import { randomUUID } from "node:crypto";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";
import type { AnalysisItem, AnalysisPlan } from "@/lib/core/analysis/AnalysisPlanTypes";
import { buildDescriptiveAnalysis } from "@/lib/core/analysis/DescriptiveAnalysisEngine";
import { buildBivariateAnalysis } from "@/lib/core/analysis/BivariateAnalysisEngine";
import type { StatisticalAnalysisRun, StatisticalResult } from "./StatisticalTypes";

export const EXECUTION_VERSION = "STAT_ENGINE_V1";
export const DEFAULT_ALPHA = 0.05;

const EXECUTABLE_ITEM_STATUSES = new Set(["accepted", "modified"]);

function isExecutable(item: AnalysisItem): boolean {
  return EXECUTABLE_ITEM_STATUSES.has(item.status) && item.priority !== "not_recommended";
}

function executeItem(project: ResearchProject, dataset: Dataset, item: AnalysisItem, alpha: number, descriptiveAll: ReturnType<typeof buildDescriptiveAnalysis>): StatisticalResult {
  const base = {
    id: randomUUID(),
    analysisItemId: item.id,
    analysisType: item.analysisType,
    variableIds: item.variableIds,
    columnIds: item.columnIds,
    createdAt: new Date().toISOString(),
  };

  try {
    if (item.analysisType === "DESCRIPTIVE") {
      const columnId = item.columnIds[0];
      const result = descriptiveAll.variableResults.find((r) => r.columnId === columnId);
      if (!result) {
        return { ...base, status: "failed", n: 0, warnings: [], reason: "Colonne introuvable dans le dataset actuel." };
      }
      if (!result.analyzable) {
        return { ...base, status: "skipped", n: result.sampleSize, warnings: result.warnings, reason: "Données incompatibles avec le type déclaré pour cette colonne — voir les avertissements." };
      }
      return { ...base, status: "completed", n: result.sampleSize, descriptive: result, warnings: result.warnings };
    }

    // Familles bivariées : CHI_SQUARE, CORRELATION, GROUP_COMPARISON, CROSS_TABULATION.
    const [columnXId, columnYId] = item.columnIds;
    if (!columnXId || !columnYId) {
      return { ...base, status: "failed", n: 0, warnings: [], reason: "Deux colonnes sont requises pour ce type d'analyse." };
    }

    const bivariate = buildBivariateAnalysis(project, dataset, columnXId, columnYId, alpha);

    if (bivariate.status === "ready") {
      return { ...base, status: "completed", n: bivariate.validPairCount, bivariate, warnings: bivariate.warnings };
    }

    return {
      ...base,
      status: "skipped",
      n: bivariate.validPairCount,
      bivariate,
      warnings: bivariate.warnings,
      reason: `Analyse non calculable pour l'instant (${bivariate.status}) — voir les avertissements du résultat.`,
    };
  } catch (error) {
    return { ...base, status: "failed", n: 0, warnings: [], reason: error instanceof Error ? error.message : "Erreur inattendue pendant le calcul." };
  }
}

/**
 * Exécute tous les AnalysisItem validés d'un plan. Ne modifie ni le
 * plan ni le dataset — retourne un run autonome, recalculable à
 * l'identique tant que le dataset et le plan ne changent pas
 * (mission §21 — reproductibilité).
 */
export function executeAnalysisPlan(
  project: ResearchProject,
  dataset: Dataset,
  plan: AnalysisPlan,
  alpha: number = DEFAULT_ALPHA
): StatisticalAnalysisRun {
  const startedAt = new Date().toISOString();
  const executableItems = plan.items.filter(isExecutable);

  // Une seule passe de DescriptiveAnalysisEngine pour tout le dataset,
  // réutilisée par chaque item DESCRIPTIVE — évite de la recalculer
  // item par item (mission §33 : éviter le travail redondant).
  const descriptiveAll = buildDescriptiveAnalysis(project, dataset);

  const results = executableItems.map((item) => executeItem(project, dataset, item, alpha, descriptiveAll));

  const failedCount = results.filter((r) => r.status === "failed").length;
  const completedCount = results.filter((r) => r.status === "completed").length;

  const status: StatisticalAnalysisRun["status"] =
    executableItems.length === 0 || (failedCount > 0 && completedCount === 0)
      ? "failed"
      : failedCount > 0
        ? "partial"
        : "completed";

  return {
    id: randomUUID(),
    projectId: project.id,
    datasetId: dataset.id,
    analysisPlanId: plan.id,
    executionVersion: EXECUTION_VERSION,
    alpha,
    status,
    results,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}
