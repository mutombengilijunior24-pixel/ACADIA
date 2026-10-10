import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { addOperation, createPreparation } from "@/lib/core/data/preparation";
import { profileDataset } from "@/lib/core/data/profile";
import type { PreparationState } from "@/lib/core/data/types";
import { buildUnderstanding } from "@/lib/core/data/understanding";
import { renderHtml } from "@/lib/core/export/document";
import { buildDocx } from "@/lib/core/export/docx";
import { journeyDocument, journeySheets } from "@/lib/core/export/reports";
import { buildWorkbook } from "@/lib/core/export/xlsx";
import {
  analyzeStructure,
  buildCartography,
  buildInterpretation,
  buildPlan,
  coverObjectives,
  diagnoseData,
  emptyMappingDecisions,
  emptyPlanDecisions,
  executePlan,
  journeySteps,
  linkQuestions,
  populationGaps,
  STAGES,
  STEP_ORDER,
  type MappingDecisions,
} from "@/lib/core/journey";
import { buildUnderstandingReport, validateResearchInput } from "@/lib/core/understanding";

import { importOk } from "../data/helpers";

// Fichier SYNTHÉTIQUE du parcours (credit-50) complété d'une colonne « Sexe » : 45 « Femme », 5 « Homme ».
const QUESTION = "La disponibilité d'une garantie est-elle associée au résultat de la dernière demande de crédit des entrepreneures ?";
const GUARANTEE = 11;
const RESULT = 12;
const REASON = 13;
const SEX = 15;
const MEN = ["S1003", "S1010", "S1017", "S1030", "S1044"];

function withSex(): string {
  const lines = readFileSync("tests/fixtures/acadia-parcours-credit-50.csv", "utf8").split("\n");
  return lines.map((line, i) => (!line.trim() ? line : i === 0 ? `${line};"Sexe"` : `${line};"${MEN.some((id) => line.startsWith(`"${id}"`)) ? "Homme" : "Femme"}"`)).join("\n");
}

const RESEARCH = {
  title: "Disponibilité d'une garantie et résultat de la dernière demande de crédit des femmes entrepreneures de Lubumbashi",
  mainQuestion: QUESTION,
  problem: "Les femmes entrepreneures se voient souvent refuser des crédits.",
  generalObjective: "Examiner la relation entre la disponibilité d'une garantie et le résultat de la dernière demande de crédit.",
  // Texte collé depuis un tableau : les objectifs sont séparés par des balises <br>.
  specificObjectives: ["Décrire la disponibilité d'une garantie chez les entrepreneures.<br>Décrire le résultat de la dernière demande de crédit.<br>Identifier les principales raisons de refus de crédit."],
  hypotheses: ["La disponibilité d'une garantie est associée au résultat de la dernière demande de crédit."],
  population: "Femmes entrepreneures des marchés de Lubumbashi",
};

async function load(extra: (p: PreparationState) => PreparationState = (p) => p) {
  const dataset = await importOk("credit-sexe.csv", new TextEncoder().encode(withSex()));
  let preparation = createPreparation(dataset);
  for (const column of [GUARANTEE, RESULT, REASON]) preparation = addOperation(preparation, { type: "set_statistical_type", column, statisticalType: "nominal" });
  preparation = extra(preparation);
  const profile = profileDataset(dataset, preparation);
  const { variables } = buildUnderstanding({ dataset, profile, preparation });
  const structure = analyzeStructure(dataset, profile, variables);
  const validation = validateResearchInput(RESEARCH);
  if (!validation.ok) throw new Error("recherche");
  const input = validation.input;
  const report = buildUnderstandingReport(input);
  const run = (decisions: MappingDecisions = emptyMappingDecisions()) => {
    const cartography = buildCartography({ report, structure, questions: [], links: linkQuestions([], structure), decisions });
    const plan = buildPlan({ report, cartography, structure, dataset, preparation, variables, instrument: "questionnaire", mainQuestion: QUESTION });
    const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset, preparation, variables, alpha: 0.05, independenceConfirmed: true, key: "k" });
    const gaps = populationGaps({ population: input.population, dataset, preparation, structure });
    const interpretation = buildInterpretation(execution, plan, report, QUESTION, { problem: input.problem, generalObjective: input.generalObjective, specificObjectives: input.specificObjectives }, { provenance: { kind: "synthetic_test", description: "" }, populationGaps: gaps });
    return { cartography, plan, execution, interpretation, gaps };
  };
  return { dataset, preparation, profile, variables, structure, input, report, run };
}

