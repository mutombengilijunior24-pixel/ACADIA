import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { checkCausality } from "@/lib/core/analysis/InterpretationGuards";
import { chiSquarePValue, fStatisticPValue, studentTTwoTailedPValue } from "@/lib/core/analysis/BivariateStatistics";
import { buildChain, type ResearchChain } from "@/lib/core/chain";
import { buildDocx } from "@/lib/core/export/docx";
import { buildWorkbook } from "@/lib/core/export/xlsx";
import { isDedicatedEngine, JOURNEY_KINDS, payloadSchemaFor } from "@/lib/core/journey/kinds";
import { specialtyOf } from "@/lib/core/orchestrator";
import { buildUnderstandingReport, emptyDecisions, splitLines, validateResearchInput } from "@/lib/core/understanding";
import {
  adf,
  analyzeModel,
  buildChapter,
  buildModels,
  computeAggregates,
  criticalValues,
  datasetFromTable,
  DEMO_RESEARCH,
  demoDataset,
  durbinWatson,
  econDocument,
  econSheets,
  econSnapshotSchema,
  engleGranger,
  evaluateHypotheses,
  fitDesign,
  granger,
  guessRole,
  integrationOrder,
  macroLinks,
  measureOf,
  proposeHypothesis,
  readiness,
  THEORIES,
  transform,
  type MacroDataset,
} from "@/lib/core/econometrics";

/** Générateur pseudo-aléatoire déterministe et loi normale (Box-Muller) : tests reproductibles. */
function rng(seed: number) {
  let s = seed;
  const u = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return (s + 1) / 2147483649;
  };
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}
const randomWalk = (n: number, seed: number) => {
  const e = rng(seed);
  const out: number[] = [];
  let v = 100;
  for (let i = 0; i < n; i += 1) out.push((v += e()));
  return out;
};
const whiteNoise = (n: number, seed: number) => {
  const e = rng(seed);
  return Array.from({ length: n }, () => e());
};

describe("statistiques de base et valeurs critiques", () => {
  it("p-values de Student, Fisher et du χ² conformes aux tables", () => {
    expect(studentTTwoTailedPValue(2, 10)).toBeCloseTo(0.0734, 3);
    expect(fStatisticPValue(4, 2, 20)).toBeCloseTo(0.0346, 3);
    expect(chiSquarePValue(3.841, 1)).toBeCloseTo(0.05, 3);
  });

  it("valeurs critiques de MacKinnon (2010) : asymptotiques et à distance finie", () => {
    const c = criticalValues(1e9, "c")!;
    expect(c.p1).toBeCloseTo(-3.43, 2);
    expect(c.p5).toBeCloseTo(-2.86, 2);
    expect(c.p10).toBeCloseTo(-2.57, 2);
    expect(criticalValues(100, "c")!.p5).toBeCloseTo(-2.891, 3);
    expect(criticalValues(1e9, "ct")!.p5).toBeCloseTo(-3.41, 2);
    expect(criticalValues(1e9, "c", 2)!.p5).toBeCloseTo(-3.34, 2);
    expect(criticalValues(1e9, "c", 3)!.p5).toBeCloseTo(-3.74, 2);
    expect(criticalValues(50, "c", 5)).toBeNull();
  });
});

describe("stationnarité (ADF)", () => {
  it("une marche aléatoire n'est pas stationnaire ; un bruit blanc l'est", () => {
    const rw = adf(randomWalk(80, 7), "c");
    expect(rw.stat).not.toBeNull();
    expect(rw.stationary).toBe(false);
    const wn = adf(whiteNoise(80, 11), "c");
    expect(wn.stationary).toBe(true);
    expect(wn.level).toBe("1 %");
  });

  it("ordre d'intégration : une marche aléatoire est I(1)", () => {
    expect(integrationOrder(randomWalk(80, 3), "X").order).toBe(1);
    expect(integrationOrder(whiteNoise(60, 5), "Y").order).toBe(0);
  });

  it("refuse de conclure sur moins de 10 observations consécutives", () => {
    const r = adf([1, 2, 3, null, 5, 6, 7, 8, 9, 10, 11], "c");
    expect(r.stat).toBeNull();
    expect(r.reason).toMatch(/au moins 10/);
  });
});

