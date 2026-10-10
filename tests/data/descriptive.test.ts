import { describe, expect, it } from "vitest";

import {
  computeDescriptiveStatistics,
  histogram,
  mean,
  median,
  varianceSample,
  variancePopulation,
  type CategoricalResult,
  type DescriptiveOptions,
  type OrdinalResult,
  type QuantitativeResult,
} from "@/lib/core/analysis/descriptiveStatistics";
import { addOperation, createPreparation } from "@/lib/core/data/preparation";
import { profileDataset } from "@/lib/core/data/profile";
import type { PreparationOperation, PreparationState, StatisticalType } from "@/lib/core/data/types";
import { buildUnderstanding } from "@/lib/core/data/understanding";

import { importOk, utf8 } from "./helpers";

// Jeux de données SYNTHÉTIQUES ; résultats attendus calculés à la main.

type Op = PreparationOperation extends infer T ? (T extends PreparationOperation ? Omit<T, "id" | "at"> : never) : never;

async function run(csv: string, ops: (columns: (name: string) => number) => Op[] = () => [], options: DescriptiveOptions = {}) {
  const dataset = await importOk("donnees.csv", utf8(csv));
  const column = (name: string) => dataset.columns.findIndex((c) => c.technicalName === name);
  let preparation: PreparationState = createPreparation(dataset);
  for (const op of ops(column)) preparation = addOperation(preparation, op);
  const profile = profileDataset(dataset, preparation);
  const { variables } = buildUnderstanding({ dataset, profile, preparation });
  const report = computeDescriptiveStatistics(dataset, preparation, variables, typeof options === "function" ? {} : options);
  const result = <T>(name: string) => report.results.find((r) => r.technicalName === name) as T;
  return { dataset, report, result, column };
}

const confirm = (column: number, statisticalType: StatisticalType): Op => ({ type: "set_statistical_type", column, statisticalType });