describe("Texte collé avec des balises HTML", () => {
  it("les <br> deviennent des sauts de ligne : un objectif par ligne, aucune balise conservée", () => {
    const v = validateResearchInput({ ...RESEARCH, problem: "Premier constat.<br/>Second constat.", title: "Garantie <b>et</b> crédit" });
    if (!v.ok) throw new Error("validation");
    expect(v.input.specificObjectives).toEqual(["Décrire la disponibilité d'une garantie chez les entrepreneures.", "Décrire le résultat de la dernière demande de crédit.", "Identifier les principales raisons de refus de crédit."]);
    expect(v.input.problem).toBe("Premier constat.\nSecond constat.");
    expect(v.input.title).toBe("Garantie et crédit");
  });

  it("aucun export (Word, HTML/PDF, Excel) ne recopie de balise en texte", () => {
    const doc = { title: "t", blocks: [{ type: "p" as const, text: "Ligne 1<br>Ligne 2" }, { type: "table" as const, head: ["Objectif"], rows: [["A<br>B"]] }, { type: "bullets" as const, items: ["x<br/>y"] }] };
    const xml = strFromU8(unzipSync(buildDocx(doc))["word/document.xml"]);
    expect(xml).not.toContain("&lt;br");
    expect(xml).toContain("<w:t xml:space=\"preserve\">Ligne 1</w:t><w:br/><w:t xml:space=\"preserve\">Ligne 2</w:t>");
    const html = renderHtml(doc);
    expect(html).not.toContain("&lt;br");
    expect(html).toContain("Ligne 1<br>Ligne 2");
    const sheet = strFromU8(unzipSync(buildWorkbook([{ name: "S", rows: [["A<br>B"]] }]))["xl/worksheets/sheet1.xml"]);
    expect(sheet).not.toContain("&lt;br");
    expect(sheet).toContain("A\nB");
  });
});

describe("Objectifs : couverture réelle par les analyses", () => {
  it("un objectif n'est « examiné » que si un test porte sur ses concepts", () => {
    const analyses = [
      { title: "Décrire « Disponibilité d'une garantie »", level: "descriptive" as const, variables: [{ name: "Disponibilité d'une garantie", header: "Disposez-vous d'une garantie ?" }] },
      { title: "Relation garantie × résultat", level: "relation" as const, variables: [{ name: "Disponibilité d'une garantie", header: "Disposez-vous d'une garantie ?" }, { name: "Résultat de la dernière demande de crédit", header: "Résultat de la demande ?" }], verdict: "association significative (p < 0,001)" },
    ];
    const concepts = ["Disponibilité d'une garantie", "Résultat de la dernière demande de crédit", "Principales raisons de refus de crédit"];
    const [general, describe1, reasons, relationOnlyDescribed] = coverObjectives(
      [
        { text: "Examiner la relation entre la disponibilité d'une garantie et le résultat de la dernière demande de crédit.", kind: "général" },
        { text: "Décrire la disponibilité d'une garantie chez les entrepreneures.", kind: "spécifique" },
        { text: "Identifier les principales raisons de refus de crédit.", kind: "spécifique" },
        { text: "Examiner l'effet de la disponibilité d'une garantie sur le montant obtenu.", kind: "spécifique" },
      ],
      analyses.slice(0, 2),
      concepts,
    );
    expect(general.status).toBe("tested");
    expect(describe1.status).toBe("described");
    expect(reasons).toMatchObject({ status: "not_addressed", missing: ["Principales raisons de refus de crédit"] });
    expect(reasons.detail).toContain("« Principales raisons de refus de crédit » ne fait l'objet d'aucune analyse");
    // Objectif relationnel dont un seul concept est analysé : jamais « examiné ».
    expect(relationOnlyDescribed.status).not.toBe("tested");
  });

  it("parcours complet : les trois objectifs collés sont distincts ; les raisons de refus non couvertes sont signalées", async () => {
    const { run, report } = await load();
    const reasons = report.variables.find((v) => /raison/i.test(v.name));
    expect(reasons).toBeDefined();
    // L'utilisateur ne relie aucune question aux raisons de refus.
    const { interpretation } = run({ concepts: { [reasons!.key]: { unitId: null, confirmed: true } }, unitRoles: {} });
    const objectives = interpretation.framework.objectives;
    expect(objectives.map((o) => o.kind)).toEqual(["général", "spécifique", "spécifique", "spécifique"]);
    expect(objectives[0].status).toBe("tested");
    expect(objectives[1].status).toBe("described");
    expect(objectives[3]).toMatchObject({ status: "not_addressed" });
    expect(interpretation.limits.join(" ")).toContain("Objectif spécifique « Identifier les principales raisons de refus de crédit. » : non couvert par les analyses.");
    const xml = strFromU8(unzipSync(buildDocx(journeyDocument({ question: QUESTION, execution: run().execution, interpretation })))["word/document.xml"]);
    expect(xml).not.toContain("&lt;br");
    expect(xml).toContain("Non couvert par les analyses");
  });

  it("quand la question des raisons est reliée et décrite, l'objectif est « décrit »", async () => {
    const { run } = await load();
    const { interpretation } = run();
    const reasons = interpretation.framework.objectives.find((o) => o.text.startsWith("Identifier"));
    expect(reasons?.status).toBe("described");
  });
});

