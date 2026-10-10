/**
 * Extraction des observations d'un couple de variables, à partir des données préparées :
 * lignes exclues retirées, codes de non-réponse confirmés appliqués (preparedColumn),
 * puis suppression par paire (seules les lignes renseignées et valides pour les DEUX variables).
 * Aucune valeur manquante n'est remplacée ; aucune conversion silencieuse de texte en nombre.
 */
import { interpretCell } from "@/lib/core/data/cells";
import { displayHeader } from "@/lib/core/data/headers";
import { excludedRows, preparedColumn } from "@/lib/core/data/preparation";
import type { ImportedDataset, PreparationState, VariableMetadata } from "@/lib/core/data/types";

import { describeOrdinal } from "../descriptiveStatistics";

export type Encoding = "number" | "category" | "rank";

export interface VariableUse {
  column: number;
  header: string;
  type: VariableMetadata["effectiveType"];
  encoding: Encoding;
  /** Valeurs manquantes (vides ou codes de non-réponse confirmés) parmi les lignes non exclues. */
  missing: number;
  /** Valeurs présentes mais inutilisables pour l'encodage demandé (ex. texte dans une variable numérique). */
  invalid: number;
  invalidExamples: string[];
  /** Ordre des modalités utilisé pour les rangs (variable ordinale textuelle). */
  order?: string[];
}

export interface PairObservations {
  rowsTotal: number;
  rowsExcluded: number;
  excludedSourceRows: number[];
  rowsAfterExclusions: number;
  /** Lignes non exclues mais incomplètes ou invalides pour au moins une des deux variables. */
  rowsDropped: number;
  n: number;
  usedSourceRows: number[];
  a: VariableUse;
  b: VariableUse;
  /** Valeurs utilisées, alignées ligne à ligne. */
  valuesA: Array<number | string>;
  valuesB: Array<number | string>;
}

export const headerOf = (variable: VariableMetadata) => displayHeader(variable.originalHeader) || variable.technicalName;

/** Ordre des modalités d'une variable ordinale (même règle que le moteur descriptif), ou null s'il est inconnu. */
export function ordinalOrder(dataset: ImportedDataset, preparation: PreparationState, variable: VariableMetadata): Map<string, number> | null {
  const prepared = preparedColumn(dataset, preparation, variable.column);
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
  const described = describeOrdinal(variable, { rows: prepared.values.length, missing, labels, numbers }, false);
  if (!described.orderKnown) return null;
  const order = new Map<string, number>();
  described.frequencies.forEach((row, index) => {
    // Codes numériques : le code lui-même ; libellés : la position dans l'échelle.
    if (row.code !== undefined) order.set(String(row.code), row.code);
    else order.set(row.value, index + 1);
  });
  return order;
}

export function pairObservations(
  dataset: ImportedDataset,
  preparation: PreparationState,
  first: { variable: VariableMetadata; encoding: Encoding },
  second: { variable: VariableMetadata; encoding: Encoding },
): PairObservations {
  const excluded = [...excludedRows(preparation)].sort((x, y) => x - y);
  const columns = [first, second].map(({ variable, encoding }) => {
    const prepared = preparedColumn(dataset, preparation, variable.column);
    // L'ordre sert aux rangs, et à présenter les modalités ordinales dans leur ordre naturel.
    const order = encoding === "rank" || variable.effectiveType === "ordinal" ? ordinalOrder(dataset, preparation, variable) : null;
    const use: VariableUse = { column: variable.column, header: headerOf(variable), type: variable.effectiveType, encoding, missing: 0, invalid: 0, invalidExamples: [] };
    if (order) use.order = [...order.entries()].sort((x, y) => x[1] - y[1]).map(([label]) => label);
    const values: Array<number | string | null> = prepared.values.map((raw, i) => {
      if (prepared.missing[i]) {
        use.missing += 1;
        return null;
      }
      const cell = interpretCell(raw);
      const numeric = cell.kind === "number" || cell.kind === "numeric_text" ? (cell.number as number) : null;
      let value: number | string | null;
      if (encoding === "category") value = cell.label;
      else if (encoding === "number") value = numeric;
      // Rangs : variable quantitative → sa valeur (le test calcule les rangs) ; ordinale → code ou position dans l'échelle.
      else if (!order) value = variable.effectiveType === "ordinal" ? null : numeric;
      else value = numeric !== null && Number.isInteger(numeric) && order.has(String(numeric)) ? numeric : (order.get(cell.label) ?? null);
      if (value === null) {
        use.invalid += 1;
        if (use.invalidExamples.length < 5 && !use.invalidExamples.includes(cell.label)) use.invalidExamples.push(cell.label);
      }
      return value;
    });
    return { use, values, sourceRows: prepared.sourceRows };
  });

  const [ca, cb] = columns;
  const valuesA: Array<number | string> = [];
  const valuesB: Array<number | string> = [];
  const usedSourceRows: number[] = [];
  for (let i = 0; i < ca.values.length; i += 1) {
    const va = ca.values[i];
    const vb = cb.values[i];
    if (va === null || vb === null) continue;
    valuesA.push(va);
    valuesB.push(vb);
    usedSourceRows.push(ca.sourceRows[i]);
  }
  const rowsAfterExclusions = ca.values.length;
  return {
    rowsTotal: dataset.rowCount,
    rowsExcluded: excluded.length,
    excludedSourceRows: excluded.map((row) => dataset.sourceRows[row]),
    rowsAfterExclusions,
    rowsDropped: rowsAfterExclusions - valuesA.length,
    n: valuesA.length,
    usedSourceRows,
    a: ca.use,
    b: cb.use,
    valuesA,
    valuesB,
  };
}

/** Modalités distinctes dans l'ordre de première apparition, ou selon l'ordre ordinal s'il est fourni. */
export function categoriesOf(values: Array<number | string>, order?: string[]): string[] {
  const seen = [...new Set(values.map(String))];
  if (!order) return seen.sort((x, y) => x.localeCompare(y, "fr", { numeric: true }));
  return [...order.filter((label) => seen.includes(label)), ...seen.filter((label) => !order.includes(label))];
}
