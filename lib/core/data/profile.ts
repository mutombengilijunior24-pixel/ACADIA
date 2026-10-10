import { interpretCell, isBlankKind } from "./cells";
import { excludedRows, isMissingValue, missingCodesByColumn } from "./preparation";
import type {
  CategoryCount,
  CellInterpretation,
  CellKind,
  ColumnProfile,
  DatasetProfile,
  DuplicateGroup,
  ImportedDataset,
  NumericSummary,
  OutlierSummary,
  PreparationState,
  RawValue,
  StorageType,
} from "./types";

/**
 * Profilage déterministe d'un jeu de données importé.
 *
 * Formules (documentées et testées) :
 * - cellule manquante : absente, vide, blanche, ou code de non-réponse confirmé pour la colonne ;
 * - taux de valeurs manquantes d'une colonne = manquantes / lignes retenues ;
 * - taux de cellules manquantes du jeu = cellules manquantes / (lignes retenues × colonnes) ;
 * - ligne entièrement vide : toutes ses cellules absentes, vides ou blanches ;
 * - doublon exact : ligne identique (valeur ET type de chaque cellule) à une ligne précédente,
 *   lignes vides exclues ; rien n'est supprimé ;
 * - médiane : valeur centrale (moyenne des deux valeurs centrales si l'effectif est pair) ;
 * - valeurs atypiques : règle de Tukey (au-delà de Q1 − 1,5·IQR ou Q3 + 1,5·IQR, quartiles par
 *   interpolation linéaire), calculée seulement à partir de 8 valeurs ; signalées, jamais retirées ;
 * - anomalies = valeurs invalides + valeurs atypiques + doublons exacts + lignes vides
 *   + colonnes de type ambigu.
 */

const MISSING_TEXT_CODES = new Set(["na", "n/a", "n.a.", "null", "nan", "none", "-", "--", ".", "?", "nsp", "ne sait pas", "sans réponse", "sans reponse", "sr", "nr", "nc"]);
const NUMERIC_SENTINELS = new Set([99, 999, 9999, -99, -999, -9, -1, 98, 88, 888, 998]);
const BOOLEAN_TEXT = new Set(["true", "false", "vrai", "faux"]);
const EXAMPLE_LENGTH = 60;

function emptyKindCounts(): Record<CellKind, number> {
  return { missing: 0, empty_string: 0, whitespace: 0, numeric_text: 0, number: 0, date: 0, boolean: 0, text: 0, invalid: 0 };
}

