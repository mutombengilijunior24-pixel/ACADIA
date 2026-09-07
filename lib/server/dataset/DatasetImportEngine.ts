// ============================================================
// ACADIA — MOTEUR D'IMPORT DE DATASET (Module 2, incrément 1)
//
// Transforme des lignes CSV brutes (déjà parsées) en la structure
// Dataset/DatasetColumn/DatasetRow déjà existante et déjà
// consommée par tout le pipeline d'analyse (DatasetTable,
// DatasetDictionary, DatasetQuality, DescriptiveAnalysisEngine...)
// — voir lib/core/dataset/DatasetTypes.ts et DatasetEngine.ts,
// jamais modifiés par ce fichier.
//
// AUCUN calcul statistique ici (moyenne, corrélation, test) —
// uniquement détection déterministe de structure (type apparent,
// niveau de mesure proposé, valeurs manquantes, doublons de
// lignes). Toute détection reste une PROPOSITION éditable via
// l'interface Dataset existante, jamais une vérité imposée.
//
// Aucune donnée originale n'est perdue : la valeur brute de
// chaque cellule reste conservée dans DatasetRow.values (After
// conversion de type quand fiable), et le libellé original de
// chaque colonne (DatasetColumn.label) n'est jamais remplacé par
// le nom normalisé (DatasetColumn.name).
// ============================================================

import { randomUUID } from "node:crypto";
import type {
  Dataset,
  DatasetColumn,
  DatasetColumnDataType,
  DatasetQualityItem,
  DatasetRow,
  MeasurementLevel,
} from "@/lib/core/dataset/DatasetTypes";

const MISSING_TOKENS = new Set([
  "",
  "null",
  "n/a",
  "na",
  "nan",
  "sans réponse",
  "sans reponse",
  "non renseigné",
  "non renseigne",
  "#n/a",
]);

const MULTI_SELECT_DELIMITER = ";";

function isMissingToken(raw: string): boolean {
  return MISSING_TOKENS.has(raw.trim().toLowerCase());
}

function normalizeHeader(raw: string): string {
  const ascii = raw.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "colonne";
}

