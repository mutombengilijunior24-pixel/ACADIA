import { describe, expect, it } from "vitest";

import { addOperation, createPreparation } from "@/lib/core/data/preparation";
import { profileDataset } from "@/lib/core/data/profile";
import type { PreparationOperation, PreparationState, StatisticalType } from "@/lib/core/data/types";
import { buildUnderstanding } from "@/lib/core/data/understanding";
import {
  analyzeStructure,
  buildCartography,
  buildInterpretation,
  buildPlan,
  diagnoseData,
  emptyMappingDecisions,
  emptyPlanDecisions,
  executePlan,
  journeySteps,
  linkQuestions,
  parseQuestionnaire,
  splitGlued,
  tokenSimilarity,
  type MappingDecisions,
} from "@/lib/core/journey";
import { buildUnderstandingReport, validateResearchInput } from "@/lib/core/understanding";

import { importOk, utf8 } from "../data/helpers";

// Fichier SYNTHÉTIQUE construit sur le modèle d'un export de formulaire en ligne :
// en-têtes avec fautes de frappe, titre de section collé, colonnes vrai/faux par option,
// métadonnées techniques. Les effectifs sont choisis pour des résultats calculables à la main.

const HEADERS = [
  "Submission ID",
  "Respondent ID",
  "Submitted at",
  "Niveau d'études",
  "Dans quelle commune ou quel grand marché exercez-vous prncipalement votre activité ?",
  "Dans quelle commune ou quel grand marché exercez-vous prncipalement votre activité ? (Marché Mzee)",
  "Dans quelle commune ou quel grand marché exercez-vous prncipalement votre activité ? (Marché de la Kenya)",
  "Dans quelle commune ou quel grand marché exercez-vous prncipalement votre activité ? (Autre lieu)",
  "Quelle est votre tranche d'âge ?",
  "Quelle est votre tranche d'âge ? (Moins de 25 ans)",
  "Quelle est votre tranche d'âge ? (De 25 - 40 ans)",
  "Disposez-vous d'une garentie pour obtenir un crédits",
  "IV. RATIONNEMENT DU CREDITQuel a été le résultat de votre dernière demande de crédit ?",
  "Si votre crédit a été refusé ou reduit, quellle était la principale raison ?",
  "Ancienneté dans l’activité",
];

const MARKETS = ["Marché Mzee", "Marché de la Kenya", "Autre lieu"];
const AGES = ["Moins de 25 ans", "De 25 - 40 ans"];

/** cells : [garantie, résultat, effectif]. Les autres colonnes varient de façon déterministe. */
function rowsFor(cells: Array<[string, string, number]>): string[][] {
  const rows: string[][] = [];
  let i = 0;
  for (const [guarantee, result, n] of cells) {
    for (let k = 0; k < n; k += 1) {
      const market = MARKETS[i % 3];
      const age = AGES[i % 2];
      rows.push([
        `S${1000 + i}`,
        `R${2000 + i}`,
        `2025-03-${String((i % 28) + 1).padStart(2, "0")} 10:${String(i % 60).padStart(2, "0")}`,
        ["○ Primaire", "○ Secondaire", "○ Universitaire"][i % 3],
        market,
        ...MARKETS.map((m) => String(m === market)),
        age,
        ...AGES.map((a) => String(a === age)),
        guarantee,
        result,
        result === "Crédit refusé" ? (i % 2 ? "Manque de guarentie" : "Revenus jugés insufisant") : "Non concernée",
        ["□ Moins de 1 an", "□ 1 à 3 ans", "□ 4 à 6 ans"][i % 3],
      ]);
      i += 1;
    }
  }
  return rows;
}

type Op = PreparationOperation extends infer T ? (T extends PreparationOperation ? Omit<T, "id" | "at"> : never) : never;

const QUESTION = "La disponibilité d'une garantie est-elle associée au résultat de la dernière demande de crédit des entrepreneures ?";
const RESEARCH = {
  title: QUESTION,
  mainQuestion: QUESTION,
  hypotheses: ["La disponibilité d'une garantie est associée au résultat de la dernière demande de crédit."],
  population: "Femmes entrepreneures membres de tontines",
  field: "Lubumbashi",
};

