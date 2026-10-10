import { describe, expect, it } from "vitest";

import { importFlowReducer, initialImportFlow } from "@/lib/core/data/flow";
import { importFile } from "@/lib/core/data/importer";

import { utf8 } from "./helpers";

const file = { name: "a.csv", size: 10, lastModified: 0 };

describe("A1 — parcours d'importation (état)", () => {
  it("vide → lecture → aperçu → confirmation → opérations réversibles → retour", async () => {
    let state = importFlowReducer(initialImportFlow, { type: "select_file", file });
    expect(state.step).toBe("reading");
    state = importFlowReducer(state, { type: "read_finished", result: await importFile("a.csv", utf8("x,y\n1,2\n")) });
    expect(state.step).toBe("preview");
    state = importFlowReducer(state, { type: "confirm" });
    expect(state.step).toBe("prepared");
    if (state.step !== "prepared") return;
    const original = state.dataset;

    state = importFlowReducer(state, { type: "operation", input: { type: "set_statistical_type", column: 0, statisticalType: "nominal" } });
    if (state.step !== "prepared") return;
    expect(state.preparation.operations).toHaveLength(1);
    state = importFlowReducer(state, { type: "undo", operationId: state.preparation.operations[0].id });
    if (state.step !== "prepared") return;
    expect(state.preparation.operations).toHaveLength(0);
    expect(state.dataset).toBe(original);

    state = importFlowReducer(state, { type: "back_to_preview" });
    expect(state.step).toBe("preview");
    expect(importFlowReducer(state, { type: "reset" })).toEqual({ step: "empty" });
  });

  it("refuse de confirmer une lecture en échec (aucun faux succès)", async () => {
    let state = importFlowReducer(initialImportFlow, { type: "select_file", file });
    state = importFlowReducer(state, { type: "read_finished", result: await importFile("a.csv", new Uint8Array()) });
    expect(state.step).toBe("preview");
    expect(importFlowReducer(state, { type: "confirm" }).step).toBe("preview");
  });

  it("ignore un résultat de lecture arrivé après un remplacement de fichier", async () => {
    const reading = importFlowReducer(initialImportFlow, { type: "select_file", file });
    const reset = importFlowReducer(reading, { type: "reset" });
    expect(importFlowReducer(reset, { type: "read_finished", result: await importFile("a.csv", utf8("x\n1\n")) })).toEqual({ step: "empty" });
  });
});
