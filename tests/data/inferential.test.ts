import { describe, expect, it } from "vitest";

import {
  averageRanks,
  brownForsythe,
  chiSquareTest,
  fisherExact2x2,
  multipleTestingNote,
  oneWayAnova,
  pearsonCorrelation,
  runAnalysis,
  selectMethods,
  spearmanCorrelation,
  welchTTest,
  type AnalysisRequest,
} from "@/lib/core/analysis/inferential";
import { addOperation, createPreparation } from "@/lib/core/data/preparation";
import { profileDataset } from "@/lib/core/data/profile";
import type { PreparationOperation, PreparationState, StatisticalType } from "@/lib/core/data/types";
import { buildUnderstanding } from "@/lib/core/data/understanding";

import { importOk, utf8 } from "./helpers";

// Données SYNTHÉTIQUES. Les valeurs de référence sont établies indépendamment du moteur :
// calcul à la main, formes fermées exactes des lois, ou intégration numérique (Simpson) ci-dessous.

/* ---------------------------------------------------------------- */
/* Références indépendantes de la bibliothèque utilisée par le moteur */
/* ---------------------------------------------------------------- */

/** log Γ(x) par l'approximation de Lanczos (g = 7), précision ~1e-15 : sert uniquement de référence de test. */
function logGamma(x: number): number {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let a = c[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i += 1) a += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

function simpson(f: (x: number) => number, a: number, b: number, steps = 20000): number {
  const h = (b - a) / steps;
  let s = f(a) + f(b);
  for (let i = 1; i < steps; i += 1) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

/** p bilatérale de Student par intégration de la densité : 1 − 2 ∫₀^|t| f(x) dx. */
function tPReference(t: number, df: number): number {
  const logC = logGamma((df + 1) / 2) - logGamma(df / 2) - 0.5 * Math.log(df * Math.PI);
  const density = (x: number) => Math.exp(logC - ((df + 1) / 2) * Math.log(1 + (x * x) / df));
  return 1 - 2 * simpson(density, 0, Math.abs(t));
}

/** p bilatérale normale (sert pour χ² à 1 ddl : χ² = Z²). */
function normalPReference(z: number): number {
  return 1 - 2 * simpson((x) => Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI), 0, Math.abs(z));
}

const Z975 = 1.959963984540054;

/* ---------------------------------------------------------------- */
/* Données passant par le vrai parcours : import → préparation → types */
/* ---------------------------------------------------------------- */

type Op = PreparationOperation extends infer T ? (T extends PreparationOperation ? Omit<T, "id" | "at"> : never) : never;

async function prepare(header: string[], rows: Array<Array<string | number>>, ops: (c: (name: string) => number) => Op[] = () => []) {
  const csv = [header.join(";"), ...rows.map((r) => r.join(";"))].join("\n") + "\n";
  const dataset = await importOk("donnees.csv", utf8(csv));
  const column = (name: string) => dataset.columns.findIndex((c) => c.technicalName === name);
  let preparation: PreparationState = createPreparation(dataset);
  for (const op of ops(column)) preparation = addOperation(preparation, op);
  const profile = profileDataset(dataset, preparation);
  const { variables } = buildUnderstanding({ dataset, profile, preparation });
  const analyze = (request: Partial<AnalysisRequest> & Pick<AnalysisRequest, "method">, outcome: string, explanatory: string) =>
    runAnalysis(dataset, preparation, variables, { alpha: 0.05, question: "", independenceConfirmed: true, outcomeColumn: column(outcome), explanatoryColumn: column(explanatory), ...request });
  const variable = (name: string) => variables.find((v) => v.column === column(name))!;
  return { dataset, preparation, variables, column, analyze, variable };
}

const type = (column: number, statisticalType: StatisticalType): Op => ({ type: "set_statistical_type", column, statisticalType });

/* ================================================================= */

describe("Lois de probabilité : contrôle contre des formes fermées", () => {
  it("χ² à 2 ddl : p = exp(−x/2) ; F(2, d₂) : p = (1 + 2F/d₂)^(−d₂/2) ; t à 3 ddl : forme exacte", () => {
    const chi = chiSquareTest([[10, 20, 30], [20, 20, 20]]);
    if (!chi.ok) throw new Error(chi.reason);
    expect(chi.value.pValue).toBeCloseTo(Math.exp(-chi.value.statistic / 2), 12);
    const anova = oneWayAnova([{ label: "a", values: [1, 2, 3] }, { label: "b", values: [4, 5, 6] }, { label: "c", values: [7, 8, 9] }]);
    expect(anova.ok && anova.value.pValue).toBeCloseTo((1 + (2 * 27) / 6) ** -3, 12);
    const pearson = pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
    const t = pearson.ok ? pearson.value.statistic : NaN;
    const u = t / Math.sqrt(3);
    expect(pearson.ok && pearson.value.pValue).toBeCloseTo(1 - (2 / Math.PI) * (Math.atan(u) + u / (1 + u * u)), 12);
  });
});

describe("A. Tableau croisé et Chi²", () => {
  it("tableau 2 × 3 connu : χ² = 16/3, ddl = 2, p = e^(−8/3), V = 0,2108", () => {
    const result = chiSquareTest([[10, 20, 30], [20, 20, 20]]);
    if (!result.ok) throw new Error(result.reason);
    const r = result.value;
    expect(r.n).toBe(120);
    expect(r.expected).toEqual([[15, 20, 25], [15, 20, 25]]);
    expect(r.statistic).toBeCloseTo(16 / 3, 12);
    expect(r.df).toBe(2);
    expect(r.pValue).toBeCloseTo(0.06948345122280154, 12);
    expect(r.cramersV).toBeCloseTo(Math.sqrt(16 / 3 / 120), 12);
    expect(r.conditionsMet).toBe(true);
    expect(r.fisher).toBeUndefined();
  });

  it("tableau 2 × 2 : χ² = 0,79365, p contrôlée par intégration de la loi normale ; Fisher exact", () => {
    const result = chiSquareTest([[10, 20], [30, 40]]);
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.statistic).toBeCloseTo(0.7936507936507936, 12);
    expect(result.value.pValue).toBeCloseTo(normalPReference(Math.sqrt(result.value.statistic)), 8);
    expect(result.value.pValue).toBeCloseTo(0.373, 4);
    // Dégustation de thé de Fisher : p bilatérale exacte = 34/70 = 17/35.
    expect(fisherExact2x2([[3, 1], [1, 3]]).pValue).toBeCloseTo(17 / 35, 12);
    expect(fisherExact2x2([[3, 1], [1, 3]]).oddsRatio).toBe(9);
  });

  it("conditions non satisfaites (effectifs attendus < 5) : avertissement, résultat non fiable, Fisher proposé", async () => {
    const rows: Array<[string, string, string]> = [];
    const counts = { "A|oui": 3, "A|non": 1, "B|oui": 1, "B|non": 3 };
    let id = 1;
    for (const [key, n] of Object.entries(counts)) for (let i = 0; i < n; i += 1) rows.push([String(id++), ...(key.split("|") as [string, string])]);
    const { analyze } = await prepare(["id", "groupe", "reponse"], rows, (c) => [type(c("groupe"), "nominal"), type(c("reponse"), "nominal")]);
    const out = analyze({ method: "chi_square" }, "reponse", "groupe");
    if (!out.ok) throw new Error(out.reason);
    expect(out.report.reliable).toBe(false);
    expect(out.report.checks.find((c) => c.id === "expected")?.status).toBe("failed");
    expect(out.report.interpretation[0]).toContain("L'approximation du Chi² n'est pas fiable");
    expect(out.report.interpretation.join(" ")).toContain(`Le test exact de Fisher`);
    expect(out.report.conclusion).toContain("ne doit pas être présenté comme fiable");
  });

  it("parcours complet : tableau croisé depuis les données, pourcentages, H0, V, aucune causalité", async () => {
    const rows: string[][] = [];
    const cells: Array<[string, string, number]> = [["A", "x", 10], ["A", "y", 20], ["A", "z", 30], ["B", "x", 20], ["B", "y", 20], ["B", "z", 20]];
    let id = 1;
    for (const [g, c, n] of cells) for (let i = 0; i < n; i += 1) rows.push([String(id++), g, c]);
    const { analyze } = await prepare(["id", "groupe", "choix"], rows, (c) => [type(c("groupe"), "nominal"), type(c("choix"), "nominal")]);
    const out = analyze({ method: "chi_square", question: "Le choix dépend-il du groupe ?" }, "choix", "groupe");
    if (!out.ok) throw new Error(out.reason);
    const { report } = out;
    expect(report.detail.kind).toBe("chi_square");
    if (report.detail.kind !== "chi_square") return;
    expect(report.detail.rowLabels).toEqual(["A", "B"]);
    expect(report.detail.colLabels).toEqual(["x", "y", "z"]);
    expect(report.detail.result.observed).toEqual([[10, 20, 30], [20, 20, 20]]);
    expect(report.statistic.value).toBeCloseTo(16 / 3, 12);
    expect(report.pValue).toBeCloseTo(Math.exp(-8 / 3), 12);
    expect(report.data.n).toBe(120);
    expect(report.significant).toBe(false);
    expect(report.effect?.magnitude).toBe("faible");
    expect(report.hypotheses.h0).toContain("« groupe » et « choix » sont indépendantes");
    expect(report.interpretation.join(" ")).toContain("ne démontre pas une relation de cause à effet");
    expect(report.conclusion).toContain("Question examinée : « Le choix dépend-il du groupe ? »");
    expect(report.conclusion).toContain("ne fournissent pas d'élément statistique suffisant");
  });
});

