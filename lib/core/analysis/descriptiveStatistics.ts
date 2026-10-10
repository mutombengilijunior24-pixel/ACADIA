import { interpretCell } from "@/lib/core/data/cells";
import { excludedRows, preparedColumn } from "@/lib/core/data/preparation";
import { displayHeader } from "@/lib/core/data/headers";
import { quantile } from "@/lib/core/data/profile";
import type { ImportedDataset, PreparationState, StatisticalType, VariableMetadata } from "@/lib/core/data/types";

/**
 * ACADIA — Statistiques descriptives (moteur déterministe).
 *
 * Calculs réalisés uniquement à partir des observations importées, après application des
 * décisions de l'utilisateur (lignes exclues, codes de non-réponse confirmés).
 * Aucune IA, aucune valeur codée en dur. Une valeur manquante n'est jamais remplacée par zéro.
 *
 * Seules les variables dont le type est certain ou confirmé (analysisReady) sont analysées.
 * Identifiants, textes libres, dates et types à confirmer sont signalés, jamais mesurés.
 */

export const DESCRIPTIVE_ENGINE_VERSION = "1.0.0";

/** Conventions et formules affichées à l'utilisateur. */
export const FORMULAS = {
  valid: "n = nombre de valeurs renseignées (hors manquantes, hors lignes exclues).",
  missing: "Manquantes = cellules absentes, vides, blanches, ou codes de non-réponse que vous avez confirmés.",
  percent: "Pourcentage = effectif de la modalité ÷ n (réponses valides) × 100. Les manquantes sont comptées à part.",
  cumulative: "Pourcentage cumulé = somme des pourcentages des modalités jusqu'à celle-ci, dans l'ordre de l'échelle.",
  mode: "Mode = modalité(s) de plus grand effectif ; en cas d'égalité, toutes sont indiquées.",
  sum: "Somme = x₁ + x₂ + … + xₙ.",
  mean: "Moyenne = somme ÷ n.",
  median: "Médiane = valeur centrale des valeurs triées ; si n est pair, moyenne des deux valeurs centrales.",
  varianceSample: "Variance (échantillon) s² = Σ(xᵢ − moyenne)² ÷ (n − 1) — convention de VAR.S (Excel) et var() (R). Non définie si n < 2.",
  variancePopulation: "Variance (population) σ² = Σ(xᵢ − moyenne)² ÷ n — convention de VAR.P (Excel).",
  sd: "Écart-type = racine carrée de la variance (même convention).",
  quartiles: "Quartiles Q1, Q3 par interpolation linéaire (méthode 7 : QUARTILE.INC d'Excel, quantile() par défaut de R). Calculés à partir de 4 valeurs.",
  iqr: "Écart interquartile = Q3 − Q1.",
  ordinalMedian: "Médiane ordinale = première modalité dont le pourcentage cumulé atteint 50 % ; si le cumul vaut exactement 50 % sur une modalité, la médiane se situe entre celle-ci et la suivante.",
  ordinalMean:
    "Moyenne des codes (convention d'intervalles égaux) : traite les codes 1, 2, 3… comme des quantités équidistantes. Pratique courante pour les échelles de Likert, mais discutable pour un item isolé : à interpréter avec prudence, la médiane reste la mesure de référence.",
  histogram: "Histogramme : k = ⌈log₂ n⌉ + 1 classes de même largeur (règle de Sturges), bornes [a ; b[ sauf la dernière [a ; b].",
} as const;

export interface FrequencyRow {
  value: string;
  /** Code numérique de la modalité, si l'échelle est codée. */
  code?: number;
  count: number;
  /** count ÷ n valides (0 à 1). */
  proportion: number;
  percent: number;
  cumulativePercent?: number;
}

interface BaseResult {
  column: number;
  technicalName: string;
  header: string;
  statisticalType: StatisticalType;
  /** Lignes prises en compte (après exclusions). */
  rows: number;
  valid: number;
  missing: number;
  missingPercent: number;
  /** Valeurs renseignées mais incompatibles avec le type (ex. texte dans une variable quantitative) : exclues des calculs. */
  invalid: number;
  invalidExamples: string[];
}

