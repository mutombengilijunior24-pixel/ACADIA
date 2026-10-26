import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { addOperation, createPreparation } from "@/lib/core/data/preparation";
import { profileDataset } from "@/lib/core/data/profile";
import type { PreparationState } from "@/lib/core/data/types";
import { buildUnderstanding } from "@/lib/core/data/understanding";
import { buildChain, buildChainPlan } from "@/lib/core/chain";
import { analyzeStructure, buildCartography, emptyMappingDecisions, emptyPlanDecisions, executePlan, linkQuestions } from "@/lib/core/journey";
import { journeySnapshotSchema, parseSnapshot, replayOperations, sha256Hex, SNAPSHOT_VERSION, type JourneySnapshot } from "@/lib/core/journey/persistence";
import { buildUnderstandingReport, validateResearchInput } from "@/lib/core/understanding";

import { importOk } from "../data/helpers";

const BYTES = new Uint8Array(readFileSync("tests/fixtures/acadia-parcours-credit-50.csv"));
const RESEARCH = {
  title: "Garantie et résultat de la demande de crédit",
  mainQuestion: "La disponibilité d'une garantie est-elle associée au résultat de la dernière demande de crédit ?",
  hypotheses: ["La disponibilité d'une garantie est associée au résultat de la dernière demande de crédit."],
};

function snapshotOf(preparation: PreparationState, sha: string): JourneySnapshot {
  return {
    version: SNAPSHOT_VERSION,
    field: { domain: "economics", specialty: "development", secondary: [] },
    fieldConfirmed: true,
    overrides: {},
    research: { ...RESEARCH },
    chainDecisions: { rows: {}, assignments: {} },
    framingConfirmedKey: "abc",
    instrument: { kind: "questionnaire", mode: "headers", text: "", acadia: null },
    instrumentConfirmed: true,
    data: { file: { name: "credit.csv", size: BYTES.length, lastModified: 0 }, importOptions: {}, sha256: sha, columnCount: 15, rowCount: 50, operations: preparation.operations as JourneySnapshot["data"] extends infer D ? (D extends { operations: infer O } ? O : never) : never },
    provenance: { kind: "synthetic_test", description: "" },
    qualityConfirmed: true,
    skipDecisions: {},
    skipValues: {},
    structuralChoice: {},
    mappingDecisions: { concepts: {}, unitRoles: {} },
    mappingConfirmedKey: null,
    planDecisions: {},
    alpha: 0.05,
    independence: true,
    planValidatedKey: null,
    hadResults: true,
    view: "results",
  };
}

async function analysed(preparation?: PreparationState) {
  const dataset = await importOk("credit.csv", BYTES);
  let prep = preparation ? replayOperations(preparation.operations, dataset).preparation : createPreparation(dataset);
  if (!preparation) for (const column of [11, 12, 13]) prep = addOperation(prep, { type: "set_statistical_type", column, statisticalType: "nominal" });
  const profile = profileDataset(dataset, prep);
  const { variables } = buildUnderstanding({ dataset, profile, preparation: prep });
  const structure = analyzeStructure(dataset, profile, variables);
  const v = validateResearchInput(RESEARCH);
  if (!v.ok) throw new Error("recherche");
  const report = buildUnderstandingReport(v.input);
  const cartography = buildCartography({ report, structure, questions: [], links: linkQuestions([], structure), decisions: emptyMappingDecisions() });
  const chain = buildChain({ research: v.input, report, structure, cartography });
  const plan = buildChainPlan({ chain, report, cartography, structure, dataset, preparation: prep, variables, instrument: "questionnaire", mainQuestion: RESEARCH.mainQuestion });
  const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset, preparation: prep, variables, alpha: 0.05, independenceConfirmed: true, key: "k" });
  return { dataset, preparation: prep, plan, execution };
}

describe("Interprétation enregistrée : instantané et reprise", () => {
  it("empreinte SHA-256 (valeur de référence)", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("l'instantané est validé ; un format inconnu ou malformé est refusé", async () => {
    const { preparation } = await analysed();
    const snapshot = snapshotOf(preparation, await sha256Hex(BYTES));
    expect(journeySnapshotSchema.safeParse(JSON.parse(JSON.stringify(snapshot))).success).toBe(true);
    expect(parseSnapshot({ ...snapshot, version: 99 })).toBeNull();
    expect(parseSnapshot({ ...snapshot, alpha: 5 })).toBeNull();
    expect(parseSnapshot({ ...snapshot, data: { ...snapshot.data, sha256: "pas-une-empreinte" } })).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
  });

  it("reprise : décisions rejouées sur le fichier réimporté (nouvel identifiant), mêmes analyses et mêmes résultats", async () => {
    const first = await analysed();
    const second = await analysed(first.preparation);
    expect(second.dataset.importId).not.toBe(first.dataset.importId);
    expect(second.preparation.datasetId).toBe(second.dataset.importId);
    expect(second.plan.items.map((i) => i.id)).toEqual(first.plan.items.map((i) => i.id));
    const p = (e: typeof first.execution) => e.items.flatMap((x) => (x.kind === "relation" && x.outcome.ok ? [x.outcome.report.pValue] : []));
    expect(p(second.execution)).toEqual(p(first.execution));
    expect(p(first.execution).length).toBeGreaterThan(0);
  });

  it("une décision qui ne correspond plus au fichier n'est pas rejouée, et elle est comptée", async () => {
    const { dataset, preparation } = await analysed();
    const bad = addOperation(preparation, { type: "set_statistical_type", column: 999, statisticalType: "nominal" });
    const { preparation: replayed, dropped } = replayOperations(bad.operations, dataset);
    expect(dropped).toBe(1);
    expect(replayed.operations).toHaveLength(preparation.operations.length);
  });
});