export function median(sorted: number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Quantile par interpolation linéaire (méthode « type 7 », celle de R et d'Excel QUARTILE.INC). */
export function quantile(sorted: number[], p: number): number {
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function numericSummary(values: number[]): NumericSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  return { count: values.length, min: sorted[0], max: sorted[sorted.length - 1], mean: sum / values.length, median: median(sorted) };
}

function outliers(values: number[]): OutlierSummary | undefined {
  if (values.length < 8) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const flagged = values.filter((value) => value < lowerFence || value > upperFence);
  return { method: "IQR_1_5", lowerFence, upperFence, count: flagged.length, examples: [...new Set(flagged)].slice(0, 5) };
}

function cellKey(value: RawValue): string {
  if (value === null) return "∅";
  if (typeof value === "object") return `d:${value.iso}`;
  return `${typeof value}:${String(value)}`;
}

export function profileDataset(dataset: ImportedDataset, preparation?: PreparationState): DatasetProfile {
  const excluded = preparation ? excludedRows(preparation) : new Set<number>();
  const codesByColumn = preparation ? missingCodesByColumn(preparation) : new Map<number, Set<string>>();
  const rowIndexes = dataset.rows.map((_, index) => index).filter((index) => !excluded.has(index));
  const rowCount = rowIndexes.length;
  const columnCount = dataset.columnCount;

  const rowMissing = new Array<number>(dataset.rows.length).fill(0);
  const rowBlank = new Array<number>(dataset.rows.length).fill(0);

  const columns: ColumnProfile[] = dataset.columns.map((column) => {
    const codes = codesByColumn.get(column.index);
    const kindCounts = emptyKindCounts();
    const presentInterpretations: CellInterpretation[] = [];
    let missing = 0;

    for (const rowIndex of rowIndexes) {
      const value = dataset.rows[rowIndex][column.index];
      const interpretation = interpretCell(value);
      kindCounts[interpretation.kind] += 1;
      if (isBlankKind(interpretation.kind)) rowBlank[rowIndex] += 1;
      if (isMissingValue(value, codes)) {
        missing += 1;
        rowMissing[rowIndex] += 1;
      } else {
        presentInterpretations.push(interpretation);
      }
    }

    const present = presentInterpretations.length;
    const warnings: string[] = [];
    const labels = presentInterpretations.map((cell) => cell.label);
    const distinctLabels = new Map<string, number>();
    for (const label of labels) distinctLabels.set(label, (distinctLabels.get(label) ?? 0) + 1);

    const numericCells = presentInterpretations.filter((cell) => cell.kind === "number" || cell.kind === "numeric_text");
    const dateCells = presentInterpretations.filter((cell) => cell.kind === "date");
    const booleanCells = presentInterpretations.filter(
      (cell) => cell.kind === "boolean" || (cell.kind === "text" && BOOLEAN_TEXT.has(cell.label.toLowerCase())),
    );
    const invalidCount = presentInterpretations.filter((cell) => cell.kind === "invalid").length;

    let storageType: StorageType;
    if (present === 0) storageType = "unknown";
    else if (numericCells.length === present) {
      storageType = numericCells.every((cell) => Number.isInteger(cell.number)) ? "integer" : "decimal";
    } else if (dateCells.length === present) storageType = "date";
    else if (booleanCells.length === present) storageType = "boolean";
    else if (numericCells.length / present >= 0.8 || dateCells.length / present >= 0.8) storageType = "ambiguous";
    else storageType = "string";

    if (present === 0) warnings.push("Colonne entièrement vide.");
    else if (missing / Math.max(1, rowCount) >= 0.5) warnings.push(`${Math.round((missing / rowCount) * 100)} % de valeurs manquantes.`);
    if (storageType === "ambiguous") {
      const odd = presentInterpretations
        .filter((cell) => (numericCells.length >= dateCells.length ? cell.kind !== "number" && cell.kind !== "numeric_text" : cell.kind !== "date"))
        .map((cell) => cell.label);
      warnings.push(
        `Type ambigu : ${present - odd.length} valeur(s) ${numericCells.length >= dateCells.length ? "numériques" : "de date"} et ${odd.length} autre(s) (ex. ${[...new Set(odd)]
          .slice(0, 3)
          .map((v) => `« ${v.slice(0, 30)} »`)
          .join(", ")}). La colonne n'est pas convertie.`,
      );
    }
    if (invalidCount > 0) warnings.push(`${invalidCount} valeur(s) invalide(s) (ex. date impossible).`);
    if (present > 0 && distinctLabels.size === 1 && rowCount > 1) warnings.push("Valeur constante : une seule modalité observée.");
    if (numericCells.some((cell) => cell.leadingZero)) warnings.push("Nombres écrits avec des zéros en tête : probablement des codes, pas des quantités.");
    if (column.headerFlags.includes("duplicate")) warnings.push("En-tête en double dans le fichier.");

    const profile: ColumnProfile = {
      index: column.index,
      originalHeader: column.originalHeader,
      technicalName: column.technicalName,
      storageType,
      kindCounts,
      present,
      missing,
      missingRate: rowCount === 0 ? 0 : missing / rowCount,
      distinct: distinctLabels.size,
      examples: [...distinctLabels.keys()].slice(0, 5).map((label) => (label.length > EXAMPLE_LENGTH ? `${label.slice(0, EXAMPLE_LENGTH)}…` : label)),
      missingCodeCandidates: [],
      appliedMissingCodes: codes ? [...codes] : [],
      warnings,
    };

    if (storageType === "integer" || storageType === "decimal") {
      const numbers = numericCells.map((cell) => cell.number as number);
      profile.numeric = numericSummary(numbers);
      profile.outliers = outliers(numbers);
      if (profile.outliers?.count) {
        warnings.push(`${profile.outliers.count} valeur(s) atypique(s) selon la règle de Tukey (à examiner, non retirées).`);
      }
    }

    if (storageType === "string" || storageType === "boolean" || storageType === "ambiguous" || (storageType === "integer" && distinctLabels.size <= 20)) {
      const sorted = [...distinctLabels.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
      const top: CategoryCount[] = sorted.slice(0, 10).map(([value, count]) => ({ value, count, frequency: count / present }));
      profile.categories = { top, otherCount: sorted.slice(10).reduce((total, [, count]) => total + count, 0), distinct: sorted.length };
    }

    if (dateCells.length > 0 && dateCells.length / Math.max(1, present) >= 0.5) {
      // JJ/MM/AAAA : une valeur dont le 1er nombre dépasse 12 prouve « jour d'abord » ; dont le 2e
      // nombre dépasse 12 prouve « mois d'abord » (les dates ambiguës, lues jour d'abord, seraient alors fausses).
      const dmyParts = dateCells
        .map((cell) => /^(\d{1,2})[/.-](\d{1,2})[/.-]\d{4}$/.exec(cell.label))
        .filter((match): match is RegExpExecArray => match !== null)
        .map((match) => [Number(match[1]), Number(match[2])]);
      const dayFirstProven = dmyParts.some(([first]) => first > 12);
      const monthFirstProven = dmyParts.some(([, second]) => second > 12);
      const hasAmbiguous = dateCells.some((cell) => cell.ambiguousDate);
      const ambiguousFormat = (dayFirstProven && monthFirstProven) || (hasAmbiguous && !dayFirstProven);
      const isoValues = dateCells.map((cell) => cell.dateIso as string).sort();
      profile.dates = {
        recognized: dateCells.length,
        recognizedRate: dateCells.length / present,
        ambiguousFormat,
        ...(storageType === "date" && !ambiguousFormat ? { min: isoValues[0], max: isoValues[isoValues.length - 1] } : {}),
      };
      if (ambiguousFormat) warnings.push("Format de date ambigu (JJ/MM ou MM/JJ) : dates lues jour d'abord, à confirmer.");
    }

    // Codes de non-réponse candidats : suggérés, jamais appliqués sans confirmation.
    const candidates: Array<{ value: string; count: number }> = [];
    const otherNumbers = numericCells.filter((cell) => !NUMERIC_SENTINELS.has(cell.number as number)).map((cell) => cell.number as number);
    const [lo, hi] = otherNumbers.length ? [Math.min(...otherNumbers), Math.max(...otherNumbers)] : [NaN, NaN];
    for (const [label, count] of distinctLabels) {
      const interpretation = presentInterpretations.find((cell) => cell.label === label) as CellInterpretation;
      if (interpretation.kind === "text" && MISSING_TEXT_CODES.has(label.toLowerCase())) candidates.push({ value: label, count });
      else if (
        (interpretation.kind === "number" || interpretation.kind === "numeric_text") &&
        NUMERIC_SENTINELS.has(interpretation.number as number) &&
        otherNumbers.length > 0 &&
        ((interpretation.number as number) < lo || (interpretation.number as number) > hi)
      ) {
        candidates.push({ value: label, count });
      }
    }
    profile.missingCodeCandidates = candidates;
    if (candidates.length) {
      warnings.push(`Code(s) possible(s) de non-réponse : ${candidates.map((c) => `« ${c.value} » (${c.count})`).join(", ")}. À confirmer avant de les traiter comme manquants.`);
    }

    return profile;
  });

  // Niveau jeu de données.
  let missingCells = 0;
  let rowsWithMissing = 0;
  const emptyRowIndexes: number[] = [];
  for (const rowIndex of rowIndexes) {
    missingCells += rowMissing[rowIndex];
    if (rowMissing[rowIndex] > 0) rowsWithMissing += 1;
    if (columnCount > 0 && rowBlank[rowIndex] === columnCount) emptyRowIndexes.push(rowIndex);
  }

  const emptySet = new Set(emptyRowIndexes);
  const seen = new Map<string, DuplicateGroup>();
  let exactDuplicateRows = 0;
  for (const rowIndex of rowIndexes) {
    if (emptySet.has(rowIndex)) continue;
    const key = dataset.rows[rowIndex].map(cellKey).join("\u0001");
    const group = seen.get(key);
    if (group) {
      group.duplicateRows.push(rowIndex);
      exactDuplicateRows += 1;
    } else {
      seen.set(key, { firstRow: rowIndex, duplicateRows: [] });
    }
  }
  const duplicateGroups = [...seen.values()].filter((group) => group.duplicateRows.length > 0);

  const totalCells = rowCount * columnCount;
  const ambiguousColumns = columns.filter((column) => column.storageType === "ambiguous").length;
  const invalidValues = columns.reduce((total, column) => total + column.kindCounts.invalid, 0);
  const outlierValues = columns.reduce((total, column) => total + (column.outliers?.count ?? 0), 0);
  const anomalyCount = invalidValues + outlierValues + exactDuplicateRows + emptyRowIndexes.length + ambiguousColumns;

  const readinessReasons: string[] = [];
  let readiness: DatasetProfile["readiness"] = "ready";
  if (rowCount === 0) {
    readiness = "not_ready";
    readinessReasons.push("Aucune observation à analyser.");
  } else if (columns.every((column) => column.present === 0)) {
    readiness = "not_ready";
    readinessReasons.push("Toutes les colonnes sont vides.");
  } else {
    if (ambiguousColumns) readinessReasons.push(`${ambiguousColumns} colonne(s) de type ambigu.`);
    if (exactDuplicateRows) readinessReasons.push(`${exactDuplicateRows} ligne(s) identique(s) à une ligne précédente (à vérifier, non supprimées).`);
    if (emptyRowIndexes.length) readinessReasons.push(`${emptyRowIndexes.length} ligne(s) entièrement vide(s).`);
    if (invalidValues) readinessReasons.push(`${invalidValues} valeur(s) invalide(s).`);
    if (columns.some((column) => column.missingCodeCandidates.length)) readinessReasons.push("Codes de non-réponse possibles à confirmer.");
    if (readinessReasons.length) readiness = "ready_with_warnings";
  }

  return {
    rowCount,
    columnCount,
    totalCells,
    missingCells,
    missingCellRate: totalCells === 0 ? 0 : missingCells / totalCells,
    rowsWithMissing,
    emptyRows: emptyRowIndexes.length,
    emptyRowIndexes,
    exactDuplicateRows,
    duplicateGroups,
    excludedRows: dataset.rows.length - rowCount,
    ambiguousColumns,
    anomalyCount,
    readiness,
    readinessReasons,
    columns,
  };
}