function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}_${n}`)) n++;
  const name = `${base}_${n}`;
  used.add(name);
  return name;
}

interface ColumnDetection {
  dataType: DatasetColumnDataType;
  measurementLevel: MeasurementLevel;
  options?: { value: string; label: string }[];
}

/**
 * Détection déterministe, jamais une certitude scientifique — une
 * petite échelle numérique fermée (ex. 1 à 5) est proposée comme
 * ORDINAL plutôt qu'INTERVAL par précaution (voir mission B29 :
 * une échelle de Likert stockée en entiers ne doit pas être
 * silencieusement traitée comme une variable quantitative
 * continue) ; l'utilisateur reste libre de corriger.
 */
function detectColumn(rawValues: string[]): ColumnDetection {
  const nonMissing = rawValues.filter((v) => !isMissingToken(v));
  if (nonMissing.length === 0) return { dataType: "text", measurementLevel: "nominal" };

  if (nonMissing.some((v) => v.includes(MULTI_SELECT_DELIMITER))) {
    return { dataType: "multiple_choice", measurementLevel: "nominal" };
  }

  const distinct = new Set(nonMissing.map((v) => v.trim().toLowerCase()));

  const boolTokens = new Set(["oui", "non", "yes", "no", "true", "false", "vrai", "faux", "1", "0"]);
  if (distinct.size <= 2 && [...distinct].every((v) => boolTokens.has(v))) {
    return { dataType: "boolean", measurementLevel: "nominal" };
  }

  const dateLike = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$|^\d{2}\/\d{2}\/\d{4}/;
  if (nonMissing.every((v) => dateLike.test(v.trim()))) {
    return { dataType: "date", measurementLevel: "interval" };
  }

  const numericPattern = /^-?\d+([.,]\d+)?$/;
  if (nonMissing.every((v) => numericPattern.test(v.trim()))) {
    const isInteger = nonMissing.every((v) => /^-?\d+$/.test(v.trim()));
    const numbers = nonMissing.map((v) => parseFloat(v.trim().replace(",", ".")));
    const range = Math.max(...numbers) - Math.min(...numbers);
    if (isInteger && distinct.size <= 10 && range <= 10) {
      return { dataType: "integer", measurementLevel: "ordinal" };
    }
    return { dataType: isInteger ? "integer" : "decimal", measurementLevel: "interval" };
  }

  if (distinct.size > 0 && distinct.size <= 12 && distinct.size < nonMissing.length * 0.5) {
    const options = [...distinct].map((v) => ({ value: v, label: v }));
    return { dataType: "single_choice", measurementLevel: "nominal", options };
  }

  return { dataType: "text", measurementLevel: "nominal" };
}

export interface DatasetImportResult {
  dataset: Dataset;
  quality: DatasetQualityItem[];
  rowCount: number;
  columnCount: number;
}

export function buildDatasetFromRows(
  fileName: string,
  projectId: string,
  headerRow: string[],
  dataRows: string[][]
): DatasetImportResult {
  const used = new Set<string>();
  const columns: DatasetColumn[] = headerRow.map((rawHeader, colIndex) => {
    const values = dataRows.map((r) => r[colIndex] ?? "");
    const detection = detectColumn(values);
    return {
      id: randomUUID(),
      name: uniqueName(normalizeHeader(rawHeader || `colonne_${colIndex + 1}`), used),
      label: rawHeader.trim() || `Colonne ${colIndex + 1}`,
      dataType: detection.dataType,
      measurementLevel: detection.measurementLevel,
      required: false,
      options: detection.options,
    };
  });

  const rowHashes = new Map<string, string[]>();
  const rows: DatasetRow[] = dataRows.map((rawRow) => {
    const values: DatasetRow["values"] = {};
    columns.forEach((col, i) => {
      const raw = (rawRow[i] ?? "").trim();
      if (isMissingToken(raw)) {
        values[col.id] = null;
        return;
      }
      if (col.dataType === "multiple_choice") {
        values[col.id] = raw
          .split(MULTI_SELECT_DELIMITER)
          .map((v) => v.trim())
          .filter(Boolean);
        return;
      }
      if (col.dataType === "integer") {
        const n = parseInt(raw, 10);
        values[col.id] = Number.isFinite(n) ? n : raw;
        return;
      }
      if (col.dataType === "decimal") {
        const n = parseFloat(raw.replace(",", "."));
        values[col.id] = Number.isFinite(n) ? n : raw;
        return;
      }
      if (col.dataType === "boolean") {
        values[col.id] = ["oui", "yes", "true", "vrai", "1"].includes(raw.toLowerCase());
        return;
      }
      if (col.dataType === "single_choice") {
        // La valeur stockée doit correspondre exactement à col.options[].value
        // (lui-même construit en minuscules dans detectColumn ci-dessus) —
        // sinon deux graphies de la même modalité ("Jamais"/"jamais") sont
        // comptées comme deux catégories distinctes par les moteurs d'analyse
        // en aval. Normalisation légitime ici : une modalité à choix unique
        // est par nature une catégorie fermée, pas un texte libre.
        values[col.id] = raw.toLowerCase();
        return;
      }
      values[col.id] = raw;
    });

    const id = randomUUID();
    const hashKey = JSON.stringify(columns.map((c) => values[c.id] ?? null));
    const bucket = rowHashes.get(hashKey) ?? [];
    bucket.push(id);
    rowHashes.set(hashKey, bucket);

    return { id, submittedAt: new Date().toISOString(), values };
  });

  const quality: DatasetQualityItem[] = [];

  const totalCells = rows.length * columns.length;
  const missingCells = rows.reduce((acc, row) => acc + columns.filter((c) => row.values[c.id] === null).length, 0);
  if (totalCells > 0) {
    const rate = (missingCells / totalCells) * 100;
    quality.push({
      id: "missing-values",
      label:
        missingCells === 0
          ? "Aucune valeur manquante détectée"
          : `${missingCells} valeur(s) manquante(s) détectée(s) (${rate.toFixed(1)} %)`,
      severity: missingCells === 0 ? "pass" : rate > 10 ? "warning" : "pass",
      detail:
        missingCells > 0
          ? 'Cellules vides, "N/A", "NULL" ou équivalents — conservées telles quelles, jamais supprimées automatiquement.'
          : undefined,
    });
  }

  const duplicateGroups = [...rowHashes.values()].filter((ids) => ids.length > 1);
  const duplicateRowCount = duplicateGroups.reduce((acc, g) => acc + g.length, 0);
  quality.push({
    id: "duplicate-rows",
    label:
      duplicateRowCount > 0
        ? `${duplicateRowCount} ligne(s) semblent être des doublons exacts`
        : "Aucun doublon exact détecté",
    severity: duplicateRowCount > 0 ? "needs_review" : "pass",
    detail:
      duplicateRowCount > 0
        ? "Lignes strictement identiques sur toutes les colonnes — à examiner, jamais supprimées automatiquement."
        : undefined,
  });

  quality.push({
    id: "row-count",
    label: `${rows.length} ligne(s) importée(s), ${columns.length} colonne(s) détectée(s)`,
    severity: rows.length === 0 ? "error" : "pass",
  });

  const dataset: Dataset = {
    id: randomUUID(),
    projectId,
    instrumentId: "file-import",
    name: `Import — ${fileName}`,
    status: "draft",
    columns,
    rows,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { dataset, quality, rowCount: rows.length, columnCount: columns.length };
}