export interface CategoricalResult extends BaseResult {
  kind: "categorical";
  categories: number;
  frequencies: FrequencyRow[];
  modes: string[];
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

export interface QuantitativeResult extends BaseResult {
  kind: "quantitative";
  sum: number | null;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  varianceSample: number | null;
  sdSample: number | null;
  variancePopulation: number | null;
  sdPopulation: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  histogram: HistogramBin[];
}

export interface OrdinalResult extends BaseResult {
  kind: "ordinal";
  /** Ordre des modalités connu (échelle codée, questionnaire ou libellés reconnus). */
  orderKnown: boolean;
  orderSource: "numeric_codes" | "questionnaire_scale" | "known_labels" | "unknown";
  frequencies: FrequencyRow[];
  modes: string[];
  /** Médiane ordinale (libellé de modalité), ou intervalle si le cumul tombe exactement sur 50 %. */
  median: { lower: string; upper: string } | null;
  /** Médiane des codes numériques, lorsque l'échelle est codée. */
  medianCode: number | null;
  /** Calculée uniquement si l'option a été choisie par l'utilisateur ET l'échelle est codée numériquement. */
  meanOfCodes: number | null;
  meanRequested: boolean;
  meanAvailable: boolean;
}

export type VariableDescriptive = CategoricalResult | QuantitativeResult | OrdinalResult;

export interface SkippedVariable {
  column: number;
  header: string;
  statisticalType: StatisticalType;
  reason: string;
}

export interface DescriptiveReport {
  engineVersion: string;
  datasetId: string;
  rowsTotal: number;
  rowsExcluded: number;
  excludedSourceRows: number[];
  rowsUsed: number;
  results: VariableDescriptive[];
  skipped: SkippedVariable[];
  /** Empreinte des décisions prises en compte (pour savoir si les résultats sont à jour). */
  preparationKey: string;
}

export interface DescriptiveOptions {
  /** Colonnes ordinales pour lesquelles l'utilisateur demande la moyenne des codes. */
  ordinalMeanColumns?: number[];
}

/* =========================================================
   Fonctions élémentaires (exportées pour les tests)
========================================================= */

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values: number[]): number | null {
  return values.length ? sum(values) / values.length : null;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Somme des carrés des écarts à la moyenne (calcul en deux passes, stable). */
function sumSquaredDeviations(values: number[]): number {
  const m = sum(values) / values.length;
  return values.reduce((total, value) => total + (value - m) ** 2, 0);
}

export function varianceSample(values: number[]): number | null {
  return values.length >= 2 ? sumSquaredDeviations(values) / (values.length - 1) : null;
}

export function variancePopulation(values: number[]): number | null {
  return values.length >= 1 ? sumSquaredDeviations(values) / values.length : null;
}

export function histogram(values: number[]): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ from: min, to: max, count: values.length }];
  const k = Math.ceil(Math.log2(values.length)) + 1;
  const width = (max - min) / k;
  const bins: HistogramBin[] = Array.from({ length: k }, (_, i) => ({
    from: min + i * width,
    to: i === k - 1 ? max : min + (i + 1) * width,
    count: 0,
  }));
  for (const value of values) {
    const index = Math.min(k - 1, Math.floor((value - min) / width));
    bins[index].count += 1;
  }
  return bins;
}

/* =========================================================
   Ordre des échelles ordinales
========================================================= */

const KNOWN_ORDERS: string[][] = [
  ["pas du tout d'accord", "pas d'accord", "plutôt pas d'accord", "ni d'accord ni pas d'accord", "neutre", "sans avis", "plutôt d'accord", "d'accord", "tout à fait d'accord"],
  ["jamais", "rarement", "parfois", "souvent", "très souvent", "toujours"],
  ["très faible", "faible", "moyen", "moyenne", "élevé", "élevée", "très élevé", "très élevée"],
  ["pas du tout important", "peu important", "assez important", "important", "très important"],
  ["très insatisfait", "insatisfait", "moyennement satisfait", "satisfait", "très satisfait"],
];

const normalizeLabel = (label: string) => label.trim().toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ");

/* =========================================================
   Calcul par variable
========================================================= */

interface ColumnValues {
  rows: number;
  missing: number;
  /** Libellés des valeurs renseignées (texte tel qu'importé, espaces de bord retirés). */
  labels: string[];
  /** Nombre associé à chaque valeur renseignée, ou null si non numérique. */
  numbers: Array<number | null>;
}

function collect(dataset: ImportedDataset, preparation: PreparationState, column: number): ColumnValues {
  const prepared = preparedColumn(dataset, preparation, column);
  const labels: string[] = [];
  const numbers: Array<number | null> = [];
  let missing = 0;
  prepared.values.forEach((value, i) => {
    if (prepared.missing[i]) {
      missing += 1;
      return;
    }
    const cell = interpretCell(value);
    labels.push(cell.label);
    numbers.push(cell.kind === "number" || cell.kind === "numeric_text" ? (cell.number as number) : null);
  });
  return { rows: prepared.values.length, missing, labels, numbers };
}

function base(variable: VariableMetadata, values: ColumnValues, valid: number, invalidLabels: string[]): BaseResult {
  return {
    column: variable.column,
    technicalName: variable.technicalName,
    header: displayHeader(variable.originalHeader) || variable.technicalName,
    statisticalType: variable.effectiveType,
    rows: values.rows,
    valid,
    missing: values.missing,
    missingPercent: values.rows ? (values.missing / values.rows) * 100 : 0,
    invalid: invalidLabels.length,
    invalidExamples: [...new Set(invalidLabels)].slice(0, 5),
  };
}

