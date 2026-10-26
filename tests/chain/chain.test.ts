import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { addOperation, createPreparation } from "@/lib/core/data/preparation";
import { profileDataset } from "@/lib/core/data/profile";
import { buildUnderstanding } from "@/lib/core/data/understanding";
import { assessChain, buildChain, buildChainPlan, CHAIN_LIMITS, holmAdjust, interpretChain, type ChainDecisions } from "@/lib/core/chain";
import { chainJourneyDocument, chainJourneySheets } from "@/lib/core/export/chainReports";
import { buildDocx } from "@/lib/core/export/docx";
import { renderHtml } from "@/lib/core/export/document";
import { buildWorkbook } from "@/lib/core/export/xlsx";
import { analyzeStructure, buildCartography, buildInterpretation, emptyMappingDecisions, emptyPlanDecisions, executePlan, itemStatus, linkQuestions } from "@/lib/core/journey";
import { buildUnderstandingReport, validateResearchInput } from "@/lib/core/understanding";

import { importOk } from "../data/helpers";

// Fichier SYNTHÉTIQUE du parcours (crédit, 50 répondantes) : garantie (col. 11), résultat (12), raison du refus (13).
const GUARANTEE = 11;
const RESULT = 12;
const REASON = 13;
const MAIN = "La disponibilité d'une garantie est-elle associée au résultat de la dernière demande de crédit ?";

const RESEARCH = {
  title: "Garantie et accès au crédit des femmes entrepreneures de Lubumbashi",
  mainQuestion: MAIN,
  problem: "Les femmes entrepreneures se voient souvent refuser des crédits, et l'absence de garantie est avancée comme explication.",
  // Ordre volontairement différent de celui des objectifs.
  specificQuestions: ["La disponibilité d'une garantie influence-t-elle le résultat de la dernière demande de crédit ?", "Quel est le niveau de disponibilité des garanties chez les entrepreneures ?"],
  generalObjective: "Examiner la relation entre la disponibilité d'une garantie et le résultat de la dernière demande de crédit.",
  specificObjectives: ["Décrire la disponibilité des garanties chez les entrepreneures.", "Analyser l'influence de la disponibilité d'une garantie sur le résultat de la demande de crédit."],
  hypotheses: ["La disponibilité d'une garantie influence positivement le résultat de la dernière demande de crédit."],
  population: "Femmes entrepreneures",
};

async function load(research: Record<string, unknown> = RESEARCH, decisions?: ChainDecisions) {
  const dataset = await importOk("credit.csv", new Uint8Array(readFileSync("tests/fixtures/acadia-parcours-credit-50.csv")));
  let preparation = createPreparation(dataset);
  for (const column of [3, 4, 8, 14, GUARANTEE, RESULT, REASON]) preparation = addOperation(preparation, { type: "set_statistical_type", column, statisticalType: "nominal" });
  const profile = profileDataset(dataset, preparation);
  const { variables } = buildUnderstanding({ dataset, profile, preparation });
  const structure = analyzeStructure(dataset, profile, variables);
  const v = validateResearchInput(research);
  if (!v.ok) throw new Error("recherche invalide");
  const report = buildUnderstandingReport(v.input);
  const cartography = buildCartography({ report, structure, questions: [], links: linkQuestions([], structure), decisions: emptyMappingDecisions() });
  const chain = buildChain({ research: v.input, report, structure, cartography, decisions });
  return { dataset, preparation, variables, structure, input: v.input, report, cartography, chain };
}

