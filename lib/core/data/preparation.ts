import { interpretCell, isBlankKind } from "./cells";
import type {
  ColumnMapping,
  DataStructureFamily,
  ImportedDataset,
  PreparationOperation,
  PreparationState,
  RawValue,
  StatisticalType,
  VariableRoleInStudy,
} from "./types";

/**
 * Journal de préparation : chaque décision de l'utilisateur est une opération horodatée.
 * Les observations importées ne sont jamais modifiées ; les opérations sont appliquées à la
 * lecture. Annuler une opération la retire du journal : l'état antérieur est retrouvé exactement.
 */

type OperationInput = PreparationOperation extends infer T ? (T extends PreparationOperation ? Omit<T, "id" | "at"> : never) : never;

function operationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPreparation(dataset: ImportedDataset): PreparationState {
  return { datasetId: dataset.importId, operations: [] };
}

export function addOperation(state: PreparationState, input: OperationInput, at: Date = new Date()): PreparationState {
  const operation = { ...input, id: operationId(), at: at.toISOString() } as PreparationOperation;
  return { ...state, operations: [...state.operations, operation] };
}

export function undoOperation(state: PreparationState, operationId: string): PreparationState {
  return { ...state, operations: state.operations.filter((operation) => operation.id !== operationId) };
}

/** Codes de valeur manquante en vigueur par colonne (la dernière déclaration d'une colonne fait foi). */
export function missingCodesByColumn(state: PreparationState): Map<number, Set<string>> {
  const result = new Map<number, Set<string>>();
  for (const operation of state.operations) {
    if (operation.type === "declare_missing_codes") result.set(operation.column, new Set(operation.values.map((v) => v.trim())));
  }
  return result;
}

export function excludedRows(state: PreparationState): Set<number> {
  const result = new Set<number>();
  for (const operation of state.operations) {
    if (operation.type === "exclude_rows") for (const row of operation.rows) result.add(row);
  }
  return result;
}

function lastByColumn<T>(state: PreparationState, pick: (operation: PreparationOperation) => { column: number; value: T; id: string; at: string } | null) {
  const result = new Map<number, { value: T; id: string; at: string }>();
  for (const operation of state.operations) {
    const picked = pick(operation);
    if (picked) result.set(picked.column, { value: picked.value, id: picked.id, at: picked.at });
  }
  return result;
}

export function confirmedTypes(state: PreparationState) {
  return lastByColumn<StatisticalType>(state, (op) =>
    op.type === "set_statistical_type" ? { column: op.column, value: op.statisticalType, id: op.id, at: op.at } : null,
  );
}

export function userRoles(state: PreparationState) {
  return lastByColumn<VariableRoleInStudy | null>(state, (op) => (op.type === "set_role" ? { column: op.column, value: op.role, id: op.id, at: op.at } : null));
}

export function userMappings(state: PreparationState) {
  return lastByColumn<ColumnMapping | null>(state, (op) => (op.type === "set_mapping" ? { column: op.column, value: op.mapping, id: op.id, at: op.at } : null));
}

export function confirmedStructure(state: PreparationState): DataStructureFamily | undefined {
  let family: DataStructureFamily | null | undefined;
  for (const operation of state.operations) if (operation.type === "confirm_structure") family = operation.family;
  return family ?? undefined;
}

/**
 * Politique des valeurs manquantes (documentée) : une cellule est manquante si elle est
 * absente, vide ou blanche, ou si son libellé correspond à un code de non-réponse confirmé
 * par l'utilisateur pour cette colonne. Aucun code n'est appliqué sans confirmation.
 */
export function isMissingValue(value: RawValue, codes?: Set<string>): boolean {
  const interpretation = interpretCell(value);
  if (isBlankKind(interpretation.kind)) return true;
  return !!codes && codes.has(interpretation.label);
}

export interface PreparedColumn {
  column: number;
  technicalName: string;
  values: RawValue[];
  missing: boolean[];
  sourceRows: number[];
}

/**
 * Vue préparée destinée aux futurs moteurs d'analyse : lignes exclues retirées, codes de
 * valeurs manquantes appliqués. Les valeurs restent les valeurs brutes d'origine.
 */
export function preparedColumn(dataset: ImportedDataset, state: PreparationState, column: number): PreparedColumn {
  const excluded = excludedRows(state);
  const codes = missingCodesByColumn(state).get(column);
  const values: RawValue[] = [];
  const missing: boolean[] = [];
  const sourceRows: number[] = [];
  dataset.rows.forEach((row, index) => {
    if (excluded.has(index)) return;
    values.push(row[column]);
    missing.push(isMissingValue(row[column], codes));
    sourceRows.push(dataset.sourceRows[index]);
  });
  return { column, technicalName: dataset.columns[column].technicalName, values, missing, sourceRows };
}

const STATISTICAL_TYPE_LABELS: Record<StatisticalType, string> = {
  nominal: "qualitative nominale",
  ordinal: "qualitative ordinale",
  quantitative_discrete: "quantitative discrète",
  quantitative_continuous: "quantitative continue",
  temporal: "date / temporelle",
  identifier: "identifiant",
  free_text: "texte libre",
  to_confirm: "catégorie à confirmer",
  unclassified: "non classée",
};

export function statisticalTypeLabel(type: StatisticalType): string {
  return STATISTICAL_TYPE_LABELS[type];
}

/** Description lisible d'une opération, pour le journal affiché à l'utilisateur. */
export function describeOperation(operation: PreparationOperation, dataset: ImportedDataset): string {
  const columnName = (index: number) => dataset.columns[index]?.originalHeader.trim() || dataset.columns[index]?.technicalName || `colonne ${index + 1}`;
  switch (operation.type) {
    case "declare_missing_codes":
      return operation.values.length
        ? `« ${columnName(operation.column)} » : ${operation.values.map((v) => `« ${v} »`).join(", ")} traité(s) comme valeur manquante`
        : `« ${columnName(operation.column)} » : aucun code de valeur manquante`;
    case "exclude_rows":
      return `${operation.rows.length} ligne(s) exclue(s) de l'analyse (lignes ${operation.rows
        .slice(0, 5)
        .map((row) => dataset.sourceRows[row])
        .join(", ")}${operation.rows.length > 5 ? "…" : ""}) — ${operation.reason}`;
    case "set_statistical_type":
      return `« ${columnName(operation.column)} » : type confirmé « ${statisticalTypeLabel(operation.statisticalType)} »`;
    case "set_role":
      return `« ${columnName(operation.column)} » : rôle ${operation.role ? `« ${operation.role} »` : "retiré"}`;
    case "set_mapping":
      return operation.mapping
        ? `« ${columnName(operation.column)} » associée à ${operation.mapping.questionNumber ? `la question ${operation.mapping.questionNumber}` : ""}${operation.mapping.variable ? ` (variable « ${operation.mapping.variable} »)` : ""}`
        : `« ${columnName(operation.column)} » : correspondance retirée`;
    case "confirm_structure":
      return operation.family ? `Structure des données confirmée : ${operation.family}` : "Structure des données à nouveau à déterminer";
  }
}