async function setup(cells: Array<[string, string, number]>, ops: (c: (h: string) => number) => Op[] = () => []) {
  const csv = [HEADERS, ...rowsFor(cells)].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n") + "\n";
  const dataset = await importOk("enquete.csv", utf8(csv));
  const column = (h: string) => dataset.columns.findIndex((c) => c.originalHeader === h);
  let preparation: PreparationState = createPreparation(dataset);
  for (const op of ops(column)) preparation = addOperation(preparation, op);
  const profile = profileDataset(dataset, preparation);
  const { variables } = buildUnderstanding({ dataset, profile, preparation });
  const structure = analyzeStructure(dataset, profile, variables);
  const validation = validateResearchInput(RESEARCH);
  if (!validation.ok) throw new Error("recherche invalide");
  const report = buildUnderstandingReport(validation.input);
  const map = (decisions: MappingDecisions = emptyMappingDecisions(), questionnaire = "") => {
    const questions = parseQuestionnaire(questionnaire);
    return buildCartography({ report, structure, questions, links: linkQuestions(questions, structure), decisions });
  };
  return { dataset, preparation, profile, variables, structure, report, column, map };
}

const nominal = (column: number, statisticalType: StatisticalType = "nominal"): Op => ({ type: "set_statistical_type", column, statisticalType });
const GUARANTEE = HEADERS[11];
const RESULT = HEADERS[12];
const MARKET = HEADERS[4];

// 2 × 2 : garantie (oui/non) × résultat (obtenu/refusé) — tous les effectifs attendus ≥ 5.
const RELIABLE: Array<[string, string, number]> = [
  ["oui", "Crédit obtenu", 20],
  ["oui", "Crédit refusé", 5],
  ["non", "Crédit obtenu", 8],
  ["non", "Crédit refusé", 17],
];

describe("Rapprochement de textes réels", () => {
  it("tolère les fautes de frappe et sépare un titre de section collé", () => {
    expect(splitGlued("IV. RATIONNEMENT DU CREDITQuel a été le résultat")).toBe("IV. RATIONNEMENT DU CREDIT Quel a été le résultat");
    expect(tokenSimilarity("garanti", "garenti")).toBe(0.85);
    expect(tokenSimilarity("credit", "marche")).toBe(0);
  });
});

describe("Structure du fichier", () => {
  it("reconnaît métadonnées techniques, colonnes vrai/faux d'options et questions", async () => {
    const { structure } = await setup(RELIABLE);
    const kinds = Object.fromEntries(structure.columns.map((c) => [c.header, c.kind]));
    expect(kinds["Submission ID"]).toBe("technical");
    expect(kinds["Respondent ID"]).toBe("technical");
    expect(kinds["Submitted at"]).toBe("technical");
    expect(kinds[HEADERS[5]]).toBe("option_of");
    expect(kinds[HEADERS[9]]).toBe("option_of");
    expect(kinds[MARKET]).toBe("question");
    const market = structure.units.find((u) => u.text.startsWith("Dans quelle commune"))!;
    expect(market).toMatchObject({ kind: "single_with_options", primaryColumn: 4, columns: [4, 5, 6, 7], options: MARKETS });
    const result = structure.units.find((u) => u.primaryColumn === 12)!;
    expect(result.text).toBe("IV. RATIONNEMENT DU CREDIT Quel a été le résultat de votre dernière demande de crédit ?");
    // 15 colonnes → 3 techniques + 5 colonnes d'options = 7 questions.
    expect(structure.units.filter((u) => u.kind !== "technical")).toHaveLength(7);
  });

  it("reconnaît une question à choix multiples sans colonne texte", async () => {
    const csv = "id;Sources de financement (Tontine);Sources de financement (IMF);Sources de financement (Famille);montant\n1;1;0;1;10\n2;0;1;0;20\n3;1;1;0;30\n";
    const dataset = await importOk("a.csv", utf8(csv));
    const preparation = createPreparation(dataset);
    const profile = profileDataset(dataset, preparation);
    const { variables } = buildUnderstanding({ dataset, profile, preparation });
    const structure = analyzeStructure(dataset, profile, variables);
    const group = structure.units.find((u) => u.kind === "multi_choice")!;
    expect(group).toMatchObject({ text: "Sources de financement", primaryColumn: null, columns: [1, 2, 3], options: ["Tontine", "IMF", "Famille"] });
  });
});