describe("Chaîne de cohérence : questions → objectifs → hypothèses → variables", () => {
  it("relie chaque question à l'objectif qui lui correspond, même dans un ordre différent, et y rattache l'hypothèse", async () => {
    const { chain } = await load();
    const [describeRow, relationRow] = [...chain.rows].sort((a, b) => Number(a.descriptive === false) - Number(b.descriptive === false));
    expect(describeRow).toMatchObject({ questionId: "q2", objectiveId: "o1", hypothesisId: null, descriptive: true });
    expect(relationRow).toMatchObject({ questionId: "q1", objectiveId: "o2", hypothesisId: "h1", descriptive: false });
    expect(relationRow.independent.length).toBe(1);
    expect(relationRow.dependent.length).toBe(1);
    expect(relationRow.reasons.join(" ")).toContain("mots communs");
  });

  it("propose une hypothèse (à valider) quand le chercheur n'en a écrit aucune", async () => {
    const { chain } = await load({ ...RESEARCH, hypotheses: [] });
    const proposed = chain.statements.filter((s) => s.kind === "hypothesis");
    expect(proposed.length).toBeGreaterThan(0);
    expect(proposed.every((s) => s.origin === "engine")).toBe(true);
    expect(chain.rows.find((r) => r.hypothesisId)?.reasons.join(" ")).toContain("proposée par ACADIA");
  });

  it("les corrections de l'utilisateur l'emportent sur l'appariement proposé", async () => {
    const first = await load();
    const row = first.chain.rows.find((r) => r.hypothesisId === "h1")!;
    const { chain } = await load(RESEARCH, { rows: { [row.id]: { hypothesisId: null, confirmed: true } }, assignments: {} });
    expect(chain.rows.find((r) => r.id === row.id)).toMatchObject({ hypothesisId: null, status: "confirmed" });
  });
});

describe("Matrice de cohérence : ce que mesure chaque question du questionnaire", () => {
  it("garantie → VI, résultat → VD, marché, âge, études, ancienneté → profil ; colonnes techniques ignorées", async () => {
    const { chain } = await load();
    const of = (column: number) => chain.assignments.find((a) => a.unitId === `col:${column}`)!;
    expect(of(GUARANTEE).side).toBe("independent");
    expect(of(RESULT).side).toBe("dependent");
    for (const column of [3, 4, 8, 14]) expect(of(column).side).toBe("profile");
    expect(chain.assignments.some((a) => a.unitId === "col:0")).toBe(false);
    expect(chain.assignments.every((a) => a.reason.length > 0)).toBe(true);
  });

  it("une variable peut être mesurée par plusieurs questions ; le choix de l'utilisateur l'emporte", async () => {
    const first = await load();
    const result = first.chain.variables.find((v) => v.side === "dependent")!;
    const { chain } = await load(RESEARCH, { rows: {}, assignments: { [`col:${REASON}`]: { side: "dependent", variableKey: result.key }, "col:4": { side: "other", variableKey: null } } });
    expect(chain.assignments.filter((a) => a.variableKey === result.key).map((a) => a.unitId)).toEqual(expect.arrayContaining([`col:${RESULT}`, `col:${REASON}`]));
    expect(chain.assignments.find((a) => a.unitId === "col:4")).toMatchObject({ side: "other", origin: "user" });
  });
});

