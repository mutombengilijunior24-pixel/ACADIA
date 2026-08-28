// ============================================================
// ACADIA — DESCRIPTIVE ANALYSIS ENGINE (P6)
//
// Transforme Dataset.rows/Dataset.columns (P5) en résultats
// statistiques DESCRIPTIFS uniquement — aucune corrélation,
// aucun test, aucune régression, aucune p-value, aucune
// interprétation causale (voir interdictions du sprint P6).
//
// 100 % déterministe, zéro appel OpenAI (P6.21) : ACADIA doit
// rester utilisable même si l'API IA est indisponible.
//
// L'analyse est une VUE calculée à la volée à partir du Dataset
// (P6.1/P6.25) — elle n'est jamais persistée séparément, donc
// toujours cohérente avec le Dataset après reload sans risque
// de duplication ou de désynchronisation.
//
// PRÉPARATION POUR P7+ (P6.13) : chaque résultat conserve
// variableId/dimensionId/indicatorId — un futur bloc pourra
// regrouper les résultats par variable pour construire un score
// composite. Ce bloc-ci n'en construit aucun.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset, DatasetColumn, DatasetRow } from "@/lib/core/dataset/DatasetTypes";
import { valueMatchesType } from "@/lib/core/dataset/DatasetEngine";

import type {
  DescriptiveAnalysis,
  DescriptiveAnalysisStatus,
  DescriptiveReading,
  DescriptiveVariableResult,
  FrequencyEntry,
  NumericalStatistics,
  SampleProfileEntry,
} from "./DescriptiveAnalysisTypes";

import {
  calculateMax,
  calculateMean,
  calculateMedian,
  calculateMin,
  calculateMode,
  calculateStandardDeviation,
  calculateVariance,
  formatPercentage,
  formatStat,
  toFiniteNumber,
} from "./StatisticsMath";


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

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = normalize(value);
    if (v === "true" || v === "oui" || v === "yes") return true;
    if (v === "false" || v === "non" || v === "no") return false;
  }
  return null;
}

/**
 * Convertit une modalité (label) en code numérique d'échelle en
 * s'appuyant sur `column.options` (jamais un mapping inventé) —
 * ex. "D'accord" → 4 pour une échelle Likert standard ACADIA.
 */
function resolveOrdinalCode(column: DatasetColumn, rawValue: unknown): number | null {
  const label = String(rawValue);
  const option = (column.options ?? []).find((o) => o.label === label);
  if (!option) return null;
  const code = Number(option.value);
  return Number.isFinite(code) ? code : null;
}


// ============================================================
// TABLEAUX DE FRÉQUENCES (P6.12)
//
// Respecte l'ordre méthodologique défini par column.options
// (jamais un tri alphabétique — une échelle Likert reste dans
// son ordre Jamais→Toujours / Pas du tout d'accord→Tout à fait
// d'accord). Les valeurs hors catalogue connu (ex. modalité
// renommée) sont conservées, jamais perdues ni reclassées.
// ============================================================

function makeFrequencyEntries(
  countsByLabel: Map<string, number>,
  orderedLabels: string[],
  sampleSize: number,
  validCount: number,
  cumulative: boolean
): FrequencyEntry[] {
  const entries: FrequencyEntry[] = [];
  const seen = new Set<string>();

  for (const label of orderedLabels) {
    seen.add(label);
    const count = countsByLabel.get(label) ?? 0;
    entries.push({
      value: label,
      label,
      count,
      percentage: sampleSize > 0 ? (count / sampleSize) * 100 : 0,
      validPercentage: validCount > 0 ? (count / validCount) * 100 : 0,
    });
  }

  for (const [label, count] of countsByLabel.entries()) {
    if (seen.has(label)) continue;
    entries.push({
      value: label,
      label,
      count,
      percentage: sampleSize > 0 ? (count / sampleSize) * 100 : 0,
      validPercentage: validCount > 0 ? (count / validCount) * 100 : 0,
    });
  }

  if (cumulative) {
    let running = 0;
    for (const entry of entries) {
      running += entry.validPercentage;
      entry.cumulativePercentage = running;
    }
  }

  return entries;
}

function buildLabelFrequency(
  column: DatasetColumn,
  values: unknown[],
  sampleSize: number,
  validCount: number
): FrequencyEntry[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const label = String(v);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const orderedLabels = (column.options ?? []).map((o) => o.label);
  return makeFrequencyEntries(counts, orderedLabels, sampleSize, validCount, column.measurementLevel === "ordinal");
}

function buildBooleanFrequency(values: boolean[], sampleSize: number, validCount: number): FrequencyEntry[] {
  const counts = new Map<string, number>();
  counts.set("Oui", values.filter((v) => v).length);
  counts.set("Non", values.filter((v) => !v).length);
  return makeFrequencyEntries(counts, ["Oui", "Non"], sampleSize, validCount, false);
}