describe("Cas de validation : garantie et résultat de la demande de crédit", () => {
  it("identifie les deux concepts et leurs rôles à partir de la question", async () => {
    const { report } = await setup(RELIABLE);
    expect(report.variables.filter((v) => v.group === "central").map((v) => [v.name, v.role])).toEqual([
      ["Disponibilité d'une garantie", "explanatory"],
      ["Résultat de la dernière demande de crédit", "dependent"],
    ]);
    expect(report.relations[0]).toMatchObject({ nature: "association", directed: true });
  });

  it("rapproche chaque concept de la bonne question malgré les fautes ; le marché reste du contexte", async () => {
    const { map } = await setup(RELIABLE);
    const cartography = map();
    const guarantee = cartography.concepts.find((c) => c.name === "Disponibilité d'une garantie")!;
    const result = cartography.concepts.find((c) => c.name === "Résultat de la dernière demande de crédit")!;
    expect(guarantee.unitId).toBe("col:11");
    expect(result.unitId).toBe("col:12");
    expect(guarantee.status).toBe("proposed");
    expect(guarantee.candidates[0].reason).toContain("garenti (≈ garanti)");
    const roles = Object.fromEntries(cartography.units.map((u) => [u.unit.text.slice(0, 30), u.role]));
    expect(roles["Dans quelle commune ou quel gr"]).toBe("context");
    expect(roles["Quelle est votre tranche d'âge"]).toBe("context");
    expect(roles["Niveau d'études"]).toBe("context");
    expect(roles["Submission ID"]).toBe("technical");
    expect(roles["Si votre crédit a été refusé o"]).toBe("other");
    expect(cartography.clarification).toContain("sont-ils corrects");
  });

  it("le plan propose le Chi² entre garantie et résultat — jamais le marché comme variable à expliquer", async () => {
    const { map, report, structure, dataset, preparation, variables } = await setup(RELIABLE, (c) => [nominal(c(GUARANTEE)), nominal(c(RESULT)), nominal(c(MARKET))]);
    const plan = buildPlan({ report, cartography: map(), structure, dataset, preparation, variables, instrument: "questionnaire", mainQuestion: QUESTION });
    const relations = plan.items.filter((i) => i.level === "relation");
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({ method: "chi_square", outcomeColumn: 12, explanatoryColumn: 11, feasible: true, needsIndependence: true, researchQuestion: QUESTION });
    expect(relations[0].hypotheses).toEqual(RESEARCH.hypotheses);
    expect(plan.items.some((i) => i.columns.includes(4) && i.level === "relation")).toBe(false);
    expect(plan.items.map((i) => i.id)).toEqual(["desc:disponibilit-garanti", "desc:resultat-dernier-demand-credit", "rel:disponibilit-garanti>resultat-dernier-demand-credit", "desc:context"]);
    expect(plan.items.find((i) => i.id === "desc:context")?.columns).toEqual([3, 4, 8, 14]);
    expect(plan.final[0]).toContain("sans jamais la prouver");
    expect(plan.unavailable).toContain("Tests pour mesures appariées ou répétées");
  });

  it("exécute le plan validé : χ² exact sur le tableau 2 × 2 et interprétation sur la garantie", async () => {
    const { map, report, structure, dataset, preparation, variables } = await setup(RELIABLE, (c) => [nominal(c(GUARANTEE)), nominal(c(RESULT)), nominal(c(MARKET))]);
    const plan = buildPlan({ report, cartography: map(), structure, dataset, preparation, variables, instrument: "questionnaire", mainQuestion: QUESTION });
    const decisions = { ...emptyPlanDecisions(), status: { "desc:context": "rejected" as const } };
    const execution = executePlan({ plan, decisions, dataset, preparation, variables, alpha: 0.05, independenceConfirmed: true, key: "k" });
    expect(execution.items.map((i) => i.item.id)).toEqual(["desc:disponibilit-garanti", "desc:resultat-dernier-demand-credit", "rel:disponibilit-garanti>resultat-dernier-demand-credit"]);
    const relation = execution.items[2];
    if (relation.kind !== "relation" || !relation.outcome.ok) throw new Error("relation non calculée");
    const { report: test } = relation.outcome;
    if (test.detail.kind !== "chi_square") throw new Error("méthode inattendue");
    expect(test.detail.rowLabels).toEqual(["non", "oui"]);
    expect(test.detail.colLabels).toEqual(["Crédit obtenu", "Crédit refusé"]);
    expect(test.detail.result.observed).toEqual([[8, 17], [20, 5]]);
    // Attendus 14 / 11 partout : χ² = 2 × (36/14 + 36/11).
    expect(test.statistic.value).toBeCloseTo(2 * (36 / 14 + 36 / 11), 12);
    expect(test.effect?.value).toBeCloseTo(Math.sqrt((2 * (36 / 14 + 36 / 11)) / 50), 12);
    expect(test.reliable).toBe(true);
    expect(test.significant).toBe(true);
    const descriptive = execution.items[0];
    expect(descriptive.kind === "descriptive" && descriptive.results[0].valid).toBe(50);

    const interpretation = buildInterpretation(execution, plan, report, QUESTION, undefined, { provenance: { kind: "synthetic_test", description: "" } });
    expect(interpretation.answer[1].text).toContain(`À la question « ${QUESTION} »`);
    expect(interpretation.answer[1].text).toContain("concernant la relation entre « Disponibilité d'une garantie » et « Résultat de la dernière demande de crédit »");
    expect(interpretation.answer[1].text).toContain("association statistiquement significative");
    expect(interpretation.answer.map((p) => p.text).join(" ")).not.toMatch(/march[ée]/i);
    expect(interpretation.hypotheses[0]).toMatchObject({ verdict: "compatible" });
    expect(interpretation.hypotheses[0].detail).toContain("n'est pas pour autant prouvée");
    expect(interpretation.limits.filter((l) => l.includes("cause à effet"))).toHaveLength(1);
    expect(interpretation.data.every((p) => p.origin === "calcul")).toBe(true);
  });

  it("effectifs attendus trop faibles : signalés dès le plan, résultat non fiable, aucune conclusion établie", async () => {
    const small: Array<[string, string, number]> = [
      ["oui", "Crédit obtenu", 6],
      ["oui", "Crédit refusé", 1],
      ["oui", "J'ai abandonné la démande", 1],
      ["non", "Crédit obtenu", 2],
      ["non", "Crédit refusé", 4],
      ["non", "J'ai abandonné la démande", 2],
    ];
    const { map, report, structure, dataset, preparation, variables } = await setup(small, (c) => [nominal(c(GUARANTEE)), nominal(c(RESULT))]);
    const plan = buildPlan({ report, cartography: map(), structure, dataset, preparation, variables, instrument: "questionnaire", mainQuestion: QUESTION });
    const relation = plan.items.find((i) => i.level === "relation")!;
    expect(relation.conditions.join(" ")).toContain("Contrôle préalable : 6 case(s) sur 6 auraient un effectif attendu inférieur à 5");
    expect(plan.missingForConclusion).toContain("Seulement 16 observations : les tests auront peu de puissance et des effectifs attendus faibles.");
    const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset, preparation, variables, alpha: 0.05, independenceConfirmed: true, key: "k" });
    const interpretation = buildInterpretation(execution, plan, report, QUESTION, undefined, { provenance: { kind: "synthetic_test", description: "" } });
    expect(interpretation.hypotheses[0].verdict).toBe("unreliable");
    expect(interpretation.answer[1].text).toContain("ne permettent pas de conclure de façon fiable");
    expect(interpretation.conclusion.map((p) => p.text).join(" ")).toContain("Au moins un test n'est pas fiable");
  });

  it("l'utilisateur corrige un rapprochement : le plan suit la décision", async () => {
    const { map, report, structure, dataset, preparation, variables } = await setup(RELIABLE, (c) => [nominal(c(GUARANTEE)), nominal(c(RESULT)), nominal(c(MARKET))]);
    const first = map();
    const result = first.concepts.find((c) => c.name.startsWith("Résultat"))!;
    // L'utilisateur relie (à tort ou à raison) le résultat au marché : c'est sa décision, le plan l'applique.
    const decisions: MappingDecisions = { concepts: { [result.conceptKey]: { unitId: "col:4", confirmed: true } }, unitRoles: {} };
    const corrected = map(decisions);
    expect(corrected.concepts.find((c) => c.conceptKey === result.conceptKey)).toMatchObject({ unitId: "col:4", status: "confirmed" });
    const plan = buildPlan({ report, cartography: corrected, structure, dataset, preparation, variables, instrument: "questionnaire", mainQuestion: QUESTION });
    expect(plan.items.find((i) => i.level === "relation")).toMatchObject({ outcomeColumn: 4, explanatoryColumn: 11 });
  });

  it("type non confirmé ou concept introuvable : analyse refusée avec la raison", async () => {
    const { map, report, structure, dataset, preparation, variables } = await setup(RELIABLE);
    const unconfirmed = buildPlan({ report, cartography: map(), structure, dataset, preparation, variables, instrument: "questionnaire", mainQuestion: QUESTION });
    const relation = unconfirmed.items.find((i) => i.level === "relation")!;
    if (variables.find((v) => v.column === 12)?.analysisReady) expect(relation.feasible).toBe(true);
    else expect(relation).toMatchObject({ feasible: false, blocker: expect.stringContaining("type n'est pas confirmé") });
    const removed = map({ concepts: { [map().concepts[1].conceptKey]: { unitId: null, confirmed: true } }, unitRoles: {} });
    const plan = buildPlan({ report, cartography: removed, structure, dataset, preparation, variables, instrument: "questionnaire", mainQuestion: QUESTION });
    expect(plan.items.find((i) => i.level === "relation")).toMatchObject({ feasible: false, blocker: expect.stringContaining("Aucune question du fichier n'est reliée") });
  });

  it("guide d'entretien : aucun test quantitatif proposé", async () => {
    const { map, report, structure, dataset, preparation, variables } = await setup(RELIABLE, (c) => [nominal(c(GUARANTEE)), nominal(c(RESULT))]);
    const plan = buildPlan({ report, cartography: map(), structure, dataset, preparation, variables, instrument: "interview_guide", mainQuestion: QUESTION });
    expect(plan.items.some((i) => i.level === "relation")).toBe(false);
    expect(plan.final.join(" ")).toContain("l'analyse thématique n'est pas encore disponible");
  });
});

