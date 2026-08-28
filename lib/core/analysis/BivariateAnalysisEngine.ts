// ============================================================
// ACADIA — BIVARIATE ANALYSIS ENGINE (P7)
//
// Transforme deux colonnes du Dataset (P5) en une analyse
// bivariée DESCRIPTIVE : association, pas causalité. Aucune
// régression, aucun MCO, aucune estimation d'effet causal (voir
// interdictions du sprint P7) — ces éléments appartiennent à P8.
//
// 100 % déterministe, zéro appel OpenAI, comme
// DescriptiveAnalysisEngine (P6). Vue calculée à la volée à
// partir du Dataset — jamais persistée séparément (P7.1/P7.28) :
// après une modification du Dataset, un nouvel appel à
// buildBivariateAnalysis() reflète automatiquement les données
// à jour, sans risque de résultat périmé affiché comme actuel.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset, DatasetColumn, DatasetRow } from "@/lib/core/dataset/DatasetTypes";
import { valueMatchesType } from "@/lib/core/dataset/DatasetEngine";

import {
  calculateMax,
  calculateMean,
  calculateMedian,
  calculateMin,
  calculateStandardDeviation,
  formatPercentage,
  formatStat,
  toFiniteNumber,
} from "./StatisticsMath";

import {
  buildContingencyTable,
  calculateChiSquare,
  calculateColumnPercentages,
  calculateCramersV,
  calculatePearsonCorrelation,
  calculateRowPercentages,
  calculateSpearmanCorrelation,
} from "./BivariateStatistics";

import type {
  BivariateAnalysis,
  BivariateMethod,
  BivariateReadiness,
  BivariateStatus,
  CorrelationBlock,
  GroupComparisonResult,
  GroupStat,
  HypothesisLink,
} from "./BivariateAnalysisTypes";


// ============================================================
// SEUIL DE SIGNIFICATIVITÉ (P7.20)
// ============================================================

export const DEFAULT_ALPHA = 0.05;


// ============================================================
// UTILITAIRES
// ============================================================

function isMissing(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "oui" || v === "yes") return true;
    if (v === "false" || v === "non" || v === "no") return false;
  }
  return null;
}

/** Même règle que DescriptiveAnalysisEngine — jamais un mapping inventé. */
function resolveOrdinalCode(column: DatasetColumn, rawValue: unknown): number | null {
  const label = String(rawValue);
  const option = (column.options ?? []).find((o) => o.label === label);
  if (!option) return null;
  const code = Number(option.value);
  return Number.isFinite(code) ? code : null;
}

function labelFor(column: DatasetColumn, raw: unknown): string {
  if (column.dataType === "boolean") {
    const b = normalizeBoolean(raw);
    return b === null ? String(raw) : b ? "Oui" : "Non";
  }
  return String(raw);
}

/** Catalogue ordonné des modalités — ordre méthodologique de column.options d'abord, jamais un tri alphabétique. */
function categoricalCatalog(column: DatasetColumn, encountered: string[]): string[] {
  const catalog = column.dataType === "boolean" ? ["Oui", "Non"] : (column.options ?? []).map((o) => o.label);
  const seen = new Set(catalog);
  for (const v of encountered) {
    if (!seen.has(v)) {
      seen.add(v);
      catalog.push(v);
    }
  }
  return catalog;
}


// ============================================================
// CLASSIFICATION D'UNE COLONNE (P7.3)
// ============================================================

type ColumnKind = "numeric" | "ordinal" | "categorical" | "binary" | "unsupported";

function classifyColumn(column: DatasetColumn): ColumnKind {
  if (column.dataType === "boolean") return "binary";
  if (column.dataType === "integer" || column.dataType === "decimal") return "numeric";
  if ((column.dataType === "likert" || column.dataType === "single_choice") && column.measurementLevel === "ordinal") {
    return "ordinal";
  }
  if (column.dataType === "single_choice" || column.dataType === "likert") return "categorical";
  return "unsupported"; // text, date, multiple_choice — hors périmètre P7
}