function frequencyRows(counts: Array<{ value: string; code?: number; count: number }>, valid: number, cumulative: boolean): FrequencyRow[] {
  let running = 0;
  return counts.map((row) => {
    const proportion = valid ? row.count / valid : 0;
    running += row.count;
    return {
      ...row,
      proportion,
      percent: proportion * 100,
      ...(cumulative ? { cumulativePercent: valid ? (running / valid) * 100 : 0 } : {}),
    };
  });
}

function modesOf(rows: Array<{ value: string; count: number }>): string[] {
  const top = Math.max(0, ...rows.map((row) => row.count));
  return top === 0 ? [] : rows.filter((row) => row.count === top).map((row) => row.value);
}

export function describeCategorical(variable: VariableMetadata, values: ColumnValues): CategoricalResult {
  const counts = new Map<string, number>();
  for (const label of values.labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  const valid = values.labels.length;
  const sorted = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "fr", { numeric: true }));
  return {
    ...base(variable, values, valid, []),
    kind: "categorical",
    categories: sorted.length,
    frequencies: frequencyRows(sorted, valid, false),
    modes: modesOf(sorted),
  };
}

export function describeQuantitative(variable: VariableMetadata, values: ColumnValues): QuantitativeResult {
  const numbers: number[] = [];
  const invalid: string[] = [];
  values.numbers.forEach((number, i) => {
    if (number === null) invalid.push(values.labels[i]);
    else numbers.push(number);
  });
  const n = numbers.length;
  const sorted = [...numbers].sort((a, b) => a - b);
  const vS = varianceSample(numbers);
  const vP = variancePopulation(numbers);
  const q1 = n >= 4 ? quantile(sorted, 0.25) : null;
  const q3 = n >= 4 ? quantile(sorted, 0.75) : null;
  return {
    ...base(variable, values, n, invalid),
    kind: "quantitative",
    sum: n ? sum(numbers) : null,
    mean: mean(numbers),
    median: median(numbers),
    min: n ? sorted[0] : null,
    max: n ? sorted[n - 1] : null,
    range: n ? sorted[n - 1] - sorted[0] : null,
    varianceSample: vS,
    sdSample: vS === null ? null : Math.sqrt(vS),
    variancePopulation: vP,
    sdPopulation: vP === null ? null : Math.sqrt(vP),
    q1,
    q3,
    iqr: q1 !== null && q3 !== null ? q3 - q1 : null,
    histogram: histogram(numbers),
  };
}

export function describeOrdinal(variable: VariableMetadata, values: ColumnValues, meanRequested: boolean): OrdinalResult {
  const valid = values.labels.length;
  const counts = new Map<string, number>();
  for (const label of values.labels) counts.set(label, (counts.get(label) ?? 0) + 1);

  // 1. Ordre des modalités : codes numériques, échelle du questionnaire, ou libellés connus.
  const allNumeric = valid > 0 && values.numbers.every((n) => n !== null && Number.isInteger(n));
  const expected = variable.mapping?.expectedValues;
  let orderSource: OrdinalResult["orderSource"] = "unknown";
  let ordered: Array<{ value: string; code?: number; count: number }> = [];

  if (allNumeric) {
    orderSource = expected?.length ? "questionnaire_scale" : "numeric_codes";
    const codes = values.numbers as number[];
    const scaleCodes = expected?.map((option) => Number(option.value)).filter(Number.isInteger) ?? [];
    const lo = Math.min(...codes, ...(scaleCodes.length ? scaleCodes : codes));
    const hi = Math.max(...codes, ...(scaleCodes.length ? scaleCodes : codes));
    const detectedScale = variable.detected.scale;
    const from = Math.min(lo, detectedScale?.min ?? lo);
    const to = Math.max(hi, detectedScale?.max ?? hi);
    const codeCount = new Map<number, number>();
    for (const code of codes) codeCount.set(code, (codeCount.get(code) ?? 0) + 1);
    // Toutes les modalités de l'échelle sont listées, y compris celles sans réponse (effectif 0).
    for (let code = from; code <= to && to - from <= 20; code += 1) {
      const label = expected?.find((option) => Number(option.value) === code)?.label;
      ordered.push({ value: label ? `${code} — ${label}` : String(code), code, count: codeCount.get(code) ?? 0 });
    }
    if (ordered.length === 0) ordered = [...codeCount.entries()].sort((a, b) => a[0] - b[0]).map(([code, count]) => ({ value: String(code), code, count }));
  } else {
    const normalized = new Map([...counts.keys()].map((label) => [normalizeLabel(label), label]));
    const fromQuestionnaire = expected?.map((option) => option.label);
    const known = KNOWN_ORDERS.find((order) => [...normalized.keys()].every((label) => order.includes(label)));
    const order = fromQuestionnaire && [...normalized.keys()].every((label) => fromQuestionnaire.map(normalizeLabel).includes(label)) ? fromQuestionnaire : known;
    if (order) {
      orderSource = fromQuestionnaire && order === fromQuestionnaire ? "questionnaire_scale" : "known_labels";
      ordered = order
        .filter((label) => normalized.has(normalizeLabel(label)))
        .map((label) => {
          const original = normalized.get(normalizeLabel(label)) as string;
          return { value: original, count: counts.get(original) ?? 0 };
        });
    } else {
      // Ordre inconnu : modalités par effectif, médiane non calculable.
      ordered = [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "fr"));
    }
  }

  const orderKnown = orderSource !== "unknown";
  const frequencies = frequencyRows(ordered, valid, orderKnown);

  // 2. Médiane ordinale : première modalité dont le cumul atteint 50 %.
  let medianRange: OrdinalResult["median"] = null;
  if (orderKnown && valid > 0) {
    const half = valid / 2;
    let running = 0;
    for (let i = 0; i < ordered.length; i += 1) {
      running += ordered[i].count;
      if (running > half) {
        medianRange = { lower: ordered[i].value, upper: ordered[i].value };
        break;
      }
      if (running === half) {
        const next = ordered.slice(i + 1).find((row) => row.count > 0);
        medianRange = { lower: ordered[i].value, upper: next ? next.value : ordered[i].value };
        break;
      }
    }
  }

  const numericCodes = allNumeric ? (values.numbers as number[]) : [];
  const meanAvailable = allNumeric && valid > 0;
  return {
    ...base(variable, values, valid, []),
    kind: "ordinal",
    orderKnown,
    orderSource,
    frequencies,
    modes: modesOf(ordered),
    median: medianRange,
    medianCode: allNumeric ? median(numericCodes) : null,
    meanOfCodes: meanRequested && meanAvailable ? mean(numericCodes) : null,
    meanRequested,
    meanAvailable,
  };
}