describe("Questionnaire fourni et diagnostic", () => {
  it("lit un questionnaire collé et relie chaque question à sa colonne", async () => {
    const { structure } = await setup(RELIABLE);
    const questions = parseQuestionnaire(`SECTION III : CRÉDIT
11. Disposez-vous d'une garantie pour obtenir un crédit ?
- Oui
- Non
12. Quel a été le résultat de votre dernière demande de crédit ?
□ Crédit obtenu
□ Crédit refusé
4. Dans quel marché exercez-vous principalement votre activité ?`);
    expect(questions.map((q) => [q.number, q.options.length, q.section])).toEqual([
      [11, 2, "SECTION III : CRÉDIT"],
      [12, 2, "SECTION III : CRÉDIT"],
      [4, 0, "SECTION III : CRÉDIT"],
    ]);
    const links = linkQuestions(questions, structure);
    expect(links.map((l) => l.unitId)).toEqual(["col:11", "col:12", "col:4"]);
    expect(links[0].confidence).not.toBe("none");
  });

  it("distingue problèmes confirmés, décisions, anomalies et suggestions", async () => {
    const { dataset, preparation, profile, structure, variables } = await setup(RELIABLE);
    const diagnosis = diagnoseData(dataset, preparation, profile, structure, variables);
    const byId = Object.fromEntries(diagnosis.items.map((i) => [i.id, i]));
    expect(byId.unusable).toMatchObject({ level: "confirmed", columns: [0, 1, 2] });
    expect(byId.options).toMatchObject({ level: "confirmed", columns: [5, 6, 7, 9, 10] });
    expect(byId["codes-13"]).toMatchObject({ level: "decision", action: { type: "declare_missing_codes", column: 13, values: ["Non concernée"] } });
    expect(byId["box-14"]?.level).toBe("suggestion");
    expect(diagnosis.summary[0]).toBe("Votre fichier compte 50 ligne(s) et 15 colonne(s), soit 7 question(s) une fois les colonnes techniques (3) et les colonnes vrai/faux de modalités (5) mises de côté.");
  });

  it("doublons : décision humaine réversible, jamais une suppression automatique", async () => {
    const { dataset, preparation, profile, structure, variables } = await (async () => {
      const csv = "nom;reponse\nA;oui\nB;non\nA;oui\n";
      const dataset = await importOk("a.csv", utf8(csv));
      const preparation = createPreparation(dataset);
      const profile = profileDataset(dataset, preparation);
      const { variables } = buildUnderstanding({ dataset, profile, preparation });
      return { dataset, preparation, profile, structure: analyzeStructure(dataset, profile, variables), variables };
    })();
    const diagnosis = diagnoseData(dataset, preparation, profile, structure, variables);
    expect(diagnosis.items.find((i) => i.id === "duplicates")).toMatchObject({ level: "decision", action: { type: "exclude_rows", rows: [2] } });
    expect(diagnosis.rowsUsed).toBe(3);
  });
});