export function determineBivariateMethod(
  columnX: DatasetColumn,
  columnY: DatasetColumn
): { method: BivariateMethod; reason: string } {
  const kx = classifyColumn(columnX);
  const ky = classifyColumn(columnY);

  if (kx === "unsupported" || ky === "unsupported") {
    return {
      method: "unsupported",
      reason:
        "L'analyse bivariée quantitative n'est pas applicable entre ces deux variables (texte libre, date ou choix multiples non pris en charge à ce stade).",
    };
  }

  const isNumeric = (k: ColumnKind) => k === "numeric";
  const isOrdinal = (k: ColumnKind) => k === "ordinal";
  const isDiscrete = (k: ColumnKind) => k === "categorical" || k === "binary" || k === "ordinal";

  if (isNumeric(kx) && isNumeric(ky)) {
    return {
      method: "pearson_spearman",
      reason: "Deux variables numériques : corrélations de Pearson et de Spearman.",
    };
  }
  if ((isNumeric(kx) && isOrdinal(ky)) || (isOrdinal(kx) && isNumeric(ky)) || (isOrdinal(kx) && isOrdinal(ky))) {
    return {
      method: "spearman",
      reason: "Au moins une variable ordinale : corrélation de Spearman, adaptée aux relations monotones.",
    };
  }
  if ((isNumeric(kx) && isDiscrete(ky)) || (isDiscrete(kx) && isNumeric(ky))) {
    return {
      method: "group_comparison",
      reason: "Une variable catégorielle/ordinale/binaire et une variable numérique : comparaison descriptive entre groupes.",
    };
  }
  if (isDiscrete(kx) && isDiscrete(ky)) {
    return {
      method: "chi_square",
      reason: "Deux variables catégorielles/ordinales/binaires : tableau croisé et test du χ² d'indépendance.",
    };
  }

  return { method: "unsupported", reason: "Combinaison de types non prise en charge à ce stade." };
}

const METHOD_LABELS: Record<BivariateMethod, string> = {
  chi_square: "Tableau croisé + test du χ²",
  pearson_spearman: "Corrélation de Pearson / Spearman",
  spearman: "Corrélation de Spearman",
  group_comparison: "Comparaison descriptive entre groupes",
  unsupported: "Non applicable",
};


// ============================================================
// EXTRACTION DES PAIRES VALIDES (P7.18 / P7.19)
// ============================================================

function extractValidRows(dataset: Dataset, columnX: DatasetColumn, columnY: DatasetColumn) {
  let missingPairCount = 0;
  let invalidCount = 0;
  const validRows: DatasetRow[] = [];

  for (const row of dataset.rows) {
    const vx = row.values[columnX.id];
    const vy = row.values[columnY.id];

    if (isMissing(vx) || isMissing(vy)) {
      missingPairCount++;
      continue;
    }

    if (!valueMatchesType(vx, columnX) || !valueMatchesType(vy, columnY)) {
      invalidCount++;
      continue;
    }

    validRows.push(row);
  }

  return { validRows, missingPairCount, invalidCount };
}


// ============================================================
// COMPARAISON DE GROUPES (P7.14 / P7.15)
// ============================================================

function buildGroupComparison(
  groupColumn: DatasetColumn,
  valueColumn: DatasetColumn,
  rows: DatasetRow[]
): GroupComparisonResult {
  const labels = rows.map((r) => labelFor(groupColumn, r.values[groupColumn.id]));
  const catalog = categoricalCatalog(groupColumn, labels);

  const groups: GroupStat[] = catalog.map((groupLabel) => {
    const values = rows
      .filter((r, i) => labels[i] === groupLabel)
      .map((r) => toFiniteNumber(r.values[valueColumn.id]))
      .filter((v): v is number => v !== null);

    return {
      groupLabel,
      n: values.length,
      mean: calculateMean(values),
      median: calculateMedian(values),
      standardDeviation: calculateStandardDeviation(values),
      min: calculateMin(values),
      max: calculateMax(values),
    };
  });

  return { groups: groups.filter((g) => g.n > 0) };
}


