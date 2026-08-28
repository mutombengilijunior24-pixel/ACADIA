// ============================================================
// ACADIA — ECONOMETRIC MODEL ENGINE (P8)
//
// Construit un modèle MCO à partir du Dataset (P5) et des
// métadonnées scientifiques du projet (P2). 100 % déterministe,
// zéro appel OpenAI (P8.60) : CALCUL STATISTIQUE = MOTEUR
// DÉTERMINISTE. Vue calculée à la volée — jamais persistée
// séparément (P8.56) : après modification du Dataset, un nouvel
// appel à buildEconometricModel() reflète les données à jour.
//
// INTERDIT dans ce fichier (comme partout dans le projet) :
// aucune invention de lien causal. Chaque coefficient significatif
// reste une "association conditionnelle", jamais un effet causal
// prouvé (P8.62).
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset, DatasetColumn, DatasetRow } from "@/lib/core/dataset/DatasetTypes";
import { valueMatchesType } from "@/lib/core/dataset/DatasetEngine";

import {
  breuschPaganTest,
  calculateCooksDistance,
  calculateOLS,
  calculateVIF,
  jarqueBeraTest,
} from "./EconometricStatistics";

import { formatPercentage, formatStat, toFiniteNumber } from "./StatisticsMath";

import type {
  CoefficientRow,
  EconometricDiagnostics,
  EconometricHypothesisLink,
  EconometricModel,
  EconometricReadiness,
  EncodedRegressor,
  EncodingType,
  InfluentialObservationRow,
  VIFRow,
} from "./EconometricModelTypes";


// ============================================================
// SEUIL DE SIGNIFICATIVITÉ — cohérent avec P7 (bivariée)
// ============================================================

export const DEFAULT_ALPHA = 0.05;
const VIF_CONCERN_THRESHOLD = 5;


// ============================================================
// UTILITAIRES
// ============================================================

function normalize(value: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .trim();
}

function isMissing(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function resolveOrdinalCode(column: DatasetColumn, rawValue: unknown): number | null {
  const label = String(rawValue);
  const option = (column.options ?? []).find((o) => o.label === label);
  if (!option) return null;
  const code = Number(option.value);
  return Number.isFinite(code) ? code : null;
}

function normalizeBoolean(value: unknown): number | null {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const v = normalize(value);
    if (v === "true" || v === "oui" || v === "yes") return 1;
    if (v === "false" || v === "non" || v === "no") return 0;
  }
  return null;
}


// ============================================================
// CLASSIFICATION D'UNE COLONNE POUR L'ENCODAGE (P8)
// ============================================================

type ColumnEncodingKind = "continuous" | "binary" | "ordinal" | "categorical_nominal" | "unsupported";

function classifyForEncoding(column: DatasetColumn): ColumnEncodingKind {
  if (column.dataType === "boolean") return "binary";
  if (column.dataType === "integer" || column.dataType === "decimal") return "continuous";
  if ((column.dataType === "likert" || column.dataType === "single_choice") && column.measurementLevel === "ordinal") {
    return "ordinal";
  }
  if (column.dataType === "single_choice" || column.dataType === "likert") return "categorical_nominal";
  return "unsupported"; // text, date, multiple_choice
}

export function isColumnEligibleForEconometrics(column: DatasetColumn): boolean {
  return classifyForEncoding(column) !== "unsupported";
}


// ============================================================
// ENCODAGE D'UNE COLONNE EN UN OU PLUSIEURS RÉGRESSEURS
//
// Catégorielle nominale à k modalités -> k-1 dummies, modalité de
// référence = première du catalogue (column.options, jamais un
// choix arbitraire caché) — toujours documentée explicitement.
// ============================================================

interface RegressorDefinition {
  regressor: EncodedRegressor;
  /** Extrait la valeur numérique encodée pour une ligne — `null` si absente/non résolue. */
  extract: (row: DatasetRow) => number | null;
}