describe("Fonctions élémentaires", () => {
  // Série classique 2, 4, 4, 4, 5, 5, 7, 9 : somme 40, moyenne 5, Σ(x−5)² = 32.
  const x = [2, 4, 4, 4, 5, 5, 7, 9];
  it("moyenne, médiane, variances", () => {
    expect(mean(x)).toBe(5);
    expect(median(x)).toBe(4.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(variancePopulation(x)).toBe(4);
    expect(varianceSample(x)).toBeCloseTo(32 / 7, 12);
    expect(varianceSample([5])).toBeNull();
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
  });
  it("histogramme : règle de Sturges (k = 4 pour n = 8, largeur 1,75)", () => {
    expect(histogram(x)).toEqual([
      { from: 2, to: 3.75, count: 1 },
      { from: 3.75, to: 5.5, count: 5 },
      { from: 5.5, to: 7.25, count: 1 },
      { from: 7.25, to: 9, count: 1 },
    ]);
    expect(histogram([3, 3, 3])).toEqual([{ from: 3, to: 3, count: 3 }]);
    expect(histogram([])).toEqual([]);
  });
});

describe("Variables quantitatives", () => {
  const CSV = ["score", "2", "4", "4", "4", "5", "5", "7", "9"].join("\n");

  it("calcule toutes les statistiques exactes", async () => {
    const { result } = await run(CSV, (c) => [confirm(c("score"), "quantitative_discrete")]);
    const score = result<QuantitativeResult>("score");
    expect(score).toMatchObject({
      kind: "quantitative",
      rows: 8,
      valid: 8,
      missing: 0,
      invalid: 0,
      sum: 40,
      mean: 5,
      median: 4.5,
      min: 2,
      max: 9,
      range: 7,
      variancePopulation: 4,
      sdPopulation: 2,
      q1: 4,
      q3: 5.5,
      iqr: 1.5,
    });
    expect(score.varianceSample).toBeCloseTo(32 / 7, 12);
    expect(score.sdSample).toBeCloseTo(Math.sqrt(32 / 7), 12);
    expect(score.histogram.map((b) => b.count)).toEqual([1, 5, 1, 1]);
  });

  it("ne transforme jamais une valeur manquante en zéro", async () => {
    const { result } = await run(["montant,ref", "10,a", ",b", "20,c", "  ,d"].join("\n"), (c) => [confirm(c("montant"), "quantitative_continuous")]);
    // Si les vides valaient 0 : moyenne 7,5. Attendu : (10 + 20) / 2 = 15.
    expect(result<QuantitativeResult>("montant")).toMatchObject({ valid: 2, missing: 2, missingPercent: 50, sum: 30, mean: 15, median: 15, q1: null, q3: null });
  });

  it("signale (sans les convertir) les valeurs non numériques, puis applique un code de non-réponse confirmé", async () => {
    const csv = ["note", "12", "15", "NA", "11,5", "14"].join("\n");
    const before = await run(csv, (c) => [confirm(c("note"), "quantitative_continuous")]);
    // « NA » est une valeur renseignée non numérique : exclue des calculs et signalée.
    expect(before.result<QuantitativeResult>("note")).toMatchObject({ valid: 4, missing: 0, invalid: 1, invalidExamples: ["NA"], sum: 52.5, mean: 13.125 });

    const after = await run(csv, (c) => [confirm(c("note"), "quantitative_continuous"), { type: "declare_missing_codes", column: c("note"), values: ["NA"] }]);
    expect(after.result<QuantitativeResult>("note")).toMatchObject({ valid: 4, missing: 1, invalid: 0, mean: 13.125, min: 11.5, max: 15 });
  });

  it("cas limites : une seule valeur, aucune valeur", async () => {
    const one = await run(["v", "7"].join("\n"), (c) => [confirm(c("v"), "quantitative_discrete")]);
    expect(one.result<QuantitativeResult>("v")).toMatchObject({ valid: 1, mean: 7, median: 7, varianceSample: null, sdSample: null, variancePopulation: 0, sdPopulation: 0, range: 0 });

    const none = await run(["v,w", ",1", ",2"].join("\n"), (c) => [confirm(c("v"), "quantitative_discrete")]);
    // Colonne vide dont le type a été confirmé : aucune statistique inventée (null, jamais NaN ni 0).
    expect(none.result<QuantitativeResult>("v")).toMatchObject({ valid: 0, missing: 2, sum: null, mean: null, median: null, min: null, varianceSample: null, variancePopulation: null, histogram: [] });
  });
});

describe("Variables qualitatives nominales", () => {
  it("effectifs, fréquences, pourcentages, modalités et mode", async () => {
    const { result } = await run(["ville,ref", "Lubumbashi,1", "Likasi,2", "Lubumbashi,3", "Kolwezi,4", "Likasi,5", "Lubumbashi,6", ",7"].join("\n"), (c) => [confirm(c("ville"), "nominal")]);
    const ville = result<CategoricalResult>("ville");
    expect(ville).toMatchObject({ kind: "categorical", rows: 7, valid: 6, missing: 1, categories: 3, modes: ["Lubumbashi"] });
    expect(ville.frequencies).toEqual([
      { value: "Lubumbashi", count: 3, proportion: 0.5, percent: 50 },
      { value: "Likasi", count: 2, proportion: 2 / 6, percent: (2 / 6) * 100 },
      { value: "Kolwezi", count: 1, proportion: 1 / 6, percent: (1 / 6) * 100 },
    ]);
    expect(ville.frequencies.reduce((t, f) => t + f.percent, 0)).toBeCloseTo(100, 12);
  });

  it("indique tous les modes en cas d'égalité", async () => {
    const { result } = await run(["groupe", "A", "B", "B", "A"].join("\n"), (c) => [confirm(c("groupe"), "nominal")]);
    expect(result<CategoricalResult>("groupe").modes).toEqual(["A", "B"]);
  });
});

describe("Variables ordinales et échelles de Likert", () => {
  it("distribution sur l'échelle, pourcentages cumulés, médiane ; moyenne seulement sur demande", async () => {
    // Codes valides 2, 3, 4, 4, 4, 5 (99 = non-réponse confirmée, une cellule vide).
    const csv = ["satisfaction", "4", "5", "99", "3", "4", "2", "", "4"].join("\n");
    const ops = (c: (n: string) => number): Op[] => [
      confirm(c("satisfaction"), "ordinal"),
      { type: "declare_missing_codes", column: c("satisfaction"), values: ["99"] },
    ];
    const { result } = await run(csv, ops);
    const s = result<OrdinalResult>("satisfaction");
    expect(s).toMatchObject({ kind: "ordinal", rows: 8, valid: 6, missing: 2, orderKnown: true, orderSource: "numeric_codes", modes: ["4"], median: { lower: "4", upper: "4" }, medianCode: 4 });
    expect(s.frequencies.map((f) => [f.value, f.count])).toEqual([["2", 1], ["3", 1], ["4", 3], ["5", 1]]);
    expect(s.frequencies.map((f) => f.cumulativePercent)).toEqual([(1 / 6) * 100, (2 / 6) * 100, (5 / 6) * 100, 100]);
    expect(s).toMatchObject({ meanRequested: false, meanAvailable: true, meanOfCodes: null });

    const withMean = await run(csv, ops, { ordinalMeanColumns: [0] });
    expect(withMean.result<OrdinalResult>("satisfaction").meanOfCodes).toBeCloseTo(22 / 6, 12);
  });

  it("médiane entre deux modalités quand le cumul tombe exactement sur 50 %", async () => {
    const { result } = await run(["niveau", "1", "1", "2", "2"].join("\n"), (c) => [confirm(c("niveau"), "ordinal")]);
    expect(result<OrdinalResult>("niveau")).toMatchObject({ median: { lower: "1", upper: "2" }, medianCode: 1.5 });
  });

  it("liste les modalités intermédiaires sans réponse (effectif 0)", async () => {
    const { result } = await run(["niveau", "1", "3", "3"].join("\n"), (c) => [confirm(c("niveau"), "ordinal")]);
    expect(result<OrdinalResult>("niveau").frequencies.map((f) => [f.value, f.count])).toEqual([["1", 1], ["2", 0], ["3", 2]]);
  });

  it("ordonne les libellés de Likert connus et en déduit la médiane", async () => {
    const { result } = await run(["avis", "D'accord", "Pas d'accord", "Tout à fait d'accord", "D'accord"].join("\n"), (c) => [confirm(c("avis"), "ordinal")]);
    const avis = result<OrdinalResult>("avis");
    expect(avis.orderSource).toBe("known_labels");
    expect(avis.frequencies.map((f) => [f.value, f.count])).toEqual([["Pas d'accord", 1], ["D'accord", 2], ["Tout à fait d'accord", 1]]);
    expect(avis.median).toEqual({ lower: "D'accord", upper: "D'accord" });
    expect(avis.meanAvailable).toBe(false);
  });

  it("ne calcule pas de médiane quand l'ordre des modalités est inconnu", async () => {
    const { result } = await run(["couleur", "rouge", "vert", "rouge"].join("\n"), (c) => [confirm(c("couleur"), "ordinal")]);
    expect(result<OrdinalResult>("couleur")).toMatchObject({ orderKnown: false, median: null, medianCode: null });
  });
});

describe("Identifiants, confirmation et exclusions", () => {
  const CSV = ["id_repondant,age", "1,20", "2,22", "3,24", "4,26", "5,28"].join("\n");

  it("n'analyse jamais un identifiant comme une mesure", async () => {
    const { report } = await run(CSV, (c) => [confirm(c("age"), "quantitative_discrete")]);
    expect(report.results.map((r) => r.technicalName)).toEqual(["age"]);
    expect(report.skipped).toEqual([expect.objectContaining({ header: "id_repondant", statisticalType: "identifier" })]);
  });

  it("n'analyse pas une variable dont la classification n'est pas confirmée", async () => {
    const { report } = await run(CSV);
    expect(report.results).toHaveLength(0);
    expect(report.skipped.find((s) => s.header === "age")?.reason).toContain("confirmez");
  });

  it("respecte les lignes exclues et les identifie", async () => {
    const { report, result } = await run(CSV, (c) => [confirm(c("age"), "quantitative_discrete"), { type: "exclude_rows", rows: [4], reason: "test" }]);
    expect(report).toMatchObject({ rowsTotal: 5, rowsExcluded: 1, rowsUsed: 4, excludedSourceRows: [6] });
    // Âges retenus 20, 22, 24, 26 : moyenne 23 (et non 24 avec la ligne exclue).
    expect(result<QuantitativeResult>("age")).toMatchObject({ rows: 4, valid: 4, mean: 23, max: 26 });
  });
});