// ============================================================
// INTENSITÉ DESCRIPTIVE (P7.9 / P7.12) — repères, pas une vérité absolue
// ============================================================

function correlationIntensityLabel(absCoefficient: number): string {
  if (absCoefficient < 0.1) return "négligeable";
  if (absCoefficient < 0.3) return "faible";
  if (absCoefficient < 0.5) return "modérée";
  if (absCoefficient < 0.7) return "modérée à forte";
  return "forte";
}

function cramersVIntensityLabel(v: number): string {
  if (v < 0.1) return "négligeable";
  if (v < 0.3) return "faible";
  if (v < 0.5) return "modérée";
  return "forte";
}


// ============================================================
// LIEN AVEC LE MODÈLE SCIENTIFIQUE (P7.24 / P7.25)
// ============================================================

function findScientificModelNote(project: ResearchProject, columnX: DatasetColumn, columnY: DatasetColumn): string {
  const roles = [columnX.role, columnY.role];
  if (roles.includes("independent") && roles.includes("dependent")) {
    return "Cette analyse correspond à la relation proposée dans le modèle de recherche (variable indépendante × variable dépendante).";
  }
  // P7.32 — projet descriptif (ou paire sans relation indépendante/dépendante
  // proposée) : l'analyse explore une association, elle n'invente jamais une
  // relation causale et ne change pas la nature descriptive du projet.
  return "Cette analyse explore une association entre les variables. Elle ne modifie pas le caractère descriptif du projet.";
}

/**
 * Ne classe jamais automatiquement un résultat comme "compatible" ou
 * "incompatible" avec une hypothèse — ResearchHypothesis.statement est
 * un texte libre, pas une prédiction structurée (signe attendu, seuil).
 * Le statut renvoyé est donc toujours prudent ("inconclusive"), jamais
 * une déduction inventée à partir d'un simple coefficient (P7.25).
 */
function findHypothesisLink(
  project: ResearchProject,
  columnX: DatasetColumn,
  columnY: DatasetColumn
): HypothesisLink | undefined {
  if (!columnX.variableId || !columnY.variableId) return undefined;

  const hypothesis = project.hypotheses.find(
    (h) => h.variableIds?.includes(columnX.variableId!) && h.variableIds?.includes(columnY.variableId!)
  );
  if (!hypothesis) return undefined;

  return {
    hypothesisId: hypothesis.id,
    statement: hypothesis.statement,
    compatibility: "inconclusive",
    note: "Résultat empirique à approfondir — une association statistique ne permet pas de confirmer une hypothèse.",
  };
}


// ============================================================
// INTERPRÉTATION DÉTERMINISTE (P7.23)
// ============================================================

interface InterpretationContext {
  method: BivariateMethod;
  reason: string;
  xLabel: string;
  yLabel: string;
  validPairCount: number;
  alpha: number;
  chi?: BivariateAnalysis["chiSquare"];
  pearson?: CorrelationBlock;
  spearman?: CorrelationBlock;
  groupComparison?: GroupComparisonResult;
}