function buildRegressorDefinitions(
  column: DatasetColumn,
  role: "principal" | "control"
): RegressorDefinition[] {
  const kind = classifyForEncoding(column);

  if (kind === "continuous") {
    return [
      {
        regressor: {
          name: column.name,
          label: column.label,
          sourceColumnId: column.id,
          encodingType: "continuous",
          role,
          variableRole: column.role,
        },
        extract: (row) => toFiniteNumber(row.values[column.id]),
      },
    ];
  }

  if (kind === "binary") {
    return [
      {
        regressor: {
          name: column.name,
          label: `${column.label} (1 = Oui)`,
          sourceColumnId: column.id,
          encodingType: "binary",
          role,
          variableRole: column.role,
        },
        extract: (row) => normalizeBoolean(row.values[column.id]),
      },
    ];
  }

  if (kind === "ordinal") {
    return [
      {
        regressor: {
          name: column.name,
          label: column.label,
          sourceColumnId: column.id,
          encodingType: "ordinal_numeric",
          role,
          variableRole: column.role,
        },
        extract: (row) => resolveOrdinalCode(column, row.values[column.id]),
      },
    ];
  }

  // categorical_nominal -> dummies (k-1), référence = première modalité du catalogue
  const catalog = (column.options ?? []).map((o) => o.label);
  if (catalog.length < 2) return [];

  const [reference, ...levels] = catalog;
  return levels.map((level) => ({
    regressor: {
      name: `${column.name}_${normalize(level).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "X"}`,
      label: `${column.label} = ${level} (réf. : ${reference})`,
      sourceColumnId: column.id,
      encodingType: "dummy" as EncodingType,
      referenceCategory: reference,
      role,
      variableRole: column.role,
    },
    extract: (row: DatasetRow) => {
      const raw = row.values[column.id];
      if (isMissing(raw)) return null;
      return String(raw) === level ? 1 : 0;
    },
  }));
}


// ============================================================
// LECTURE DÉTERMINISTE (P8.62 — jamais de vérité absolue)
// ============================================================

const CAUSAL_LIMITATION =
  "Ces résultats traduisent une association statistique conditionnelle (« toutes choses égales par ailleurs » parmi les variables incluses) et ne constituent pas une preuve de causalité.";

function significanceLabel(pValue: number | null, alpha: number): string {
  if (pValue === null) return "non déterminée";
  return pValue < alpha ? "statistiquement significatif" : "non statistiquement significatif";
}

function buildInterpretation(model: EconometricModel, alpha: number): string[] {
  const lines: string[] = [];

  if (model.status !== "ready") {
    return model.warnings.length > 0 ? [...model.warnings] : ["Le modèle ne peut pas être estimé dans sa configuration actuelle."];
  }

  lines.push(
    `Un modèle de régression par MCO a été estimé pour expliquer « ${model.dependent.label} » à partir de ${model.regressors.length} régresseur(s) (n = ${model.validObservationCount}).`
  );

  if (model.r2 !== null) {
    lines.push(
      `Le modèle explique ${formatPercentage(model.r2 * 100)} de la variance observée de « ${model.dependent.label} » dans l'échantillon (R² = ${formatStat(model.r2)}${model.adjustedR2 !== null ? `, R² ajusté = ${formatStat(model.adjustedR2)}` : ""}).`
    );
  }

  if (model.fStatistic !== null && model.fPValue !== null) {
    lines.push(
      `F(${model.regressors.length}, ${model.degreesOfFreedomResidual}) = ${formatStat(model.fStatistic)}, p = ${formatStat(model.fPValue, 3)} — le modèle dans son ensemble est ${significanceLabel(model.fPValue, alpha)} au seuil de ${formatPercentage(alpha * 100, 0)}.`
    );
  }

  const principal = model.coefficients.filter((c) => c.role === "principal");
  for (const coef of principal) {
    const direction = coef.coefficient >= 0 ? "positive" : "négative";
    lines.push(
      `« ${coef.label} » présente une association ${direction} avec « ${model.dependent.label} » (β = ${formatStat(coef.coefficient)}${coef.pValue !== null ? `, p = ${formatStat(coef.pValue, 3)}` : ""}) — ${significanceLabel(coef.pValue, alpha)}, toutes choses égales par ailleurs parmi les variables incluses.`
    );
  }

  lines.push(CAUSAL_LIMITATION);

  if (model.diagnostics) {
    const highVif = model.diagnostics.vif.filter((v) => v.concern);
    if (highVif.length > 0) {
      lines.push(
        `Un VIF élevé (> ${VIF_CONCERN_THRESHOLD}) est observé pour : ${highVif.map((v) => v.label).join(", ")}. Cela signale une redondance possible entre régresseurs — pas nécessairement une variable à supprimer.`
      );
    }
    if (model.diagnostics.heteroscedasticity.pValue !== null && model.diagnostics.heteroscedasticity.pValue < alpha) {
      lines.push(
        "Le test de Breusch-Pagan suggère une possible hétéroscédasticité des résidus — les erreurs standards doivent être interprétées avec prudence."
      );
    }
    if (model.diagnostics.normality.pValue !== null && model.diagnostics.normality.pValue < alpha) {
      lines.push(
        "Le test de Jarque-Bera suggère un écart à la normalité des résidus — un R² élevé ne garantit pas à lui seul que le modèle est correctement spécifié."
      );
    }
    if (model.diagnostics.influentialObservations.length > 0) {
      lines.push(
        `${model.diagnostics.influentialObservations.length} observation(s) présentent une distance de Cook élevée et méritent un examen (sans suppression automatique).`
      );
    }
  }

  lines.push("Un test non significatif ne prouve pas l'absence totale de relation dans la population.");

  return lines;
}