/* =========================================================
   Rapport complet
========================================================= */

const SKIP_REASONS: Partial<Record<StatisticalType, string>> = {
  identifier: "Identifiant : ce n'est pas une mesure, aucune statistique n'est calculée.",
  free_text: "Texte libre : relève de l'analyse qualitative (chantier ultérieur).",
  temporal: "Date : les statistiques temporelles ne font pas partie de l'analyse descriptive actuelle.",
  to_confirm: "Type à confirmer : confirmez la classification dans l'onglet Variables.",
  unclassified: "Colonne vide ou non classée.",
};

export function computeDescriptiveStatistics(
  dataset: ImportedDataset,
  preparation: PreparationState,
  variables: VariableMetadata[],
  options: DescriptiveOptions = {},
): DescriptiveReport {
  const excluded = [...excludedRows(preparation)].sort((a, b) => a - b);
  const meanColumns = new Set(options.ordinalMeanColumns ?? []);
  const results: VariableDescriptive[] = [];
  const skipped: SkippedVariable[] = [];

  for (const variable of variables) {
    const header = variable.originalHeader.trim() || variable.technicalName;
    const reason = SKIP_REASONS[variable.effectiveType];
    if (reason) {
      skipped.push({ column: variable.column, header, statisticalType: variable.effectiveType, reason });
      continue;
    }
    if (!variable.analysisReady) {
      skipped.push({
        column: variable.column,
        header,
        statisticalType: variable.effectiveType,
        reason: "Classification non confirmée : confirmez le type dans l'onglet Variables pour inclure cette variable.",
      });
      continue;
    }
    const values = collect(dataset, preparation, variable.column);
    switch (variable.effectiveType) {
      case "nominal":
        results.push(describeCategorical(variable, values));
        break;
      case "ordinal":
        results.push(describeOrdinal(variable, values, meanColumns.has(variable.column)));
        break;
      case "quantitative_discrete":
      case "quantitative_continuous":
        results.push(describeQuantitative(variable, values));
        break;
    }
  }

  return {
    engineVersion: DESCRIPTIVE_ENGINE_VERSION,
    datasetId: dataset.importId,
    rowsTotal: dataset.rowCount,
    rowsExcluded: excluded.length,
    excludedSourceRows: excluded.map((row) => dataset.sourceRows[row]),
    rowsUsed: dataset.rowCount - excluded.length,
    results,
    skipped,
    preparationKey: preparationKey(preparation, options),
  };
}

export function preparationKey(preparation: PreparationState, options: DescriptiveOptions = {}): string {
  return `${preparation.datasetId}|${preparation.operations.map((op) => op.id).join(",")}|${[...(options.ordinalMeanColumns ?? [])].sort((a, b) => a - b).join(",")}`;
}