describe("Plan, calculs et interprétation fondés sur la chaîne", () => {
  async function run() {
    const ctx = await load();
    const plan = buildChainPlan({ chain: ctx.chain, report: ctx.report, cartography: ctx.cartography, structure: ctx.structure, dataset: ctx.dataset, preparation: ctx.preparation, variables: ctx.variables, instrument: "questionnaire", mainQuestion: MAIN });
    const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset: ctx.dataset, preparation: ctx.preparation, variables: ctx.variables, alpha: 0.05, independenceConfirmed: true, key: "k", structural: { [REASON]: ["Non concernée"] } });
    const assessments = assessChain(ctx.chain, execution);
    const chainInterpretation = interpretChain(ctx.chain, execution, assessments, MAIN);
    const interpretation = buildInterpretation(execution, plan, ctx.report, MAIN, undefined, { provenance: { kind: "synthetic_test", description: "" } });
    return { ...ctx, plan, execution, assessments, chainInterpretation, interpretation };
  }

  it("chaque question du questionnaire devient un tableau ; les questions de la VI sont croisées avec celles de la VD", async () => {
    const { plan, chain, execution } = await run();
    const descriptive = plan.items.filter((i) => i.level === "descriptive");
    expect(descriptive.map((i) => i.chain?.unitId).sort()).toEqual(chain.assignments.map((a) => a.unitId).sort());
    expect(execution.items.filter((e) => e.kind === "descriptive").every((e) => e.kind === "descriptive" && e.results.length === 1)).toBe(true);
    const crossings = plan.items.filter((i) => i.level === "relation");
    expect(crossings.map((i) => i.id)).toContain(`cross:h1:col:${GUARANTEE}>col:${RESULT}`);
    expect(crossings.every((i) => i.method === "chi_square" && itemStatus(i, emptyPlanDecisions()) === "accepted")).toBe(true);
    expect(crossings.find((i) => i.id === `cross:h1:col:${GUARANTEE}>col:${RESULT}`)?.tier).toBe("main");
  });

  it("hypothèse évaluée sur tous ses croisements, avec Holm et Fisher ; jamais « prouvée »", async () => {
    const { assessments } = await run();
    expect(assessments).toHaveLength(1);
    const a = assessments[0];
    const principal = a.crossings.find((c) => c.dvUnitId === `col:${RESULT}`)!;
    expect(principal.statistic).toContain("11,688");
    expect(principal.p).toBeCloseTo(0.000629, 6);
    expect(principal.pAdjusted).toBeCloseTo(Math.min(1, principal.p! * a.tests), 10);
    expect(principal.significant).toBe(true);
    expect(["supported", "partially_supported"]).toContain(a.verdict);
    expect(JSON.stringify(a)).not.toMatch(/prouvée(?! \))/);
  });

  it("l'interprétation relie chaque résultat à sa question, son objectif et son hypothèse", async () => {
    const { chainInterpretation } = await run();
    const hypothesisRow = chainInterpretation.rows.find((r) => r.kind === "hypothesis")!;
    const text = hypothesisRow.paragraphs.map((p) => p.text).join(" ");
    expect(text).toContain("la question de recherche");
    expect(text).toContain("l'objectif");
    expect(text).toContain("Ce qui rapproche les données de l'hypothèse");
    expect(text).toContain("ne démontre pas");
    const descriptiveRow = chainInterpretation.rows.find((r) => r.kind === "descriptive")!;
    expect(descriptiveRow.paragraphs.some((p) => p.origin === "calcul")).toBe(true);
    expect(chainInterpretation.mainAnswer[0].text).toContain(MAIN);
  });

  it("le rapport suit la chaîne : matrice, Partie 1 descriptive, Partie 2 inférentielle, Partie 3 interprétation ; mêmes chiffres partout", async () => {
    const ctx = await run();
    const input = { question: MAIN, execution: ctx.execution, interpretation: ctx.interpretation, chain: ctx.chain, assessments: ctx.assessments, chainInterpretation: ctx.chainInterpretation };
    const doc = chainJourneyDocument(input);
    const headings = doc.blocks.filter((b) => b.type === "h1").map((b) => (b.type === "h1" ? b.text : ""));
    expect(headings.slice(0, 4)).toEqual(["Cadre de la recherche et matrice de cohérence", "Partie 1 — Interprétation descriptive", "Partie 2 — Statistique inférentielle", "Partie 3 — Interprétation"]);
    // Un graphique par question décrite (au moins) dans la partie descriptive.
    const part1 = doc.blocks.slice(doc.blocks.findIndex((b) => b.type === "h1" && b.text.startsWith("Partie 1")), doc.blocks.findIndex((b) => b.type === "h1" && b.text.startsWith("Partie 2")));
    expect(part1.filter((b) => b.type === "chart").length).toBe(ctx.execution.items.filter((e) => e.kind === "descriptive").length);
    const xml = strFromU8(unzipSync(buildDocx(doc))["word/document.xml"]);
    const html = renderHtml(doc);
    const book = unzipSync(buildWorkbook(chainJourneySheets(input)));
    const workbook = Object.keys(book).filter((k) => k.startsWith("xl/")).map((k) => strFromU8(book[k])).join("");
    for (const text of [xml, html, workbook]) {
      expect(text).toContain("11,688");
      expect(text).toContain("atrice de cohérence");
    }
    expect(workbook).toContain("Croisements");
  });
});

describe("Ajustement de Holm et plafonds", () => {
  it("valeurs de référence", () => {
    expect(holmAdjust([0.01, 0.04, 0.03]).map((p) => Number(p.toFixed(6)))).toEqual([0.03, 0.06, 0.06]);
    expect(holmAdjust([0.5, 0.9])).toEqual([1, 1]);
    expect(holmAdjust([])).toEqual([]);
  });
  it("plafonds raisonnables du nombre de croisements", () => {
    expect(CHAIN_LIMITS.perHypothesis).toBeLessThanOrEqual(CHAIN_LIMITS.ivUnits * CHAIN_LIMITS.dvUnits);
    expect(CHAIN_LIMITS.total).toBeGreaterThanOrEqual(CHAIN_LIMITS.perHypothesis);
  });
});