describe("Étapes du parcours", () => {
  it("indique l'étape courante, la prochaine action et les étapes à revoir", () => {
    const start = journeySteps({ domain: false, research: false, framing: "none", instrument: false, data: false, quality: false, mapping: "none", plan: "none", results: "none" });
    expect(start.current).toBe("domain");
    const planning = journeySteps({ domain: true, research: true, framing: "confirmed", instrument: true, data: true, quality: true, mapping: "confirmed", plan: "none", results: "none" });
    expect(planning.current).toBe("plan");
    expect(planning.nextAction).toContain("validez-le");
    const stale = journeySteps({ domain: true, research: true, framing: "confirmed", instrument: true, data: true, quality: true, mapping: "confirmed", plan: "validated", results: "stale" });
    expect(stale.current).toBe("results");
    expect(stale.steps.find((s) => s.id === "results")?.state).toBe("stale");
    expect(stale.nextAction).toContain("des éléments ont changé");
  });
});

describe("Récupération des résultats et cadre de la recherche", () => {
  async function run() {
    const ctx = await setup(RELIABLE, (c) => [nominal(c(GUARANTEE)), nominal(c(RESULT)), nominal(c(MARKET))]);
    const plan = buildPlan({ report: ctx.report, cartography: ctx.map(), structure: ctx.structure, dataset: ctx.dataset, preparation: ctx.preparation, variables: ctx.variables, instrument: "questionnaire", mainQuestion: QUESTION });
    const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset: ctx.dataset, preparation: ctx.preparation, variables: ctx.variables, alpha: 0.05, independenceConfirmed: true, key: "k" });
    const interpretation = buildInterpretation(execution, plan, ctx.report, QUESTION, {
      problem: "Les entrepreneures se voient souvent refuser des crédits.",
      generalObjective: "Examiner la relation entre la disponibilité d'une garantie et le résultat de la dernière demande de crédit.",
      specificObjectives: ["Décrire le niveau d'études des entrepreneures.", "Mesurer la rentabilité des activités."],
    });
    return { ...ctx, plan, execution, interpretation };
  }

  it("confronte chaque objectif aux analyses réalisées", async () => {
    const { interpretation } = await run();
    const [general, education, profitability] = interpretation.framework.objectives;
    expect(general).toMatchObject({ kind: "général", status: "tested" });
    expect(general.detail).toContain("association significative");
    // « Niveau d'études » n'a pas été décrit (type non confirmé) : l'objectif n'est pas déclaré couvert.
    expect(education).toMatchObject({ kind: "spécifique", status: "not_addressed" });
    expect(profitability).toMatchObject({ status: "not_addressed" });
    expect(interpretation.framework.problem?.text).toContain("Problématique de départ");
  });

  it("le classeur Excel exporté se relit et contient les vrais résultats", async () => {
    const { execution, interpretation } = await run();
    const { buildWorkbook } = await import("@/lib/core/export/xlsx");
    const { journeySheets } = await import("@/lib/core/export/reports");
    const { importFile } = await import("@/lib/core/data/importer");
    const sheets = journeySheets({ question: QUESTION, execution, interpretation });
    expect(sheets.map((s) => s.name)).toEqual(["Synthèse", "Fréquences", "Tests statistiques", "Test 1"]);
    const bytes = buildWorkbook(sheets);
    const tests = await importFile("rapport.xlsx", bytes, { sheet: "Tests statistiques" });
    if (!tests.ok) throw new Error("relecture impossible");
    const header = tests.dataset.columns.map((c) => c.originalHeader);
    const row = tests.dataset.rows[0];
    expect(row[header.indexOf("Méthode")]).toBe("Tableau croisé et test du Chi² d'indépendance");
    expect(Number(row[header.indexOf("Valeur")])).toBeCloseTo(Number((2 * (36 / 14 + 36 / 11)).toFixed(4)), 4);
    expect(row[header.indexOf("Observations")]).toBe(50);
    const freq = await importFile("rapport.xlsx", bytes, { sheet: "Fréquences" });
    expect(freq.ok && freq.dataset.rows.some((r) => r[2] === "oui" && r[3] === 25)).toBe(true);
  });

  it("le rapport Word / imprimable reprend la question, les sections A à F et les tableaux", async () => {
    const { execution, interpretation } = await run();
    const { journeyHtml } = await import("@/lib/core/export/reports");
    const html = journeyHtml({ question: QUESTION, execution, interpretation });
    for (const part of ["A. Ce que montrent les données", "D. Réponse à la question de recherche", "F. Conclusion", "Cadre de la recherche", "Annexe 2", "11,688", "sans assistance IA"]) expect(html).toContain(part);
    expect(html).not.toMatch(/hypoth[eè]se (est )?(prouv|confirm)[ée]e/i);
    expect(html).not.toContain("<script");
  });
});