describe("cointégration, correction d'erreur et causalité de Granger", () => {
  const x = randomWalk(60, 21);
  const noise = whiteNoise(60, 22);
  const yCoint = x.map((v, i) => 5 + 2 * v + noise[i]);
  const yIndep = randomWalk(60, 99);

  const resid = (y: number[]) => fitDesign(x.map((v) => [1, v]), y)!.residuals;

  it("Engle-Granger : séries cointégrées par construction / marches indépendantes", () => {
    expect(engleGranger(resid(yCoint), 2).cointegrated).toBe(true);
    expect(engleGranger(resid(yIndep), 2).cointegrated).toBe(false);
    expect(engleGranger(resid(yCoint), 5).available).toBe(false);
  });

  it("modèle à correction d'erreur : force de rappel négative et significative", () => {
    const dataset: MacroDataset = { title: "t", economy: "test", frequency: "annuelle", periods: x.map((_, i) => String(1960 + i)), series: [{ id: "x", name: "X", unit: "", role: "autre", values: x }, { id: "y", name: "Y", unit: "", role: "autre", values: yCoint }], source: "", fictitious: true };
    const a = analyzeModel(dataset, { dependent: { kind: "series", id: "y" }, regressors: [{ kind: "series", id: "x" }], transform: "niveau" });
    expect(a.orders.map((o) => o.order.order)).toEqual([1, 1]);
    expect(a.cointegration?.cointegrated).toBe(true);
    expect(a.ecm?.valid).toBe(true);
    expect(a.orientations.some((o) => o.title === "Relation de long terme (cointégration)")).toBe(true);
  });

  it("deux marches aléatoires indépendantes : alerte de régression fallacieuse et orientation vers les différences", () => {
    const dataset: MacroDataset = { title: "t", economy: "test", frequency: "annuelle", periods: x.map((_, i) => String(1960 + i)), series: [{ id: "x", name: "X", unit: "", role: "autre", values: x }, { id: "y", name: "Y", unit: "", role: "autre", values: yIndep }], source: "", fictitious: true };
    const a = analyzeModel(dataset, { dependent: { kind: "series", id: "y" }, regressors: [{ kind: "series", id: "x" }], transform: "niveau" });
    const spurious = a.orientations.find((o) => o.title === "Risque de régression fallacieuse");
    expect(spurious?.action).toBe("estimer_en_differences");
  });

  it("Granger : une variable qui précède l'autre est détectée", () => {
    const e = whiteNoise(80, 31);
    const u = whiteNoise(80, 32);
    const y = e.map((_, t) => (t === 0 ? 0 : 0.8 * e[t - 1] + 0.3 * u[t]));
    expect(granger(y, e, 1).pValue!).toBeLessThan(0.01);
    expect(granger(u, e, 1).pValue!).toBeGreaterThan(0.05);
  });

  it("Durbin-Watson : 2 sans autocorrélation, proche de 4 si les résidus alternent", () => {
    expect(durbinWatson([1, -1, 1, -1, 1, -1, 1, -1])).toBeGreaterThan(3.4);
    expect(durbinWatson(whiteNoise(200, 41))).toBeGreaterThan(1.6);
  });
});