// ============================================================
// LIEN AVEC LES HYPOTHÈSES (même prudence qu'en P7 — jamais de
// classement automatique "confirmée/infirmée" à partir d'un texte
// libre non structuré).
// ============================================================

function findHypothesisLinks(
  project: ResearchProject,
  dependentColumn: DatasetColumn,
  regressorColumns: DatasetColumn[]
): EconometricHypothesisLink[] {
  if (!dependentColumn.variableId) return [];

  const regressorVariableIds = new Set(
    regressorColumns.map((c) => c.variableId).filter((v): v is string => Boolean(v))
  );

  return project.hypotheses
    .filter((h) => h.variableIds?.includes(dependentColumn.variableId!) && h.variableIds?.some((v) => regressorVariableIds.has(v)))
    .map((h) => ({
      hypothesisId: h.id,
      statement: h.statement,
      compatibility: "inconclusive" as const,
      note: "Résultat empirique à approfondir — une estimation MCO ne permet pas de confirmer une hypothèse.",
    }));
}


// ============================================================
// READINESS ÉCONOMÉTRIQUE (P8.61)
// ============================================================

export function computeEconometricReadiness(model: EconometricModel | null): EconometricReadiness {
  if (!model) {
    return {
      yDefined: false,
      xDefined: false,
      datasetAvailable: false,
      sufficientObservations: false,
      yHasVariance: false,
      identifiableMatrix: false,
      validCategoricalEncoding: false,
      modelSpecified: false,
      level: "impossible",
      label: "Estimation impossible",
    };
  }

  const yDefined = Boolean(model.dependent.columnId);
  const xDefined = model.regressors.length > 0;
  const datasetAvailable = true;
  const sufficientObservations = model.status !== "insufficient_data";
  const yHasVariance = model.status !== "no_variance";
  const identifiableMatrix = model.status !== "singular_matrix";
  const validCategoricalEncoding = model.status !== "unsupported";
  const modelSpecified = xDefined && yDefined;

  const allOk =
    yDefined && xDefined && sufficientObservations && yHasVariance && identifiableMatrix && validCategoricalEncoding && model.status === "ready";

  const level: EconometricReadiness["level"] = allOk ? "ready" : model.status === "not_specified" ? "impossible" : "to_review";

  return {
    yDefined,
    xDefined,
    datasetAvailable,
    sufficientObservations,
    yHasVariance,
    identifiableMatrix,
    validCategoricalEncoding,
    modelSpecified,
    level,
    label: allOk ? "Prêt pour estimation" : level === "impossible" ? "Estimation impossible" : "Modèle à vérifier",
  };
}


// ============================================================
// CONSTRUCTION COMPLÈTE DU MODÈLE
// ============================================================