function generateBivariateInterpretation(ctx: InterpretationContext): string[] {
  const lines: string[] = [];
  const { xLabel, yLabel, alpha } = ctx;

  if (ctx.method === "unsupported") {
    lines.push(ctx.reason);
    return lines;
  }

  if (ctx.method === "chi_square" && ctx.chi) {
    const chi = ctx.chi;
    lines.push(
      `Un tableau croisé et un test du χ² d'indépendance ont été calculés entre « ${xLabel} » et « ${yLabel} » (n = ${ctx.validPairCount}).`
    );

    if (!chi.assumptionsMet) {
      lines.push(
        "Les conditions d'application du test du χ² nécessitent une vérification (effectifs attendus faibles dans plusieurs cellules) — le résultat doit être interprété avec prudence."
      );
    }

    if (chi.chiSquare !== null && chi.pValue !== null) {
      lines.push(`χ²(${chi.degreesOfFreedom}) = ${formatStat(chi.chiSquare)}, p = ${formatStat(chi.pValue, 3)}.`);
      lines.push(`Seuil de significativité : ${formatPercentage(alpha * 100, 0)}.`);
      if (chi.pValue < alpha) {
        lines.push("Une association statistiquement significative est observée entre ces deux variables dans l'échantillon.");
        lines.push(
          "Son importance économique doit être appréciée dans le contexte de la recherche et du cadre théorique."
        );
      } else {
        lines.push("Aucune association statistiquement significative n'est mise en évidence au seuil retenu.");
      }
    }

    if (chi.cramersV !== null) {
      lines.push(
        `V de Cramér = ${formatStat(chi.cramersV)} — intensité ${cramersVIntensityLabel(chi.cramersV)} de l'association (repère descriptif, pas une mesure d'effet causal).`
      );
    }

    lines.push("Ce résultat ne permet pas, à lui seul, de conclure à une relation causale.");
    lines.push("Une analyse économétrique pourra examiner cette relation en contrôlant d'autres facteurs.");
    return lines;
  }

  if ((ctx.method === "pearson_spearman" || ctx.method === "spearman") && (ctx.pearson || ctx.spearman)) {
    const primary = ctx.method === "pearson_spearman" ? ctx.pearson : ctx.spearman;
    const primaryName = ctx.method === "pearson_spearman" ? "Pearson" : "Spearman";
    const symbol = ctx.method === "pearson_spearman" ? "r" : "rho";

    if (primary && primary.coefficient !== null) {
      const r = primary.coefficient;
      const direction = r >= 0 ? "positive" : "négative";
      lines.push(
        `Une corrélation de ${primaryName} a été calculée entre « ${xLabel} » et « ${yLabel} » (n = ${primary.n}) : ${symbol} = ${r >= 0 ? "+" : ""}${formatStat(r)}.`
      );
      lines.push(
        `Une association ${direction} d'intensité ${correlationIntensityLabel(Math.abs(r))} est observée entre ${xLabel} et ${yLabel}.`
      );
      lines.push(
        `Cette corrélation indique que les deux variables tendent à évoluer ${r >= 0 ? "dans le même sens" : "en sens opposé"} dans l'échantillon.`
      );

      if (primary.pValue !== null) {
        lines.push(`p = ${formatStat(primary.pValue, 3)} (seuil de significativité : ${formatPercentage(alpha * 100, 0)}).`);
        lines.push(
          primary.pValue < alpha
            ? "Cette association est statistiquement significative au seuil retenu."
            : "Cette association n'est pas statistiquement significative au seuil retenu."
        );
      }

      if (ctx.method === "pearson_spearman" && ctx.spearman?.coefficient !== null && ctx.spearman) {
        lines.push(
          `À titre de confirmation, la corrélation de Spearman donne rho = ${ctx.spearman.coefficient! >= 0 ? "+" : ""}${formatStat(ctx.spearman.coefficient)}.`
        );
      }
    } else {
      const warningText = primary?.warnings?.join(" ") ?? "";
      lines.push(`La corrélation entre « ${xLabel} » et « ${yLabel} » n'a pas pu être calculée. ${warningText}`.trim());
    }

    lines.push("Une corrélation ne permet pas à elle seule d'établir une causalité.");
    lines.push("Une analyse économétrique pourra examiner cette relation en contrôlant d'autres facteurs.");
    return lines;
  }

  if (ctx.method === "group_comparison" && ctx.groupComparison) {
    lines.push(
      `Les valeurs de la variable numérique ont été comparées selon les groupes de la variable catégorielle (n = ${ctx.validPairCount}).`
    );

    const withMean = ctx.groupComparison.groups.filter((g) => g.mean !== null);
    if (withMean.length > 0) {
      const sorted = [...withMean].sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0));
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      lines.push(
        `La moyenne la plus élevée est observée dans le groupe « ${top.groupLabel} » (${formatStat(top.mean)}), la plus faible dans « ${bottom.groupLabel} » (${formatStat(bottom.mean)}).`
      );
    }

    lines.push(
      "Cette comparaison est descriptive : elle ne permet pas de conclure à une différence statistiquement significative entre les groupes sans test approprié (test t, ANOVA — non couverts à ce stade)."
    );
    lines.push("Une analyse économétrique ou un test de comparaison de moyennes pourra approfondir cette relation.");
    return lines;
  }

  return lines;
}