describe("B. Test t de Welch", () => {
  const a = [1, 2, 3, 4, 5];
  const b = [2, 4, 6, 8, 10];
  it("valeurs de référence calculées à la main ; p contrôlée par intégration ; IC et g de Hedges", () => {
    const result = welchTTest({ label: "A", values: a }, { label: "B", values: b });
    if (!result.ok) throw new Error(result.reason);
    const r = result.value;
    expect(r.groups.map((g) => [g.n, g.mean, g.variance])).toEqual([[5, 3, 2.5], [5, 6, 10]]);
    expect(r.difference).toBe(-3);
    expect(r.standardError).toBeCloseTo(Math.sqrt(2.5), 12);
    expect(r.statistic).toBeCloseTo(-3 / Math.sqrt(2.5), 12);
    expect(r.df).toBeCloseTo(6.25 / 1.0625, 12);
    expect(r.pValue).toBeCloseTo(tPReference(r.statistic, r.df), 7);
    expect(r.pValue).toBeCloseTo(0.1075, 3);
    // Valeur critique : la p bilatérale correspondante vaut exactement α.
    expect(tPReference(r.tCritical, r.df)).toBeCloseTo(0.05, 7);
    expect(r.ci[0]).toBeCloseTo(-3 - r.tCritical * Math.sqrt(2.5), 12);
    expect(r.ci[1]).toBeCloseTo(-3 + r.tCritical * Math.sqrt(2.5), 12);
    expect(r.pooledSd).toBeCloseTo(2.5, 12);
    expect(r.cohensD).toBeCloseTo(-1.2, 12);
    expect(r.hedgesG).toBeCloseTo(-1.2 * (1 - 3 / 31), 12);
  });

  it("effectifs insuffisants et variance nulle : calcul refusé avec la raison", () => {
    expect(welchTTest({ label: "A", values: [3] }, { label: "B", values: [1, 2] })).toMatchObject({ ok: false, reason: expect.stringContaining("au moins 2 observations") });
    expect(welchTTest({ label: "A", values: [3, 3] }, { label: "B", values: [5, 5, 5] })).toMatchObject({ ok: false, reason: expect.stringContaining("constantes") });
  });

  it("parcours : valeurs manquantes, code de non-réponse et ligne exclue ne sont jamais utilisés", async () => {
    // Groupe A : 1..5 ; groupe B : 2,4,6,8,10 ; plus : un vide, un « 999 » déclaré non-réponse, une ligne exclue (100), un texte invalide.
    const rows = [
      ["1", "A", "1"], ["2", "A", "2"], ["3", "A", "3"], ["4", "A", "4"], ["5", "A", "5"],
      ["6", "B", "2"], ["7", "B", "4"], ["8", "B", "6"], ["9", "B", "8"], ["10", "B", "10"],
      ["11", "A", ""], ["12", "B", "999"], ["13", "A", "100"], ["14", "", "7"],
    ];
    const { analyze } = await prepare(["id", "groupe", "score"], rows, (c) => [
      type(c("groupe"), "nominal"),
      type(c("score"), "quantitative_continuous"),
      { type: "declare_missing_codes", column: c("score"), values: ["999"] },
      { type: "exclude_rows", rows: [12], reason: "doublon" },
    ]);
    const out = analyze({ method: "welch_t" }, "score", "groupe");
    if (!out.ok) throw new Error(out.reason);
    const { report } = out;
    expect(report.data).toMatchObject({ rowsTotal: 14, rowsExcluded: 1, excludedSourceRows: [14], rowsAfterExclusions: 13, rowsDropped: 3, n: 10 });
    expect(report.data.perVariable).toEqual([
      { header: "score", missing: 2, invalid: 0, invalidExamples: [] },
      { header: "groupe", missing: 1, invalid: 0, invalidExamples: [] },
    ]);
    expect(report.statistic.value).toBeCloseTo(-3 / Math.sqrt(2.5), 12);
    expect(report.data.usedSourceRows).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("indépendance non confirmée : le calcul attend la réponse de l'utilisateur", async () => {
    const rows = [["1", "A", "1"], ["2", "A", "2"], ["3", "B", "3"], ["4", "B", "5"]];
    const { analyze } = await prepare(["id", "groupe", "score"], rows, (c) => [type(c("groupe"), "nominal"), type(c("score"), "quantitative_continuous")]);
    const out = analyze({ method: "welch_t", independenceConfirmed: false }, "score", "groupe");
    expect(out).toMatchObject({ ok: false, reason: expect.stringContaining("observations indépendantes") });
  });
});

describe("C. Corrélations", () => {
  it("Pearson : r = 6/√60, t = 2,1213, ddl = 3, IC de Fisher", () => {
    const result = pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
    if (!result.ok) throw new Error(result.reason);
    const r = result.value;
    expect(r.coefficient).toBeCloseTo(6 / Math.sqrt(60), 12);
    expect(r.statistic).toBeCloseTo((6 / Math.sqrt(60)) * Math.sqrt(3 / (1 - 0.6)), 12);
    expect(r.df).toBe(3);
    expect(r.pValue).toBeCloseTo(tPReference(r.statistic, 3), 8);
    const z = Math.atanh(6 / Math.sqrt(60));
    expect(r.ci?.[0]).toBeCloseTo(Math.tanh(z - Z975 / Math.sqrt(2)), 9);
    expect(r.ci?.[1]).toBeCloseTo(Math.tanh(z + Z975 / Math.sqrt(2)), 9);
  });

  it("corrélation positive parfaite : r = 1, p = 0, intervalle non défini ; variable constante refusée", () => {
    const perfect = pearsonCorrelation([1, 2, 3, 4], [3, 5, 7, 9]);
    expect(perfect).toMatchObject({ ok: true, value: { coefficient: 1, pValue: 0, ci: null } });
    expect(pearsonCorrelation([1, 2, 3, 4], [5, 5, 5, 5])).toMatchObject({ ok: false, reason: expect.stringContaining("constante") });
    expect(spearmanCorrelation([2, 2, 2], [1, 2, 3])).toMatchObject({ ok: false, reason: expect.stringContaining("constante") });
    expect(pearsonCorrelation([1, 2], [3, 4])).toMatchObject({ ok: false, reason: expect.stringContaining("Au moins 3 observations") });
  });

  it("Spearman : rangs moyens pour les ex æquo, ρ = 8/√95", () => {
    expect(averageRanks([5, 6, 7, 8, 7])).toEqual({ ranks: [1, 2, 3.5, 5, 3.5], tiedValues: 2 });
    const result = spearmanCorrelation([1, 2, 3, 4, 5], [5, 6, 7, 8, 7]);
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.coefficient).toBeCloseTo(8 / Math.sqrt(95), 12);
    expect(result.value.pValue).toBeCloseTo(tPReference(result.value.statistic, 3), 8);
    expect(spearmanCorrelation([1, 2, 3, 4, 5], [1, 4, 9, 16, 25])).toMatchObject({ ok: true, value: { coefficient: 1 } });
  });

  it("parcours : corrélation négative ; hypothèse de recherche contraire au sens observé signalée", async () => {
    const rows = [["1", "1", "10"], ["2", "2", "8"], ["3", "3", "9"], ["4", "4", "5"], ["5", "5", "4"], ["6", "6", "2"]];
    const { analyze } = await prepare(["id", "heures", "erreurs"], rows, (c) => [type(c("heures"), "quantitative_continuous"), type(c("erreurs"), "quantitative_continuous")]);
    const out = analyze({ method: "pearson", researchHypothesis: "Les heures de formation sont positivement associées aux erreurs." }, "erreurs", "heures");
    if (!out.ok) throw new Error(out.reason);
    expect(out.report.effect?.value).toBeLessThan(-0.9);
    expect(out.report.significant).toBe(true);
    expect(out.report.conclusion).toContain("est contraire à celui attendu");
    expect(out.report.conclusion).not.toMatch(/hypoth[eè]se (est )?(confirm|prouv)/i);
  });
});

describe("D. ANOVA à un facteur", () => {
  it("trois groupes connus : SC inter 54, SC intra 6, F = 27, p = 0,001, η² = 0,9", () => {
    const result = oneWayAnova([{ label: "a", values: [1, 2, 3] }, { label: "b", values: [4, 5, 6] }, { label: "c", values: [7, 8, 9] }]);
    if (!result.ok) throw new Error(result.reason);
    const r = result.value;
    expect([r.ssBetween, r.ssWithin, r.ssTotal]).toEqual([54, 6, 60]);
    expect([r.dfBetween, r.dfWithin]).toEqual([2, 6]);
    expect([r.msBetween, r.msWithin]).toEqual([27, 1]);
    expect(r.statistic).toBe(27);
    expect(r.pValue).toBeCloseTo(0.001, 12);
    expect(r.etaSquared).toBeCloseTo(0.9, 12);
    expect(r.omegaSquared).toBeCloseTo(52 / 61, 12);
    expect(r.levene?.statistic).toBe(0);
  });

  it("ANOVA déséquilibrée : F et p contrôlés par une ANOVA calculée à la main", () => {
    const groups = [[2, 3, 4, 5], [6, 7, 9], [1, 2, 2, 3, 7]];
    const result = oneWayAnova(groups.map((values, i) => ({ label: `g${i}`, values })));
    if (!result.ok) throw new Error(result.reason);
    // Moyennes 3,5 ; 22/3 ; 3 — moyenne générale 51/12 = 4,25.
    const ssb = 4 * (3.5 - 4.25) ** 2 + 3 * (22 / 3 - 4.25) ** 2 + 5 * (3 - 4.25) ** 2;
    const ssw = 5 + 14 / 3 + 22;
    expect(result.value.ssBetween).toBeCloseTo(ssb, 12);
    expect(result.value.ssWithin).toBeCloseTo(ssw, 12);
    expect(result.value.statistic).toBeCloseTo(ssb / 2 / (ssw / 9), 12);
  });

  it("variance intra nulle ou groupe d'une seule observation : refus explicite", () => {
    expect(oneWayAnova([{ label: "a", values: [1, 1] }, { label: "b", values: [2, 2] }, { label: "c", values: [3, 3] }])).toMatchObject({ ok: false, reason: expect.stringContaining("variance intra-groupe est nulle") });
    expect(oneWayAnova([{ label: "a", values: [1] }, { label: "b", values: [2, 3] }, { label: "c", values: [3, 4] }])).toMatchObject({ ok: false, reason: expect.stringContaining("au moins 2 observations") });
  });

  it("conditions non satisfaites : variances hétérogènes et groupes déséquilibrés ⇒ résultat signalé non fiable", async () => {
    const values: Record<string, number[]> = {
      A: [10, 10.1, 9.9, 10, 10.2, 9.8, 10, 10.1, 9.9, 10, 10.1, 9.9],
      B: [5, 25, 1, 30],
      C: [12, 12.2, 11.8, 12.1, 11.9, 12],
    };
    const rows: string[][] = [];
    let id = 1;
    for (const [g, list] of Object.entries(values)) for (const v of list) rows.push([String(id++), g, String(v)]);
    const { analyze } = await prepare(["id", "site", "delai"], rows, (c) => [type(c("site"), "nominal"), type(c("delai"), "quantitative_continuous")]);
    const out = analyze({ method: "anova" }, "delai", "site");
    if (!out.ok) throw new Error(out.reason);
    expect(brownForsythe(Object.values(values))!.pValue).toBeLessThan(0.05);
    expect(out.report.reliable).toBe(false);
    expect(out.report.checks.find((c) => c.id === "variances")?.status).toBe("failed");
    expect(out.report.interpretation[0]).toContain("ne la présentez pas comme fiable");
    expect(out.report.limits.join(" ")).toContain("ANOVA de Welch");
  });
});

describe("Sélection des méthodes et refus", () => {
  async function dataset() {
    const rows: string[][] = [];
    for (let i = 1; i <= 12; i += 1) rows.push([String(i), i % 2 ? "F" : "M", ["Nord", "Sud", "Est"][i % 3], String(20 + i), String(100 + 3 * i + (i % 4)), String((i % 5) + 1), `commentaire ${i}`]);
    return prepare(["id", "sexe", "region", "age", "revenu", "satisfaction", "avis"], rows, (c) => [
      type(c("sexe"), "nominal"),
      type(c("region"), "nominal"),
      type(c("age"), "quantitative_discrete"),
      type(c("revenu"), "quantitative_continuous"),
      type(c("satisfaction"), "ordinal"),
      type(c("avis"), "free_text"),
    ]);
  }

  it("propose la méthode adaptée aux types et explique pourquoi", async () => {
    const { dataset: ds, preparation, variable } = await dataset();
    const pick = (y: string, x: string) => selectMethods(ds, preparation, variable(y), variable(x));
    expect(pick("revenu", "sexe").options.map((o) => [o.method, o.recommended])).toEqual([["welch_t", true]]);
    expect(pick("revenu", "region").options.map((o) => [o.method, o.recommended])).toEqual([["anova", true]]);
    expect(pick("revenu", "age").options.map((o) => [o.method, o.recommended])).toEqual([["pearson", true], ["spearman", false]]);
    expect(pick("sexe", "region").options.map((o) => o.method)).toEqual(["chi_square"]);
    expect(pick("revenu", "satisfaction").options.map((o) => o.method)).toEqual(["anova", "spearman"]);
    expect(pick("revenu", "sexe").options[0].why).toContain("deux groupes");
    expect(pick("revenu", "sexe").needsIndependence).toBe(true);
  });

  it("refuse les variables inadaptées : identifiant, texte libre, même variable, méthode incompatible", async () => {
    const { dataset: ds, preparation, variable, analyze } = await dataset();
    expect(selectMethods(ds, preparation, variable("revenu"), variable("id")).refused).toContain("identifiant");
    expect(selectMethods(ds, preparation, variable("avis"), variable("sexe")).refused).toContain("texte libre");
    expect(selectMethods(ds, preparation, variable("revenu"), variable("revenu")).refused).toBe("Choisissez deux variables différentes.");
    const wrong = analyze({ method: "pearson" }, "revenu", "sexe");
    expect(wrong).toMatchObject({ ok: false, reason: expect.stringContaining("n'est pas adapté") });
    expect(wrong.ok === false && wrong.reason).toContain("Test t de Welch");
  });

  it("refuse une structure de panel (observations non indépendantes)", async () => {
    const rows = [["1", "A", "1"], ["2", "A", "2"], ["3", "B", "3"], ["4", "B", "5"]];
    const { dataset: ds, preparation, variable } = await prepare(["id", "groupe", "score"], rows, (c) => [type(c("groupe"), "nominal"), type(c("score"), "quantitative_continuous"), { type: "confirm_structure", family: "panel" }]);
    expect(selectMethods(ds, preparation, variable("score"), variable("groupe")).refused).toContain("pas indépendantes");
  });

  it("comparaisons multiples : risque cumulé et seuil de Bonferroni", () => {
    expect(multipleTestingNote(1, 0.05)).toBeNull();
    const note = multipleTestingNote(3, 0.05)!;
    expect(note).toContain("14,3 %");
    expect(note).toContain("α / 3 = 0,0167");
  });
});