/**
 * Choix explicite (P6.7) : `percentage`/`validPercentage` sont ici
 * le pourcentage de RÉPONDANTS ayant sélectionné la modalité (pas
 * le pourcentage des sélections totales) — affiché comme tel dans
 * l'UI pour ne jamais confondre les deux bases.
 */
function buildMultipleChoiceFrequency(
  column: DatasetColumn,
  values: unknown[],
  sampleSize: number,
  validCount: number
): FrequencyEntry[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!Array.isArray(v)) continue;
    for (const label of v) {
      counts.set(String(label), (counts.get(String(label)) ?? 0) + 1);
    }
  }
  const orderedLabels = (column.options ?? []).map((o) => o.label);
  return makeFrequencyEntries(counts, orderedLabels, sampleSize, validCount, false);
}


// ============================================================
// LECTURE DESCRIPTIVE (P6.20)
// ============================================================

const CAUSAL_LIMITATION =
  "Cette observation est descriptive et ne permet pas, à elle seule, d'établir une relation causale entre les variables.";

function buildReading(
  result: Omit<DescriptiveVariableResult, "reading">,
  column: DatasetColumn
): DescriptiveReading | undefined {
  const statements: string[] = [];

  if (result.numericalStatistics?.mean !== null && result.numericalStatistics?.mean !== undefined) {
    const { mean, median } = result.numericalStatistics;

    if (column.dataType === "likert") {
      const codes = (column.options ?? [])
        .map((o) => Number(o.value))
        .filter((n) => Number.isFinite(n));
      const scaleMax = codes.length > 0 ? Math.max(...codes) : null;
      const scaleMin = codes.length > 0 ? Math.min(...codes) : null;

      if (scaleMax !== null && scaleMin !== null) {
        const mid = (scaleMin + scaleMax) / 2;
        const comparisonPhrase =
          mean > mid ? "supérieur au point médian" : mean < mid ? "inférieur au point médian" : "proche du point médian";
        statements.push(
          `Le score moyen observé pour « ${column.label} » est de ${formatStat(mean)} sur ${scaleMax}, ce qui traduit descriptivement un niveau ${comparisonPhrase} de l'échelle (${formatStat(mid)}/${scaleMax}).`
        );
      } else {
        statements.push(`Le score moyen observé pour « ${column.label} » est de ${formatStat(mean)}.`);
      }
    } else {
      statements.push(`La valeur moyenne observée pour « ${column.label} » est de ${formatStat(mean)}.`);
    }

    if (median !== null && median !== undefined) {
      statements.push(`La valeur médiane est de ${formatStat(median)}.`);
    }
  }

  if (result.frequencyTable && result.frequencyTable.length > 0 && result.validCount > 0) {
    const top = [...result.frequencyTable].sort((a, b) => b.count - a.count)[0];
    if (top.count > 0) {
      statements.push(
        `Sur les ${result.validCount} réponse(s) valide(s), la modalité « ${top.label} » est la plus fréquente (${formatPercentage(top.validPercentage)}).`
      );
    }
  }

  if (statements.length === 0) return undefined;

  return { statements, limitation: CAUSAL_LIMITATION };
}


// ============================================================
// ANALYSE D'UNE COLONNE
// ============================================================