describe("Fichiers exportés : graphiques natifs, modifiables, dans la palette choisie", () => {
  async function exported(palette?: string[]) {
    const ctx = await setup(RELIABLE, (c) => [nominal(c(GUARANTEE)), nominal(c(RESULT)), nominal(c(MARKET))]);
    const plan = buildPlan({ report: ctx.report, cartography: ctx.map(), structure: ctx.structure, dataset: ctx.dataset, preparation: ctx.preparation, variables: ctx.variables, instrument: "questionnaire", mainQuestion: QUESTION });
    const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset: ctx.dataset, preparation: ctx.preparation, variables: ctx.variables, alpha: 0.05, independenceConfirmed: true, key: "k" });
    const interpretation = buildInterpretation(execution, plan, ctx.report, QUESTION, { problem: "Refus de crédit.", generalObjective: "Examiner la relation entre la garantie et le résultat de la demande de crédit.", specificObjectives: [";", "  "] });
    const { journeyDocument } = await import("@/lib/core/export/reports");
    return { execution, interpretation, doc: journeyDocument({ question: QUESTION, execution, interpretation, palette }) };
  }

  it("les graphiques du rapport reprennent les formes et les valeurs de l'écran", async () => {
    const { doc, interpretation } = await exported();
    const { chartsOf } = await import("@/lib/core/export/document");
    const { svgFromSpec } = await import("@/lib/core/export/svgCharts");
    const specs = chartsOf(doc);
    expect(specs.map((c) => [c.kind, c.title])).toEqual([
      ["stacked", "Répartition de « IV. RATIONNEMENT DU CREDIT Quel a été le résultat de votre dernière demande de crédit ? » selon « Disposez-vous d'une garentie pour obtenir un crédits »"],
      ["donut", "Répartition — Disposez-vous d'une garentie pour obtenir un crédits"],
      ["donut", "Répartition — IV. RATIONNEMENT DU CREDIT Quel a été le résultat de votre dernière demande de crédit ?"],
      ["donut", "Répartition — Dans quelle commune ou quel grand marché exercez-vous prncipalement votre activité ?"],
    ]);
    const stacked = specs[0];
    if (stacked.kind !== "stacked") throw new Error("type");
    expect(stacked.series.map((x) => [x.name, x.values, x.counts])).toEqual([
      ["Crédit obtenu", [32, 80], [8, 20]],
      ["Crédit refusé", [68, 20], [17, 5]],
    ]);
    // Palette ACADIA par défaut : deux teintes nettement distinctes (indigo, ambre).
    expect(stacked.series.map((x) => x.color)).toEqual(["#4f46e5", "#f59e0b"]);
    const svg = svgFromSpec(stacked)!.svg;
    for (const label of ["32 %", "68 %", "80 %", "20 %", "#4f46e5", "#f59e0b"]) expect(svg).toContain(label);
    expect(svgFromSpec(specs[1])!.svg).toContain("25 (50 %)");
    expect(interpretation.framework.objectives.map((o) => o.kind)).toEqual(["général"]);
    expect(interpretation.limits.filter((l) => l.includes("cause à effet"))).toHaveLength(1);
  });

  it("la palette choisie par l'utilisateur est appliquée aux graphiques exportés", async () => {
    const { PALETTE_PRESETS } = await import("@/lib/core/export/palette");
    const rainbow = PALETTE_PRESETS.find((p) => p.id === "arc-en-ciel")!.colors;
    const { doc } = await exported(rainbow);
    const { chartsOf } = await import("@/lib/core/export/document");
    const stacked = chartsOf(doc)[0];
    expect(stacked.kind === "stacked" && stacked.series.map((x) => x.color)).toEqual(["#e11d48", "#f97316"]);
  });

  it("le fichier Word contient de vrais graphiques Word, reliés à des données modifiables", async () => {
    const { doc } = await exported();
    const { buildDocx } = await import("@/lib/core/export/docx");
    const { unzipSync, strFromU8 } = await import("fflate");
    const files = unzipSync(buildDocx(doc));
    const names = Object.keys(files);
    expect(names.filter((f) => f.startsWith("word/charts/chart") && f.endsWith(".xml"))).toHaveLength(4);
    expect(names.filter((f) => f.startsWith("word/embeddings/") && f.endsWith(".xlsx"))).toHaveLength(4);
    expect(names.some((f) => f.startsWith("word/media/"))).toBe(false);
    const xml = strFromU8(files["word/document.xml"]);
    expect(xml.split('uri="http://schemas.openxmlformats.org/drawingml/2006/chart"').length - 1).toBe(4);
    expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(xml).toContain("11,688");
    // Sous chaque titre : une ligne horizontale Word (objet supprimable), et non une bordure figée du style.
    expect(xml.split('<w:pStyle w:val="Heading1"/>').length).toBe(xml.split('o:hr="t"').length);
    expect(strFromU8(files["word/styles.xml"])).not.toContain("<w:pBdr><w:bottom");
    // Format Word actuel : pas de « Mode de compatibilité » à l'ouverture.
    expect(strFromU8(files["word/settings.xml"])).toContain('w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"');
    expect(strFromU8(files["word/_rels/document.xml.rels"])).toContain('Target="settings.xml"');
    expect(strFromU8(files["[Content_Types].xml"])).toContain('PartName="/word/settings.xml"');
    const chart = strFromU8(files["word/charts/chart1.xml"]);
    expect(chart).toContain('<c:grouping val="stacked"/>');
    expect(chart).toContain("<c:f>'Données'!$B$2:$B$3</c:f>");
    expect(chart).toContain('<c:pt idx="0"><c:v>32</c:v></c:pt>');
    expect(chart).toContain('<a:srgbClr val="4F46E5">');
    expect(chart).toContain('<c:externalData r:id="rIdData">');
    expect(strFromU8(files["[Content_Types].xml"])).toContain('PartName="/word/charts/chart4.xml"');
    // Le classeur incorporé (« Modifier les données » dans Word) contient bien les données du graphique.
    const { importFile } = await import("@/lib/core/data/importer");
    const embedded = await importFile("e.xlsx", files["word/embeddings/Donnees_graphique1.xlsx"], {});
    expect(embedded.ok && embedded.dataset.columns.map((c) => c.originalHeader)).toEqual(["Disposez-vous d'une garentie pour obtenir un crédits", "Crédit obtenu", "Crédit refusé"]);
    expect(embedded.ok && embedded.dataset.rows).toEqual([["non", 32, 68], ["oui", 80, 20]]);
  });

  it("le classeur Excel contient des graphiques Excel natifs reliés aux cellules de la feuille « Graphiques »", async () => {
    const { execution, interpretation, doc } = await exported();
    const { buildWorkbook, chartsSheet } = await import("@/lib/core/export/xlsx");
    const { journeySheets } = await import("@/lib/core/export/reports");
    const { chartsOf } = await import("@/lib/core/export/document");
    const { unzipSync, strFromU8 } = await import("fflate");
    const files = unzipSync(buildWorkbook([...journeySheets({ question: QUESTION, execution, interpretation }), chartsSheet(chartsOf(doc))]));
    expect(strFromU8(files["xl/workbook.xml"])).toContain('name="Graphiques"');
    expect(Object.keys(files).filter((f) => f.startsWith("xl/charts/chart") && f.endsWith(".xml"))).toHaveLength(4);
    expect(strFromU8(files["xl/drawings/drawing1.xml"]).match(/<xdr:graphicFrame/g)).toHaveLength(4);
    const chart = strFromU8(files["xl/charts/chart1.xml"]);
    expect(chart).toContain("<c:f>'Graphiques'!$B$5:$B$6</c:f>");
    const sheet = strFromU8(files["xl/worksheets/sheet5.xml"]);
    expect(sheet).toContain("Crédit obtenu");
    expect(sheet).toContain('<c r="B5" s="0"><v>32</v></c>');
    expect(strFromU8(files["xl/styles.xml"])).toContain('rgb="FFE0E7FF"');
  });
});
