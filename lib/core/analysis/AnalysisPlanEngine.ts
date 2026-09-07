// ============================================================
// ACADIA — ANALYSIS PLAN ENGINE (Module 4, incrément 1)
//
// Orchestration pure : décide QUOI analyser à partir des
// hypothèses/variables déjà établies (Module 1) et du mapping
// scientifique déjà confirmé par le chercheur (Module 3). Ne
// calcule AUCUN résultat statistique lui-même — réutilise
// exactement determineBivariateMethod() et les fonctions de
// BivariateStatistics.ts déjà écrites et testées, uniquement pour
// vérifier des CONDITIONS PRÉALABLES (ex. effectifs attendus du
// Khi²), jamais pour produire un résultat d'analyse.
//
// 100% déterministe — aucun appel IA (mission Module 4 : les
// règles statistiques priment toujours sur l'IA).
//
// Ne propose jamais une analyse sur une colonne dont le mapping
// n'a pas été explicitement confirmé par le chercheur (Module 3) —
// une simple suggestion IA non validée n'est pas une base
// suffisante pour un plan d'analyse.
// ============================================================

import { randomUUID } from "node:crypto";
import type { ResearchProject, ResearchHypothesis, ResearchVariable } from "@/lib/core/research/ResearchTypes";
import type { Dataset, DatasetColumn, MeasurementLevel } from "@/lib/core/dataset/DatasetTypes";
import { determineBivariateMethod } from "./BivariateAnalysisEngine";
import { buildContingencyTable, calculateChiSquare } from "./BivariateStatistics";
import type {
  AnalysisItem,
  AnalysisItemType,
  AnalysisPlan,
  AnalysisPrerequisite,
  PlannedStatistic,
} from "./AnalysisPlanTypes";

const CONFIRMED_STATUSES = new Set(["confirmed", "user_modified"]);

function isConfirmedMapping(column: DatasetColumn): boolean {
  return Boolean(column.mappingStatus && CONFIRMED_STATUSES.has(column.mappingStatus));
}

function findMappedColumn(dataset: Dataset, variableId: string): DatasetColumn | null {
  return dataset.columns.find((c) => c.variableId === variableId && isConfirmedMapping(c)) ?? null;
}

function plannedStatisticsForLevel(level: MeasurementLevel): PlannedStatistic[] {
  switch (level) {
    case "nominal":
      return ["frequency", "percentage", "valid_percentage"];
    case "ordinal":
      return ["frequency", "percentage", "valid_percentage", "cumulative_percentage", "median", "mode"];
    case "interval":
    case "ratio":
      return ["min", "max", "mean", "median", "variance", "standard_deviation"];
    default:
      return ["frequency", "percentage", "valid_percentage"];
  }
}

function buildDescriptiveItem(variable: ResearchVariable, column: DatasetColumn): AnalysisItem {
  return {
    id: randomUUID(),
    analysisType: "DESCRIPTIVE",
    availability: "available",
    variableIds: [variable.id],
    columnIds: [column.id],
    plannedStatistics: plannedStatisticsForLevel(column.measurementLevel),
    rationale: `Statistiques descriptives pour "${variable.name}", à partir de la colonne "${column.label}" (niveau de mesure : ${column.measurementLevel}).`,
    prerequisites: [{ label: "Colonne rattachée et confirmée", status: "pass" }],
    priority: "essential",
    status: "proposed",
  };
}

/** Paires alignées (même observation), valeurs normalisées pour correspondre aux libellés d'options (voir Module 2 : row values gardent la casse originale, options non). */
function alignedCategoricalValues(dataset: Dataset, columnX: DatasetColumn, columnY: DatasetColumn) {
  const rowValues: string[] = [];
  const colValues: string[] = [];
  for (const row of dataset.rows) {
    const vx = row.values[columnX.id];
    const vy = row.values[columnY.id];
    if (vx === null || vx === undefined || vy === null || vy === undefined) continue;
    rowValues.push(String(vx).trim().toLowerCase());
    colValues.push(String(vy).trim().toLowerCase());
  }
  const rowLabels = [...new Set(rowValues)];
  const colLabels = [...new Set(colValues)];
  return { rowValues, colValues, rowLabels, colLabels };
}