describe("séries, agrégats et seuils", () => {
  it("transformations : log refusé pour une valeur négative, croissance, différence", () => {
    expect(transform([1, -2, 4], "log").issue).toMatch(/logarithme/);
    expect(transform([100, 110, 99], "croissance").values).toEqual([null, expect.closeTo(10, 6), expect.closeTo(-10, 6)]);
    expect(transform([5, 8, 6], "diff").values).toEqual([null, 3, -2]);
  });

  it("agrégats macroéconomiques calculés seulement si leurs séries existent", () => {
    const d = demoDataset();
    const ids = computeAggregates(d).map((a) => a.def.id);
    expect(ids).toEqual(expect.arrayContaining(["inflation_ipc", "croissance_m2", "vitesse_monnaie", "liquidite_economie", "depreciation", "taux_ouverture", "solde_budgetaire_pib", "taux_investissement", "part_agriculture", "deflateur_pib"]));
    expect(ids).not.toContain("multiplicateur_monetaire");
    const v = computeAggregates(d).find((a) => a.def.id === "vitesse_monnaie")!;
    const pibn = d.series.find((s) => s.id === "pib_nominal")!.values;
    const m2 = d.series.find((s) => s.id === "m2")!.values;
    expect(v.values[3]).toBeCloseTo((pibn[3] as number) / (m2[3] as number), 9);
  });

  it("règle des 5 observations minimum, puis analyse indicative, partielle ou complète", () => {
    expect(readiness(4, 2).level).toBe("bloque");
    expect(readiness(5, 2)).toMatchObject({ level: "indicatif", canEstimate: true, canTestStationarity: false });
    expect(readiness(12, 2)).toMatchObject({ level: "partiel", canTestStationarity: true, canTestCointegration: false });
    expect(readiness(24, 3)).toMatchObject({ level: "complet", canTestCointegration: true });
    expect(readiness(4, 2).messages[0]).toMatch(/au moins 5 périodes/);
  });

  it("reconnaît le rôle des séries d'après leur nom", () => {
    expect(guessRole("PIB nominal (milliards CDF)")).toBe("pib_nominal");
    expect(guessRole("Masse monétaire M2")).toBe("m2");
    expect(guessRole("Taux de change CDF/USD")).toBe("taux_change");
    expect(guessRole("Indice des prix à la consommation")).toBe("ipc");
    expect(guessRole("Production de maïs")).toBe("production_agricole");
  });
});

const hypothesisChain = (text: string): ResearchChain => ({
  problem: "",
  statements: [{ id: "h1", kind: "hypothesis", index: 0, text, origin: "user", ref: "" }],
  variables: [],
  rows: [{ id: "r1", questionId: null, objectiveId: null, hypothesisId: "h1", independent: [], dependent: [], descriptive: false, confidence: "high", reasons: [], status: "proposed" }],
  assignments: [],
  issues: [],
});

describe("lecture économique du sujet", () => {
  it("relation, signe attendu et théorie, y compris quand la cause est qualifiée", () => {
    const quant = macroLinks(hypothesisChain("La hausse de la masse monétaire entraîne une hausse de l'inflation."))[0];
    expect([quant.cause?.id, quant.effect?.id, quant.expectedSign, quant.signSource]).toEqual(["masse_monetaire", "inflation", 1, "hypothese"]);
    expect(quant.theory?.name).toMatch(/quantitative/);
    expect(macroLinks(hypothesisChain("Une hausse du taux directeur entraîne une baisse de l'inflation."))[0].expectedSign).toBe(-1);
    expect(macroLinks(hypothesisChain("L'appréciation du taux de change réduit l'inflation."))[0].expectedSign).toBe(1);
    const dep = macroLinks(hypothesisChain("L'inflation dépend de la masse monétaire."))[0];
    expect([dep.cause?.id, dep.effect?.id, dep.expectedSign, dep.signSource]).toEqual(["masse_monetaire", "inflation", 1, "theorie"]);
    expect(macroLinks(hypothesisChain("L'investissement favorise la croissance économique."))[0]).toMatchObject({ expectedSign: 1 });
  });

  it("chaque hypothèse proposée d'après la théorie est bien rédigée et relue avec le bon sens et le bon signe", () => {
    expect(proposeHypothesis("masse_monetaire", "inflation", 1)).toBe("La hausse de la masse monétaire entraîne une hausse de l'inflation.");
    expect(proposeHypothesis("taux_directeur", "credit", -1)).toBe("La hausse du taux directeur entraîne une baisse du crédit à l'économie.");
    expect(proposeHypothesis("taux_change", "inflation", 1)).toBe("La dépréciation du taux de change entraîne une hausse de l'inflation.");
    for (const [key, theory] of Object.entries(THEORIES)) {
      const [cause, effect] = key.split(">");
      const link = macroLinks(hypothesisChain(proposeHypothesis(cause, effect, theory.sign)))[0];
      expect([key, link.cause?.id, link.effect?.id, link.expectedSign, link.signSource]).toEqual([key, cause, effect, theory.sign, "hypothese"]);
    }
  });
});

