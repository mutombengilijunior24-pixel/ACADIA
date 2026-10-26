import { addOperation, createPreparation, undoOperation } from "./preparation";
import type { ImportOptions, ImportResult, ImportedDataset, PreparationOperation, PreparationState } from "./types";

/**
 * État du parcours d'importation (réducteur pur, indépendant de React) :
 * vide → lecture → aperçu (options modifiables, remplacement possible) → données confirmées.
 * Les données restent en mémoire dans le navigateur : rien n'est envoyé ni enregistré.
 */

export interface FileMeta {
  name: string;
  size: number;
  lastModified: number;
}

export type ImportFlowState =
  | { step: "empty" }
  | { step: "reading"; file: FileMeta; options: ImportOptions }
  | { step: "preview"; file: FileMeta; options: ImportOptions; result: ImportResult }
  | { step: "prepared"; file: FileMeta; dataset: ImportedDataset; preparation: PreparationState };

type OperationInput = PreparationOperation extends infer T ? (T extends PreparationOperation ? Omit<T, "id" | "at"> : never) : never;

export type ImportFlowAction =
  | { type: "select_file"; file: FileMeta }
  | { type: "read_started"; options: ImportOptions }
  | { type: "read_finished"; result: ImportResult }
  | { type: "confirm" }
  | { type: "back_to_preview" }
  | { type: "reset" }
  | { type: "operation"; input: OperationInput }
  /** Reprise d'une interprétation enregistrée : fichier relu et décisions de préparation rejouées. */
  | { type: "restore"; file: FileMeta; dataset: ImportedDataset; preparation: PreparationState }
  | { type: "undo"; operationId: string };

export const initialImportFlow: ImportFlowState = { step: "empty" };

export function importFlowReducer(state: ImportFlowState, action: ImportFlowAction): ImportFlowState {
  switch (action.type) {
    case "select_file":
      return { step: "reading", file: action.file, options: {} };
    case "read_started":
      if (state.step === "empty" || state.step === "prepared") return state;
      return { step: "reading", file: state.file, options: action.options };
    case "read_finished":
      if (state.step !== "reading") return state;
      return { step: "preview", file: state.file, options: state.options, result: action.result };
    case "confirm":
      // Impossible de confirmer une lecture en échec.
      if (state.step !== "preview" || !state.result.ok) return state;
      return { step: "prepared", file: state.file, dataset: state.result.dataset, preparation: createPreparation(state.result.dataset) };
    case "back_to_preview":
      if (state.step !== "prepared") return state;
      return { step: "preview", file: state.file, options: {}, result: { ok: true, dataset: state.dataset } };
    case "reset":
      return initialImportFlow;
    case "restore":
      return { step: "prepared", file: action.file, dataset: action.dataset, preparation: action.preparation };
    case "operation":
      if (state.step !== "prepared") return state;
      return { ...state, preparation: addOperation(state.preparation, action.input) };
    case "undo":
      if (state.step !== "prepared") return state;
      return { ...state, preparation: undoOperation(state.preparation, action.operationId) };
  }
}