function analyzeColumn(column: DatasetColumn, rows: DatasetRow[], sampleSize: number): DescriptiveVariableResult {
  const rawValues = rows.map((r) => r.values[column.id]);
  const missingCount = rawValues.filter(isMissing).length;
  const validCount = sampleSize - missingCount;
  const nonMissingValues = rawValues.filter((v) => !isMissing(v));

  const base = {
    columnId: column.id,
    variableId: column.variableId,
    dimensionId: column.dimensionId,
    indicatorId: column.indicatorId,
    label: column.label,
    role: column.role,
    dataType: column.dataType,
    measurementLevel: column.measurementLevel,
    sampleSize,
    validCount,
    missingCount,
  };

  // -- Texte libre / date : pas de synthèse statistique à ce stade --------
  if (column.dataType === "text" || column.dataType === "date") {
    return {
      ...base,
      analyzable: true,
      warnings:
        column.dataType === "text"
          ? ["Réponses textuelles libres — non résumées statistiquement à ce stade (P6 ne couvre pas l'analyse de texte)."]
          : [],
    };
  }

  // -- Détection de valeurs incompatibles : bloque UNIQUEMENT cette variable (P6.22/P6.24) --
  const hasIncompatible = nonMissingValues.some((v) => !valueMatchesType(v, column));
  if (hasIncompatible) {
    return {
      ...base,
      analyzable: false,
      warnings: [
        `Valeur(s) incompatible(s) avec le type « ${column.dataType} » détectée(s) pour « ${column.label} » — corrigez-les dans le tableau du dataset avant analyse.`,
      ],
    };
  }

  if (column.dataType === "boolean") {
    const bools = nonMissingValues.map(normalizeBoolean).filter((b): b is boolean => b !== null);
    const frequencyTable = buildBooleanFrequency(bools, sampleSize, validCount);
    const result: DescriptiveVariableResult = { ...base, analyzable: true, warnings: [], frequencyTable };
    return { ...result, reading: buildReading(result, column) };
  }

  if (column.dataType === "multiple_choice") {
    const frequencyTable = buildMultipleChoiceFrequency(column, nonMissingValues, sampleSize, validCount);
    const result: DescriptiveVariableResult = { ...base, analyzable: true, warnings: [], frequencyTable };
    return { ...result, reading: buildReading(result, column) };
  }

  if (column.dataType === "single_choice" || column.dataType === "likert") {
    const frequencyTable = buildLabelFrequency(column, nonMissingValues, sampleSize, validCount);
    const warnings: string[] = [];
    let numericalStatistics: NumericalStatistics | undefined;

    if (column.measurementLevel === "ordinal") {
      const codes: number[] = [];
      let unresolved = 0;
      for (const v of nonMissingValues) {
        const code = resolveOrdinalCode(column, v);
        if (code === null) unresolved++;
        else codes.push(code);
      }
      if (unresolved > 0) {
        warnings.push(
          `${unresolved} valeur(s) n'ont pas pu être converties en code numérique pour le calcul (modalité non reconnue dans l'échelle).`
        );
      }

      numericalStatistics = {
        min: calculateMin(codes),
        max: calculateMax(codes),
        // Moyenne uniquement pour les échelles Likert numériquement codées
        // (convention courante en sciences de gestion) — jamais pour un
        // simple choix unique catégoriel, même ordinal (P6.4).
        mean: column.dataType === "likert" ? calculateMean(codes) : null,
        median: calculateMedian(codes),
        mode: calculateMode(codes),
        variance: null,
        standardDeviation: null,
      };
    }

    const result: DescriptiveVariableResult = { ...base, analyzable: true, warnings, frequencyTable, numericalStatistics };
    return { ...result, reading: buildReading(result, column) };
  }

  // -- integer / decimal (interval / ratio) — P6.5 -------------------------
  const numbers = nonMissingValues.map(toFiniteNumber).filter((n): n is number => n !== null);
  const numericalStatistics: NumericalStatistics = {
    min: calculateMin(numbers),
    max: calculateMax(numbers),
    mean: calculateMean(numbers),
    median: calculateMedian(numbers),
    mode: calculateMode(numbers),
    variance: calculateVariance(numbers),
    standardDeviation: calculateStandardDeviation(numbers),
  };
  const result: DescriptiveVariableResult = { ...base, analyzable: true, warnings: [], numericalStatistics };
  return { ...result, reading: buildReading(result, column) };
}


// ============================================================
// PROFIL DE L'ÉCHANTILLON (P6.14)
//
// Utilise UNIQUEMENT des colonnes réellement présentes dans le
// Dataset — reconnues par une correspondance structurelle sur
// leur libellé, jamais créées ou supposées.
// ============================================================

const SOCIODEMOGRAPHIC_KEYWORDS = [
  "age",
  "sexe",
  "genre",
  "anciennete",
  "fonction",
  "poste",
  "niveau d'etude",
  "niveau d etude",
  "diplome",
  "situation matrimoniale",
  "statut matrimonial",
];

function isSociodemographicLabel(label: string): boolean {
  const normalized = normalize(label);
  return SOCIODEMOGRAPHIC_KEYWORDS.some((k) => normalized.includes(normalize(k)));
}


// ============================================================
// ANALYSE COMPLÈTE DU DATASET
// ============================================================

export function buildDescriptiveAnalysis(project: ResearchProject, dataset: Dataset): DescriptiveAnalysis {
  const sampleSize = dataset.rows.length;

  const variableResults = dataset.columns.map((column) => analyzeColumn(column, dataset.rows, sampleSize));

  const analyzableCount = variableResults.filter((r) => r.analyzable).length;
  const errorCount = variableResults.length - analyzableCount;

  const sampleProfile: SampleProfileEntry[] = variableResults
    .filter((r) => isSociodemographicLabel(r.label))
    .map((r) => ({ columnId: r.columnId, label: r.label, result: r }));

  const qualityWarnings = variableResults.flatMap((r) => r.warnings);

  const status: DescriptiveAnalysisStatus = sampleSize === 0 ? "empty" : errorCount > 0 ? "partial" : "ready";

  return {
    id: `analysis-${dataset.id}`,
    datasetId: dataset.id,
    projectId: project.id,
    createdAt: new Date().toISOString(),
    status,
    sampleSize,
    variableResults,
    sampleProfile,
    analyzableCount,
    errorCount,
    qualityWarnings,
  };
}