describe("moteur enregistrable et proposé depuis le parcours général", () => {
  it("le moteur « econometrie » est un moteur dédié, avec son propre schéma d'instantané", () => {
    expect(JOURNEY_KINDS).toContain("econometrie");
    expect(isDedicatedEngine("econometrie")).toBe(true);
    expect(isDedicatedEngine("survey")).toBe(false);
    expect(payloadSchemaFor("econometrie").safeParse({ engine: "finance" }).success).toBe(false);
  });

  it("proposé (jamais imposé) pour les spécialités économiques", () => {
    expect(["monetary_banking", "development", "rural", "economics_general"].map((id) => specialtyOf(id as Parameters<typeof specialtyOf>[0])?.alternativeEngine)).toEqual(["econometrie", "econometrie", "econometrie", "econometrie"]);
    expect(specialtyOf("monetary_banking")?.engine).toBeUndefined();
    expect(specialtyOf("finance")?.alternativeEngine).toBeUndefined();
  });
});

describe("démonstration complète (données fictives)", () => {
  const dataset = demoDataset();
  const v = validateResearchInput({ ...DEMO_RESEARCH, specificQuestions: splitLines(DEMO_RESEARCH.specificQuestions), specificObjectives: splitLines(DEMO_RESEARCH.specificObjectives), hypotheses: splitLines(DEMO_RESEARCH.hypotheses) });
  if (!v.ok) throw new Error("sujet d'exemple invalide");
  const chain = buildChain({ research: v.input, report: buildUnderstandingReport(v.input, emptyDecisions()) });
  const links = macroLinks(chain).filter((l) => l.hypothesis);
  const mappings = Object.fromEntries(links.map((l) => [l.rowId, { dependent: measureOf(l.effect, dataset), independent: measureOf(l.cause, dataset), sign: l.expectedSign }]));
  const models = buildModels(dataset, links, mappings, {});
  const analyses = Object.fromEntries(models.map((m) => [m.key, analyzeModel(dataset, m.spec)]));
  const results = evaluateHypotheses(dataset, links, mappings, models, analyses);
  const chapter = buildChapter(dataset, models, analyses, results);

  it("les deux hypothèses sont lues et reliées aux bonnes variables", () => {
    expect(links.map((l) => [l.cause?.id, l.effect?.id, l.expectedSign])).toEqual([["masse_monetaire", "inflation", 1], ["taux_change", "inflation", 1]]);
    expect(Object.values(mappings).map((m) => [m.independent?.id, m.dependent?.id])).toEqual([["croissance_m2", "inflation_ipc"], ["depreciation", "inflation_ipc"]]);
    expect(models).toHaveLength(1);
    expect(models[0].spec.regressors.map((r) => r.id)).toEqual(["croissance_m2", "depreciation"]);
  });

  it("estimation : variables stationnaires, coefficients positifs et significatifs, diagnostics satisfaisants", () => {
    const a = analyses[models[0].key];
    expect(a.readiness.level).toBe("complet");
    expect(a.orders.every((o) => o.order.order === 0)).toBe(true);
    expect(a.estimation!.rows[1].beta).toBeCloseTo(0.475, 2);
    expect(a.estimation!.rows[2].beta).toBeCloseTo(0.342, 2);
    expect(a.estimation!.r2!).toBeGreaterThan(0.9);
    expect(a.orientations.map((o) => o.title)).toEqual(expect.arrayContaining(["Variables stationnaires", "Diagnostics satisfaisants"]));
  });

  it("verdicts : les deux hypothèses sont compatibles avec les données, en langage prudent", () => {
    expect(results.map((r) => r.verdict)).toEqual(["supported", "supported"]);
    expect(results[0].reading).toMatch(/^Une hausse d'un point de croissance de la masse monétaire M2 est associée à une hausse de 0,4[78] point de pourcentage de taux d'inflation \(IPC\)/);
    // Les énoncés d'hypothèses cités entre guillemets sont les mots de l'étudiant : seules les phrases d'ACADIA sont contrôlées.
    const texts = [...results.flatMap((r) => [r.reading ?? "", ...r.supports, ...r.limits]), ...chapter.flatMap((s) => s.paragraphs).filter((p) => !/^Hypothèse \d+ : « /.test(p))];
    expect(checkCausality(texts.map((text, i) => ({ field: String(i), text })))).toEqual([]);
    expect(texts.join(" ")).not.toMatch(/prouv[ée]e?s? (que|l'effet)/i);
  });

  it("chapitre : six sections dans l'ordre, chacune avec son but et son contenu", () => {
    expect(chapter.map((s) => s.id)).toEqual(["donnees", "stationnarite", "estimation", "validation", "interpretation", "conclusion"]);
    expect(chapter.every((s) => s.purpose && s.contents.length && s.paragraphs.length)).toBe(true);
    expect(chapter[0].paragraphs[0]).toMatch(/2001-2024, soit 24 observations annuelles.*FICTIVES/);
  });

  it("rapports Word et Excel : tableaux, courbes et mention des données fictives", () => {
    const input = { dataset, models, analyses, results, chapter, title: DEMO_RESEARCH.title, mainQuestion: DEMO_RESEARCH.mainQuestion };
    const doc = econDocument(input);
    expect(doc.blocks.filter((b) => b.type === "chart").length).toBeGreaterThanOrEqual(3);
    expect(doc.blocks.some((b) => b.type === "warn" && /FICTIVES/.test(b.text))).toBe(true);
    const xml = strFromU8(unzipSync(buildDocx(doc))["word/document.xml"]);
    expect(xml).toContain("Étude de la stationnarité des séries");
    expect(xml).toContain("Préparer la soutenance");
    const sheets = econSheets(input);
    expect(sheets.map((s) => s.name)).toEqual(expect.arrayContaining(["Données", "Statistiques", "Agrégats", "Stationnarité", "Hypothèses", "Soutenance", "Lexique"]));
    expect(unzipSync(buildWorkbook(sheets))["xl/workbook.xml"]).toBeTruthy();
  });

  it("instantané enregistrable", () => {
    const snap = { engine: "econometrie", version: 1, field: { domain: "economics", specialty: "monetary_banking", secondary: [] }, fieldConfirmed: true, source: "demo", dataset, datasetConfirmedKey: "k", presentationSeenKey: null, research: null, framingConfirmedKey: null, mappings, modelSettings: { [models[0].key]: { transform: "niveau", controls: [] } }, modelConfirmedKey: null, reasoningSeenKey: null, chapterKey: null, view: null };
    expect(econSnapshotSchema.safeParse(snap).success).toBe(true);
    expect(payloadSchemaFor("econometrie").safeParse(snap).success).toBe(true);
  });
});

describe("import d'un tableau de séries", () => {
  it("périodes en lignes, nombres à la française, rôles et unités", () => {
    const r = datasetFromTable(["Année", "PIB réel (milliards CDF)", "Taux d'inflation (%)"], [[2003, "1 200,5", "12,1"], [2001, "1 000", "9"], [2002, "1 100", "n.d."]], "series.xlsx");
    expect(r.errors).toEqual([]);
    expect(r.dataset?.periods).toEqual(["2001", "2002", "2003"]);
    expect(r.dataset?.series.map((s) => [s.name, s.unit, s.role, s.values])).toEqual([["PIB réel", "milliards CDF", "pib_reel", [1000, 1100, 1200.5]], ["Taux d'inflation", "%", "inflation", [9, null, 12.1]]]);
    expect(r.notes.join(" ")).toMatch(/ordre chronologique/);
  });

  it("périodes en colonnes (présentation des rapports de la banque centrale) : transposition", () => {
    const r = datasetFromTable(["Indicateur", "2020", "2021", "2022"], [["Masse monétaire M2", 10, 12, 15], ["Taux de change", 1850, 1990, 2010]], "bcc.csv");
    expect(r.dataset?.periods).toEqual(["2020", "2021", "2022"]);
    expect(r.dataset?.series.map((s) => s.role)).toEqual(["m2", "taux_change"]);
    expect(r.notes[0]).toMatch(/transposé/);
  });

  it("trimestres reconnus ; tableau sans périodes refusé avec une explication", () => {
    expect(datasetFromTable(["Trimestre", "IPC"], [["2020T1", 100], ["2020T2", 102], ["2020T3", 104]], "t.csv").dataset?.frequency).toBe("trimestrielle");
    expect(datasetFromTable(["Nom", "Valeur"], [["a", 1], ["b", 2], ["c", 3]], "x.csv").errors[0]).toMatch(/colonne de périodes/);
  });
});