describe("Population ciblée et échantillon observé", () => {
  it("signale les répondants hors population sans les exclure", async () => {
    const { dataset, preparation, profile, structure, variables, input, run } = await load();
    const gaps = populationGaps({ population: input.population, dataset, preparation, structure });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ column: SEX, count: 5, unexpected: [{ value: "Homme", count: 5 }], expected: "des femmes" });
    expect(gaps[0].message).toContain("Ils n'ont pas été exclus");
    const diagnosis = diagnoseData(dataset, preparation, profile, structure, variables, { populationGaps: gaps });
    const item = diagnosis.items.find((i) => i.id === "population-population-sexe")!;
    expect(item).toMatchObject({ level: "decision", action: { type: "exclude_rows", rows: gaps[0].rows } });
    expect(diagnosis.rowsUsed).toBe(50);
    const { interpretation, execution } = run();
    expect(interpretation.limits).toContain(gaps[0].message);
    const relation = execution.items.find((e) => e.kind === "relation");
    expect(relation?.kind === "relation" && relation.outcome.ok && relation.outcome.report.data.n).toBe(50);
  });

  it("après exclusion explicite par l'utilisateur, l'écart disparaît ; sans population sexuée, aucun signal", async () => {
    const first = await load();
    const rows = populationGaps({ population: first.input.population, dataset: first.dataset, preparation: first.preparation, structure: first.structure })[0].rows;
    const excluded = await load((p) => addOperation(p, { type: "exclude_rows", rows, reason: "hors population" }));
    expect(populationGaps({ population: excluded.input.population, dataset: excluded.dataset, preparation: excluded.preparation, structure: excluded.structure })).toEqual([]);
    expect(populationGaps({ population: "Entrepreneurs des marchés de Lubumbashi", dataset: first.dataset, preparation: first.preparation, structure: first.structure })).toEqual([]);
  });
});

describe("Cohérence des chiffres entre l'interface et les exports", () => {
  it("χ², p exacte et V de Cramér identiques dans le rapport, le Word, le HTML (PDF) et l'Excel", async () => {
    const { run } = await load();
    const { execution, interpretation } = run();
    const relation = execution.items.find((e) => e.kind === "relation");
    if (relation?.kind !== "relation" || !relation.outcome.ok) throw new Error("non calculé");
    const ui = Object.fromEntries(relation.outcome.report.results.map((r) => [r.label, r.value]));
    const chi = ui["χ² (Pearson, sans correction de continuité)"];
    const p = ui["p-value"];
    expect(chi).toBe("11,688");
    expect(p).toContain("0,000629");
    const doc = journeyDocument({ question: QUESTION, execution, interpretation });
    const xml = strFromU8(unzipSync(buildDocx(doc))["word/document.xml"]);
    const html = renderHtml(doc);
    const xlsx = unzipSync(buildWorkbook(journeySheets({ question: QUESTION, execution, interpretation })));
    const sheets = Object.keys(xlsx).filter((k) => k.startsWith("xl/worksheets/sheet")).map((k) => strFromU8(xlsx[k])).join("");
    for (const text of [xml, html, sheets]) {
      expect(text).toContain("11,688");
      expect(text).toContain("0,000629");
      expect(text).toContain("0,483");
    }
  });
});

describe("Parcours en six étapes visibles", () => {
  it("Domaine → Sujet → Données → Vérification → Plan → Résultats, avec sous-étapes internes", () => {
    expect(STAGES.map((s) => s.label)).toEqual(["Mon domaine et ma spécialité", "Mon sujet de recherche", "Mes données", "Vérification des données", "Plan d'analyse proposé", "Résultats et interprétation"]);
    expect(STAGES.flatMap((s) => s.steps)).toEqual(STEP_ORDER);
    const done = journeySteps({ domain: true, research: true, instrument: true, data: true, quality: true, mapping: "confirmed", plan: "validated", results: "fresh" });
    expect(done.stages.every((s) => s.state === "done")).toBe(true);
    expect(done.nextAction).toContain("téléchargez le rapport");
    const partial = journeySteps({ domain: true, research: true, instrument: true, data: false, quality: false, mapping: "none", plan: "none", results: "none" });
    expect(partial.current).toBe("data");
    expect(partial.stages.find((s) => s.id === "data")?.state).toBe("current");
    expect(partial.stages.find((s) => s.id === "verification")?.state).toBe("todo");
    const start = journeySteps({ domain: false, research: false, instrument: false, data: false, quality: false, mapping: "none", plan: "none", results: "none" });
    expect(start.current).toBe("domain");
  });
});