function chiSquarePrerequisites(dataset: Dataset, columnX: DatasetColumn, columnY: DatasetColumn): AnalysisPrerequisite[] {
  const { rowValues, colValues, rowLabels, colLabels } = alignedCategoricalValues(dataset, columnX, columnY);
  const prerequisites: AnalysisPrerequisite[] = [
    { label: "Deux variables catégorielles/ordinales", status: "pass" },
  ];

  if (rowValues.length < 2 || rowLabels.length < 2 || colLabels.length < 2) {
    prerequisites.push({
      label: "Effectifs attendus suffisants",
      status: "unknown",
      detail: "Pas assez d'observations valides communes pour évaluer cette condition.",
    });
    return prerequisites;
  }

  const table = buildContingencyTable(rowValues, colValues, rowLabels, colLabels);
  const result = calculateChiSquare(table);
  prerequisites.push({
    label: "Effectifs attendus suffisants (≥ 5 par cellule, recommandation usuelle)",
    status: result.assumptionsMet ? "pass" : "warning",
    detail: result.assumptionsMet
      ? undefined
      : `${result.expectedCellsBelow5Count} cellule(s) sur ${result.totalCells} ont un effectif attendu inférieur à 5 — à examiner avant d'interpréter le test.`,
  });
  return prerequisites;
}

function buildBivariateItem(
  dataset: Dataset,
  hypothesis: ResearchHypothesis,
  variableX: ResearchVariable,
  variableY: ResearchVariable,
  columnX: DatasetColumn,
  columnY: DatasetColumn
): AnalysisItem {
  const { method, reason } = determineBivariateMethod(columnX, columnY);

  const typeByMethod: Record<string, AnalysisItemType> = {
    chi_square: "CHI_SQUARE",
    pearson_spearman: "CORRELATION",
    spearman: "CORRELATION",
    group_comparison: "GROUP_COMPARISON",
  };

  const base = {
    id: randomUUID(),
    hypothesisId: hypothesis.id,
    variableIds: [variableX.id, variableY.id],
    columnIds: [columnX.id, columnY.id],
    rationale: `Proposée pour examiner l'hypothèse "${hypothesis.statement}" entre "${variableX.name}" et "${variableY.name}". ${reason}`,
    status: "proposed" as const,
  };

  if (method === "unsupported") {
    return {
      ...base,
      analysisType: "CROSS_TABULATION",
      availability: "available",
      prerequisites: [{ label: "Types de variables compatibles", status: "fail", detail: reason }],
      priority: "not_recommended",
    };
  }

  const prerequisites =
    method === "chi_square"
      ? chiSquarePrerequisites(dataset, columnX, columnY)
      : [{ label: "Au moins deux observations valides communes", status: "pass" as const }];

  return {
    ...base,
    analysisType: typeByMethod[method],
    availability: "available",
    prerequisites,
    priority: "recommended",
  };
}

export function generateAnalysisPlan(project: ResearchProject, dataset: Dataset): AnalysisPlan {
  const items: AnalysisItem[] = [];

  const variableById = new Map(project.variables.map((v) => [v.id, v]));

  // -- Items descriptifs : une variable observée (mapping confirmé) = un item.
  for (const variable of project.variables) {
    const column = findMappedColumn(dataset, variable.id);
    if (column) items.push(buildDescriptiveItem(variable, column));
  }

  // -- Items bivariés : une hypothèse à deux variables, toutes deux observées.
  for (const hypothesis of project.hypotheses) {
    const [varIdX, varIdY] = hypothesis.variableIds ?? [];
    if (!varIdX || !varIdY) continue;

    const variableX = variableById.get(varIdX);
    const variableY = variableById.get(varIdY);
    if (!variableX || !variableY) continue;

    const columnX = findMappedColumn(dataset, varIdX);
    const columnY = findMappedColumn(dataset, varIdY);
    if (!columnX || !columnY) continue;

    items.push(buildBivariateItem(dataset, hypothesis, variableX, variableY, columnX, columnY));
  }

  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    projectId: project.id,
    datasetId: dataset.id,
    status: items.length > 0 ? "proposed" : "draft",
    items,
    createdAt: now,
    updatedAt: now,
  };
}