export function buildEconometricModel(
  project: ResearchProject,
  dataset: Dataset,
  dependentColumnId: string,
  principalColumnIds: string[],
  controlColumnIds: string[],
  alpha: number = DEFAULT_ALPHA
): EconometricModel {
  const createdAt = new Date().toISOString();
  const id = `econometric-${dataset.id}-${dependentColumnId}`;

  const dependentColumn = dataset.columns.find((c) => c.id === dependentColumnId);
  const allXIds = [...principalColumnIds, ...controlColumnIds];
  const xColumns = allXIds
    .map((xid) => dataset.columns.find((c) => c.id === xid))
    .filter((c): c is DatasetColumn => Boolean(c));

  const base: EconometricModel = {
    id,
    projectId: project.id,
    datasetId: dataset.id,
    dependent: { columnId: dependentColumnId, label: dependentColumn?.label ?? "?" },
    regressors: [],
    sampleSize: dataset.rows.length,
    validObservationCount: 0,
    missingObservationCount: 0,
    status: "not_specified",
    equation: "",
    intercept: null,
    coefficients: [],
    r2: null,
    adjustedR2: null,
    sse: null,
    ssr: null,
    sst: null,
    fStatistic: null,
    fPValue: null,
    degreesOfFreedomResidual: 0,
    diagnostics: null,
    interpretation: [],
    hypothesisLinks: [],
    warnings: [],
    createdAt,
  };

  if (!dependentColumn || xColumns.length === 0) {
    base.warnings = ["Sélectionnez une variable Y et au moins une variable explicative pour spécifier le modèle."];
    base.interpretation = buildInterpretation(base, alpha);
    return base;
  }

  if (!isColumnEligibleForEconometrics(dependentColumn) || dependentColumn.dataType === "boolean" || classifyForEncoding(dependentColumn) === "categorical_nominal") {
    // Y doit être quantitative (continue) ou ordinale numériquement codée —
    // jamais une catégorielle nominale (aucune interprétation MCO valide).
    base.status = "unsupported";
    base.warnings = [
      `La variable Y sélectionnée (« ${dependentColumn.label} ») n'est pas d'un type quantitatif ou ordinal exploitable par une régression MCO.`,
    ];
    base.interpretation = buildInterpretation(base, alpha);
    return base;
  }

  const unsupportedX = xColumns.filter((c) => !isColumnEligibleForEconometrics(c));
  if (unsupportedX.length > 0) {
    base.status = "unsupported";
    base.warnings = [
      `Type non pris en charge pour : ${unsupportedX.map((c) => c.label).join(", ")} (texte libre, date ou choix multiples).`,
    ];
    base.interpretation = buildInterpretation(base, alpha);
    return base;
  }

  // -- Encodage des régresseurs ----------------------------------------
  const definitions: RegressorDefinition[] = [
    ...principalColumnIds.flatMap((cid) => {
      const col = dataset.columns.find((c) => c.id === cid);
      return col ? buildRegressorDefinitions(col, "principal") : [];
    }),
    ...controlColumnIds.flatMap((cid) => {
      const col = dataset.columns.find((c) => c.id === cid);
      return col ? buildRegressorDefinitions(col, "control") : [];
    }),
  ];

  if (definitions.length === 0) {
    base.status = "unsupported";
    base.warnings = ["Aucun régresseur exploitable n'a pu être construit à partir de la sélection (catégorie à une seule modalité ?)."];
    base.interpretation = buildInterpretation(base, alpha);
    return base;
  }

  // -- Extraction des lignes valides (Y + tous les X requis) — P8.18-like --
  const yExtract = (row: DatasetRow) => {
    const raw = row.values[dependentColumn.id];
    if (isMissing(raw) || !valueMatchesType(raw, dependentColumn)) return null;
    return classifyForEncoding(dependentColumn) === "ordinal" ? resolveOrdinalCode(dependentColumn, raw) : toFiniteNumber(raw);
  };

  const rowsWithValues = dataset.rows.map((row) => {
    const y = yExtract(row);
    const xValues = definitions.map((d) => d.extract(row));
    return { row, y, xValues };
  });

  const validRows = rowsWithValues.filter((r) => r.y !== null && r.xValues.every((v) => v !== null));
  const missingObservationCount = dataset.rows.length - validRows.length;

  base.regressors = definitions.map((d) => d.regressor);
  base.validObservationCount = validRows.length;
  base.missingObservationCount = missingObservationCount;
  base.warnings.push(
    `Analyse basée sur ${validRows.length} observation(s) valide(s) sur ${dataset.rows.length}. Les observations présentant une valeur manquante ou invalide sur Y ou l'un des régresseurs ne sont pas utilisées.`
  );

  // -- Retirer les régresseurs sans variation dans l'échantillon valide (P8 — vérification singularité) --
  const keptIndices: number[] = [];
  definitions.forEach((d, idx) => {
    const values = validRows.map((r) => r.xValues[idx] as number);
    const distinct = new Set(values);
    if (distinct.size < 2) {
      base.warnings.push(`Régresseur exclu — « ${d.regressor.label} » : aucune variation observée dans l'échantillon valide.`);
    } else {
      keptIndices.push(idx);
    }
  });

  if (keptIndices.length === 0) {
    base.status = "unsupported";
    base.interpretation = buildInterpretation(base, alpha);
    return base;
  }

  base.regressors = keptIndices.map((i) => definitions[i].regressor);

  const yValues = validRows.map((r) => r.y as number);
  const xMatrix = validRows.map((r) => keptIndices.map((i) => r.xValues[i] as number));

  const distinctY = new Set(yValues);
  if (distinctY.size < 2) {
    base.status = "no_variance";
    base.warnings.push(`« ${dependentColumn.label} » ne présente aucune variation dans l'échantillon valide — estimation impossible.`);
    base.interpretation = buildInterpretation(base, alpha);
    return base;
  }

  const p = keptIndices.length + 1;
  if (validRows.length <= p) {
    base.status = "insufficient_data";
    base.warnings.push(
      `Effectif insuffisant : ${validRows.length} observation(s) valide(s) pour ${keptIndices.length} régresseur(s) + 1 constante (${p} paramètres). Il faut n > ${p}.`
    );
    base.interpretation = buildInterpretation(base, alpha);
    return base;
  }

  const ols = calculateOLS(xMatrix, yValues);
  if (!ols) {
    base.status = "singular_matrix";
    base.warnings.push(
      "La matrice des régresseurs est singulière (colinéarité parfaite entre variables incluses) — l'estimation MCO n'est pas possible. Retirez ou combinez les régresseurs concernés."
    );
    base.interpretation = buildInterpretation(base, alpha);
    return base;
  }

  base.status = "ready";
  base.sse = ols.sse;
  base.ssr = ols.ssr;
  base.sst = ols.sst;
  base.r2 = ols.r2;
  base.adjustedR2 = ols.adjustedR2;
  base.fStatistic = ols.fStatistic;
  base.fPValue = ols.fPValue;
  base.degreesOfFreedomResidual = ols.degreesOfFreedomResidual;

  function toCoefficientRow(
    name: string,
    label: string,
    role: CoefficientRow["role"],
    coefficientIndex: number
  ): CoefficientRow {
    const pValue = ols!.pValues[coefficientIndex];
    return {
      name,
      label,
      coefficient: ols!.coefficients[coefficientIndex],
      standardError: ols!.standardErrors[coefficientIndex],
      tStatistic: ols!.tStatistics[coefficientIndex],
      pValue,
      confidenceInterval: ols!.confidenceIntervals[coefficientIndex],
      significant: pValue !== null && pValue < alpha,
      role,
    };
  }

  base.intercept = toCoefficientRow("Constante", "Constante", "intercept", 0);
  base.coefficients = base.regressors.map((r, i) => toCoefficientRow(r.name, r.label, r.role, i + 1));

  base.equation = `${dependentColumn.label} = ${formatStat(ols.coefficients[0])} ${base.regressors
    .map((r, i) => `${ols.coefficients[i + 1] >= 0 ? "+" : "−"} ${formatStat(Math.abs(ols.coefficients[i + 1]))}·${r.name}`)
    .join(" ")} + ε`;

  // -- Diagnostics -----------------------------------------------------
  const vifValues = calculateVIF(xMatrix);
  const vif: VIFRow[] = base.regressors.map((r, i) => ({
    name: r.name,
    label: r.label,
    vif: vifValues[i] ?? null,
    concern: (vifValues[i] ?? 0) > VIF_CONCERN_THRESHOLD,
  }));

  const heteroscedasticity = breuschPaganTest(xMatrix, ols.residuals);
  const normality = jarqueBeraTest(ols.residuals);

  const influence = calculateCooksDistance(xMatrix, ols.residuals, ols.xtxInverse, ols.meanSquaredError ?? 0);
  const influentialObservations: InfluentialObservationRow[] = influence
    .filter((inf) => inf.flagged)
    .map((inf) => ({
      rowIndex: inf.rowIndex,
      respondentLabel: validRows[inf.rowIndex]?.row.respondentId ?? `Obs. ${inf.rowIndex + 1}`,
      cooksDistance: inf.cooksDistance,
      leverage: inf.leverage,
    }));

  const diagnostics: EconometricDiagnostics = { vif, heteroscedasticity, normality, influentialObservations };
  base.diagnostics = diagnostics;

  base.hypothesisLinks = findHypothesisLinks(project, dependentColumn, xColumns);

  base.interpretation = buildInterpretation(base, alpha);

  return base;
}
