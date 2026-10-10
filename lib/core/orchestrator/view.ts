/**
 * Vue du jeu de données pour le classificateur, construite à partir des objets existants
 * (import, préparation, métadonnées des variables, structure du fichier). Aucune donnée n'est modifiée.
 */
import { interpretCell } from "@/lib/core/data/cells";
import { preparedColumn } from "@/lib/core/data/preparation";
import type { ImportedDataset, PreparationState, VariableMetadata } from "@/lib/core/data/types";
import type { FileStructure } from "@/lib/core/journey/structure";
import { hashKey } from "@/lib/core/understanding/text";

import type { DatasetView } from "./classification";

export function datasetView(dataset: ImportedDataset, preparation: PreparationState, variables: VariableMetadata[], structure: FileStructure | null): DatasetView {
  return {
    datasetId: dataset.importId,
    fileName: dataset.fileName,
    format: dataset.format,
    rowCount: dataset.rowCount,
    columns: variables.map((v) => {
      const prepared = preparedColumn(dataset, preparation, v.column);
      const values = prepared.values
        .map((raw) => interpretCell(raw))
        .filter((cell) => cell.kind !== "missing" && cell.kind !== "empty_string" && cell.kind !== "whitespace")
        .map((cell) => ("label" in cell ? String(cell.label) : ""))
        .filter(Boolean);
      return {
        id: `col:${v.column}`,
        column: v.column,
        header: v.originalHeader,
        values,
        statisticalType: v.effectiveType,
        confirmedByUser: v.typeSource === "user",
        structureKind: structure?.columns.find((c) => c.column === v.column)?.kind ?? null,
      };
    }),
  };
}

/** Version du jeu de données en mémoire : change dès qu'une décision de préparation change. */
export const datasetVersion = (preparation: PreparationState) => hashKey([preparation.datasetId, preparation.operations.map((op) => [op.id, op.type])]);