// ============================================================
// READINESS BIVARIÉE (P7.29)
// ============================================================

export function computeBivariateReadiness(analysis: BivariateAnalysis): BivariateReadiness {
  const variableXDefined = Boolean(analysis.variableX.columnId);
  const variableYDefined = Boolean(analysis.variableY.columnId);
  const sufficientN = analysis.validPairCount >= 5;
  const missingDataOk = analysis.validPairCount > 0;
  const methodCompatible = analysis.method !== "unsupported";
  const analyzable = analysis.status === "ready";

  return {
    datasetValid: true,
    variableXDefined,
    variableYDefined,
    sufficientN,
    missingDataOk,
    methodCompatible,
    analyzable,
    label: analyzable ? "Prêt pour l'analyse bivariée" : "Analyse à vérifier",
  };
}


// ============================================================
// CONSTRUCTION COMPLÈTE DE L'ANALYSE
// ============================================================

export function buildBivariateAnalysis(
  project: ResearchProject,
  dataset: Dataset,
  columnXId: string,
  columnYId: string,
  alpha: number = DEFAULT_ALPHA
): BivariateAnalysis {
  const columnX = dataset.columns.find((c) => c.id === columnXId);
  const columnY = dataset.columns.find((c) => c.id === columnYId);

  const createdAt = new Date().toISOString();
  const baseId = `bivariate-${dataset.id}-${columnXId}-${columnYId}`;

  if (!columnX || !columnY) {
    return {
      id: baseId,
      projectId: project.id,
      datasetId: dataset.id,
      variableX: { columnId: columnXId, label: "?" },
      variableY: { columnId: columnYId, label: "?" },
      method: "unsupported",
      methodLabel: METHOD_LABELS.unsupported,
      sampleSize: dataset.rows.length,
      validPairCount: 0,
      missingPairCount: 0,
      status: "unsupported",
      interpretation: ["Sélectionnez deux variables du dataset pour lancer l'analyse."],
      warnings: [],
      createdAt,
    };
  }

  const { method, reason } = determineBivariateMethod(columnX, columnY);
  const { validRows, missingPairCount, invalidCount } = extractValidRows(dataset, columnX, columnY);
  const validPairCount = validRows.length;

  const warnings: string[] = [];
  if (validPairCount < 5 && validPairCount > 0) {
    warnings.push("Effectif limité : les résultats doivent être interprétés avec prudence.");
  }

  let status: BivariateStatus;
  if (method === "unsupported") {
    status = "unsupported";
  } else if (invalidCount > 0) {
    status = "invalid_data";
    warnings.push(
      `Analyse impossible pour ${invalidCount} observation(s) : valeur incompatible détectée sur « ${columnX.label} » ou « ${columnY.label} ». Corrigez-les dans le tableau du dataset.`
    );
  } else if (validPairCount === 0) {
    status = "insufficient_data";
    warnings.push("Aucune paire de valeurs valides n'est disponible pour ces deux variables.");
  } else {
    status = "ready";
  }

  const scientificModelNote = status === "ready" ? findScientificModelNote(project, columnX, columnY) : undefined;
  const hypothesisLink = status === "ready" ? findHypothesisLink(project, columnX, columnY) : undefined;

  const analysis: BivariateAnalysis = {
    id: baseId,
    projectId: project.id,
    datasetId: dataset.id,
    variableX: { columnId: columnX.id, label: columnX.label, role: columnX.role },
    variableY: { columnId: columnY.id, label: columnY.label, role: columnY.role },
    method,
    methodLabel: METHOD_LABELS[method],
    sampleSize: dataset.rows.length,
    validPairCount,
    missingPairCount,
    status,
    scientificModelNote,
    hypothesisLink,
    interpretation: [],
    warnings,
    createdAt,
  };

  if (status !== "ready") {
    analysis.interpretation = generateBivariateInterpretation({
      method,
      reason,
      xLabel: columnX.label,
      yLabel: columnY.label,
      validPairCount,
      alpha,
    });
    return analysis;
  }

  // -- P7.18 : documenter la base utilisée pour le calcul -------------------
  warnings.push(
    `Analyse basée sur ${validPairCount} paire(s) valide(s) sur ${dataset.rows.length} observation(s). Les observations présentant une valeur manquante sur X ou Y ne sont pas utilisées pour ce calcul.`
  );

  if (method === "chi_square") {
    const xLabels = validRows.map((r) => labelFor(columnX, r.values[columnX.id]));
    const yLabels = validRows.map((r) => labelFor(columnY, r.values[columnY.id]));
    const rowCatalog = categoricalCatalog(columnX, xLabels);
    const colCatalog = categoricalCatalog(columnY, yLabels);

    const table = buildContingencyTable(xLabels, yLabels, rowCatalog, colCatalog);
    const rowPercentages = calculateRowPercentages(table);
    const columnPercentages = calculateColumnPercentages(table);
    const chi = calculateChiSquare(table);
    const cramersV = chi.chiSquare !== null ? calculateCramersV(chi.chiSquare, table.grandTotal, rowCatalog.length, colCatalog.length) : null;

    analysis.chiSquare = { table, rowPercentages, columnPercentages, ...chi, cramersV };
  }

  if (method === "pearson_spearman" || method === "spearman") {
    const pairs: [number, number][] = [];
    let unresolved = 0;

    for (const row of validRows) {
      const kx = classifyColumn(columnX);
      const ky = classifyColumn(columnY);
      const vx = kx === "numeric" ? toFiniteNumber(row.values[columnX.id]) : resolveOrdinalCode(columnX, row.values[columnX.id]);
      const vy = ky === "numeric" ? toFiniteNumber(row.values[columnY.id]) : resolveOrdinalCode(columnY, row.values[columnY.id]);
      if (vx === null || vy === null) {
        unresolved++;
        continue;
      }
      pairs.push([vx, vy]);
    }

    if (unresolved > 0) {
      warnings.push(`${unresolved} paire(s) n'ont pas pu être converties en valeurs numériques (modalité non reconnue dans l'échelle).`);
    }

    analysis.scatterPairs = pairs;

    if (method === "pearson_spearman") {
      analysis.pearson = calculatePearsonCorrelation(pairs);
      analysis.spearman = calculateSpearmanCorrelation(pairs);
    } else {
      analysis.spearman = calculateSpearmanCorrelation(pairs);
    }
  }

  if (method === "group_comparison") {
    const xIsNumeric = classifyColumn(columnX) === "numeric";
    const groupColumn = xIsNumeric ? columnY : columnX;
    const valueColumn = xIsNumeric ? columnX : columnY;
    analysis.groupComparison = buildGroupComparison(groupColumn, valueColumn, validRows);
  }

  analysis.interpretation = generateBivariateInterpretation({
    method,
    reason,
    xLabel: columnX.label,
    yLabel: columnY.label,
    validPairCount,
    alpha,
    chi: analysis.chiSquare,
    pearson: analysis.pearson,
    spearman: analysis.spearman,
    groupComparison: analysis.groupComparison,
  });

  return analysis;
}
