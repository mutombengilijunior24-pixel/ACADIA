import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { computeDescriptiveStatistics, type CategoricalResult } from "@/lib/core/analysis/descriptiveStatistics";
import { twoByTwoMeasures, wilsonInterval } from "@/lib/core/analysis/inferential/tests";
import { addOperation, createPreparation } from "@/lib/core/data/preparation";
import { profileDataset } from "@/lib/core/data/profile";
import type { PreparationState } from "@/lib/core/data/types";
import { buildUnderstanding } from "@/lib/core/data/understanding";
import {
  analyzeStructure,
  buildCartography,
  buildInterpretation,
  buildPlan,
  checkConsistency,
  detectConditionalQuestions,
  diagnoseData,
  emptyMappingDecisions,
  emptyPlanDecisions,
  declareProvenance,
  defaultTwoByTwo,
  effectiveSkipRules,
  executePlan,
  inferSkipRules,
  linkQuestions,
  parseQuestionnaire,
  provenanceFor,
  structuralPreparation,
  SYNTHETIC_WARNING,
  UNKNOWN_WARNING,
  type DataProvenance,
  type MappingDecisions,
} from "@/lib/core/journey";
import { buildUnderstandingReport, validateResearchInput } from "@/lib/core/understanding";

import { importOk } from "../data/helpers";

// Fichier de test SYNTHÉTIQUE du parcours (copie de acadia-parcours-credit-50.csv) :
// garantie = non : obtenu 8, refusé 17 ; garantie = oui : obtenu 20, refusé 5 (n = 50 ; 28 obtenus ; 22 refusés).

const QUESTION = "La disponibilité d'une garantie est-elle associée au résultat de la dernière demande de crédit des entrepreneures ?";
const GUARANTEE = 11;
const RESULT = 12;
const REASON = 13;
const MARKET = 4;

const FIXTURE = readFileSync("tests/fixtures/acadia-parcours-credit-50.csv", "utf8");

/** Copie modifiée du fichier synthétique : la cellule (identifiant de soumission, colonne) prend une autre valeur. */
function editCell(csv: string, submission: string, column: number, value: string): string {
  return csv
    .split("\n")
    .map((line) => {
      if (!line.startsWith(`"${submission}";`)) return line;
      const cells = line.split(";");
      cells[column] = `"${value}"`;
      return cells.join(";");
    })
    .join("\n");
}

async function load(extraOps: (p: PreparationState) => PreparationState = (p) => p, csv: string = FIXTURE) {
  const dataset = await importOk("acadia-parcours-credit-50.csv", new TextEncoder().encode(csv));
  let preparation = createPreparation(dataset);
  for (const column of [GUARANTEE, RESULT, MARKET, REASON]) preparation = addOperation(preparation, { type: "set_statistical_type", column, statisticalType: "nominal" });
  preparation = extraOps(preparation);
  const profile = profileDataset(dataset, preparation);
  const { variables } = buildUnderstanding({ dataset, profile, preparation });
  const structure = analyzeStructure(dataset, profile, variables);
  const validation = validateResearchInput({ title: QUESTION, mainQuestion: QUESTION, hypotheses: ["La disponibilité d'une garantie est associée au résultat de la dernière demande de crédit."] });
  if (!validation.ok) throw new Error("recherche");
  const report = buildUnderstandingReport(validation.input);
  const skipRules = inferSkipRules({ dataset, preparation, structure });
  const conditionals = detectConditionalQuestions(dataset, preparation, structure, skipRules);
  const consistency = checkConsistency(dataset, preparation, structure, skipRules);
  const cartographyOf = (decisions: MappingDecisions = emptyMappingDecisions()) => buildCartography({ report, structure, questions: [], links: linkQuestions([], structure), decisions });
  const planOf = (decisions?: MappingDecisions) => buildPlan({ report, cartography: cartographyOf(decisions), structure, dataset, preparation, variables, instrument: "questionnaire", mainQuestion: QUESTION });
  const structural = Object.fromEntries(conditionals.filter((q) => q.notApplicableValues.length).map((q) => [q.column, q.notApplicableValues]));
  return { dataset, preparation, profile, variables, structure, report, skipRules, conditionals, consistency, cartographyOf, planOf, structural };
}

/** Test exact de Fisher calculé en entiers (référence indépendante du moteur). */
function fisherReference(a: number, b: number, c: number, d: number): number {
  const fact = (n: number): bigint => (n <= 1 ? BigInt(1) : BigInt(n) * fact(n - 1));
  const r1 = a + b, r2 = c + d, c1 = a + c, n = r1 + r2;
  const num = fact(r1) * fact(r2) * fact(c1) * fact(n - c1);
  const den = (x: number) => fact(n) * fact(x) * fact(r1 - x) * fact(c1 - x) * fact(r2 - c1 + x);
  // p(x) = num/den ; comparaison exacte en rationnels : p(x) ≤ p(a) ⇔ den(a) ≤ den(x).
  let total = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x += 1) if (den(a) <= den(x)) total += Number((num * BigInt(10) ** BigInt(18)) / den(x)) / 1e18;
  return total;
}

describe("Cas de non-régression : garantie × issue du crédit (fichier synthétique)", () => {
  it("sélectionne les bonnes colonnes et calcule les valeurs de référence", async () => {
    const { planOf, dataset, preparation, variables, structural } = await load();
    const plan = planOf();
    const main = plan.items.find((i) => i.tier === "main")!;
    expect(main).toMatchObject({ level: "relation", method: "chi_square", outcomeColumn: RESULT, explanatoryColumn: GUARANTEE, alignment: { status: "info" } });
    const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset, preparation, variables, alpha: 0.05, independenceConfirmed: true, key: "k", structural });
    const relation = execution.items.find((e) => e.item.id === main.id)!;
    if (relation.kind !== "relation" || !relation.outcome.ok) throw new Error("non calculé");
    const r = relation.outcome.report;
    if (r.detail.kind !== "chi_square") throw new Error("méthode");
    expect(r.detail.rowLabels).toEqual(["non", "oui"]);
    expect(r.detail.colLabels).toEqual(["Crédit obtenu", "Crédit refusé"]);
    expect(r.detail.result.observed).toEqual([[8, 17], [20, 5]]);
    expect(r.detail.result.colTotals).toEqual([28, 22]);
    expect(r.statistic.value).toBeCloseTo(11.688, 3);
    expect(r.statistic.df).toBe("1");
    expect(r.pValue.toPrecision(3)).toBe("0.000629");
    expect(r.effect?.value).toBeCloseTo(0.483, 3);
    const fisher = r.detail.result.fisher!.pValue;
    expect(fisher.toPrecision(3)).toBe("0.00144");
    expect(fisher).toBeCloseTo(fisherReference(20, 5, 8, 17), 12);
    // Valeurs exactes affichées à côté des valeurs arrondies.
    expect(r.results.find((x) => x.label.startsWith("p-value"))?.value).toBe("< 0,001 (valeur exacte : 0,000629)");
    expect(r.results.find((x) => x.label.startsWith("Test exact de Fisher"))?.value).toBe("= 0,001 (valeur exacte : 0,00144)".replace("= ", ""));
  });

  it("tableau 2 × 2 : différence de proportions, risque relatif et odds ratio, références explicites", async () => {
    const m = twoByTwoMeasures([[8, 17], [20, 5]]);
    expect(m).toMatchObject({ referenceRow: 0, comparisonRow: 1, eventColumn: 0, continuityCorrection: false });
    expect(m.pReference).toBeCloseTo(0.32, 12);
    expect(m.pComparison).toBeCloseTo(0.8, 12);
    expect(m.difference).toBeCloseTo(0.48, 12);
    const z = 1.959963984540054;
    const [l1, u1] = wilsonInterval(20, 25, z);
    const [l0, u0] = wilsonInterval(8, 25, z);
    expect(m.differenceCi[0]).toBeCloseTo(0.48 - Math.sqrt((0.8 - l1) ** 2 + (u0 - 0.32) ** 2), 12);
    expect(m.differenceCi[1]).toBeCloseTo(0.48 + Math.sqrt((u1 - 0.8) ** 2 + (0.32 - l0) ** 2), 12);
    expect(m.riskRatio).toBeCloseTo(2.5, 12);
    const seRr = Math.sqrt(1 / 20 - 1 / 25 + 1 / 8 - 1 / 25);
    expect(m.riskRatioCi![0]).toBeCloseTo(2.5 * Math.exp(-z * seRr), 9);
    expect(m.riskRatioCi![1]).toBeCloseTo(2.5 * Math.exp(z * seRr), 9);
    expect(m.oddsRatio).toBeCloseTo(8.5, 12);
    const seOr = Math.sqrt(1 / 20 + 1 / 5 + 1 / 8 + 1 / 17);
    expect(m.oddsRatioCi![0]).toBeCloseTo(8.5 * Math.exp(-z * seOr), 9);
    expect(m.oddsRatioCi![1]).toBeCloseTo(8.5 * Math.exp(z * seOr), 9);
    // Case nulle : correction de Haldane-Anscombe annoncée.
    expect(twoByTwoMeasures([[0, 10], [5, 5]]).continuityCorrection).toBe(true);
  });

  it("le rapport du test présente les catégories de référence et les mesures 2 × 2", async () => {
    const { planOf, dataset, preparation, variables, structural } = await load();
    const plan = planOf();
    const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset, preparation, variables, alpha: 0.05, independenceConfirmed: true, key: "k", structural });
    const relation = execution.items.find((e) => e.kind === "relation");
    if (!relation || relation.kind !== "relation" || !relation.outcome.ok) throw new Error("non calculé");
    const rows = Object.fromEntries(relation.outcome.report.results.map((x) => [x.label, x.value]));
    expect(rows["Catégories de référence"]).toContain("groupe de référence : « Disposez-vous d'une garentie pour obtenir un crédits » = non");
    expect(rows["Proportion de « Crédit obtenu »"]).toBe("oui : 80 % (20/25) ; non : 32 % (8/25)");
    expect(rows["Différence de proportions"]).toMatch(/^\+48 points de pourcentage \[IC 95 % : /);
    expect(rows["Rapport de proportions (risque relatif)"]).toMatch(/^2,5 \[IC 95 % : 1,366 ; 4,57[0-9]*\]$/);
    expect(rows["Odds ratio"]).toMatch(/^8,5 \[IC 95 % : 2,33[0-9]* ; 30,9[0-9]*\]$/);
  });
});

describe("Correspondance question ↔ variables ↔ colonnes", () => {
  it("les colonnes vrai/faux d'une question à choix unique sont regroupées et jamais proposées seules", async () => {
    const { structure, planOf, dataset, preparation, profile, variables } = await load();
    const market = structure.units.find((u) => u.primaryColumn === MARKET)!;
    expect(market.kind).toBe("single_with_options");
    expect(market.columns).toEqual([4, 5, 6, 7]);
    const optionColumns = [5, 6, 7, 9, 10];
    expect(planOf().items.some((i) => i.columns.some((c) => optionColumns.includes(c)))).toBe(false);
    const diagnosis = diagnoseData(dataset, preparation, profile, structure, variables);
    expect(diagnosis.items.find((i) => i.id === "options")?.consequence).toContain("jamais proposées comme variables indépendantes");
  });

  it("une sélection qui ne correspond pas à la question est bloquée, puis exécutée seulement après confirmation", async () => {
    const { cartographyOf, planOf, dataset, preparation, variables } = await load();
    const result = cartographyOf().concepts.find((c) => c.name.startsWith("Résultat"))!;
    const decisions: MappingDecisions = { concepts: { [result.conceptKey]: { unitId: `col:${MARKET}`, confirmed: true } }, unitRoles: {} };
    const plan = planOf(decisions);
    const relation = plan.items.find((i) => i.level === "relation")!;
    expect(relation.alignment.status).toBe("blocking");
    expect(relation.alignment.detail).toContain("La question porte sur « Résultat de la dernière demande de crédit », mais la colonne retenue est « Dans quelle commune ou quel grand marché");
    const blocked = executePlan({ plan, decisions: emptyPlanDecisions(), dataset, preparation, variables, alpha: 0.05, independenceConfirmed: true, key: "k" });
    const outcome = blocked.items.find((e) => e.item.id === relation.id);
    expect(outcome?.kind === "relation" && !outcome.outcome.ok && outcome.outcome.reason).toContain("Exécution bloquée");
    const confirmed = executePlan({ plan, decisions: { ...emptyPlanDecisions(), mismatchConfirmed: { [relation.id]: true } }, dataset, preparation, variables, alpha: 0.05, independenceConfirmed: true, key: "k" });
    const done = confirmed.items.find((e) => e.item.id === relation.id);
    expect(done?.kind === "relation" && done.outcome.ok).toBe(true);
  });
});

describe("Questions conditionnelles et cohérence des réponses", () => {
  it("« Non concernée » est une réponse structurelle hors du dénominateur des répondants éligibles", async () => {
    const { conditionals, dataset, preparation, variables, structural } = await load();
    const reason = conditionals.find((q) => q.column === REASON)!;
    expect(reason).toMatchObject({ notApplicableValues: ["Non concernée"], notApplicableCount: 28, eligibleCount: 22, blankCount: 0, detectedBy: "intitulé et réponses et règle de passage proposée" });
    expect(reason.rule).toMatchObject({ target: REASON, when: { column: RESULT, values: ["Crédit refusé"] }, source: "intitulé", status: "proposed" });
    expect(reason.condition).toBe("votre crédit a été refusé ou reduit");
    const report = computeDescriptiveStatistics(dataset, structuralPreparation(preparation, structural), variables.filter((v) => v.column === REASON));
    const result = report.results[0] as CategoricalResult;
    expect(result.valid).toBe(22);
    expect(result.frequencies.map((f) => [f.value, f.count, f.percent])).toEqual([
      ["Manque de guarentie", 11, 50],
      ["Revenus jugés insufisant", 11, 50],
    ]);
    // La préparation de l'utilisateur et les valeurs brutes sont inchangées.
    expect(preparation.operations.some((op) => op.type === "declare_missing_codes")).toBe(false);
  });

  it("le dénominateur éligible apparaît dans l'interprétation quand la question est décrite", async () => {
    const { report, structure, dataset, preparation, variables, structural } = await load();
    const cartography = buildCartography({ report, structure, questions: [], links: [], decisions: { concepts: {}, unitRoles: { [`col:${REASON}`]: "context" } } });
    const plan = buildPlan({ report, cartography, structure, dataset, preparation, variables, instrument: "questionnaire", mainQuestion: QUESTION });
    const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset, preparation, variables, alpha: 0.05, independenceConfirmed: true, key: "k", structural });
    const context = execution.items.find((e) => e.item.id === "desc:context");
    expect(context?.kind === "descriptive" && context.structural).toEqual([{ column: REASON, values: ["Non concernée"], count: 28 }]);
    const interpretation = buildInterpretation(execution, plan, report, QUESTION, undefined, { provenance: { kind: "synthetic_test", description: "" } });
    expect(interpretation.data.map((p) => p.text).join(" ")).toContain("(n = 22 répondant(s) éligible(s) ; 28 « Non concernée » hors dénominateur) : Manque de guarentie 50 % (11/22)");
  });

  it("garantie = oui et motif « Manque de guarentie » : 2 cas à clarifier, sans modifier les données", async () => {
    const { consistency, dataset } = await load();
    const before = JSON.stringify(dataset.rows);
    const negated = consistency.filter((c) => c.id.startsWith("negated"));
    expect(negated).toHaveLength(1);
    expect(negated[0]).toMatchObject({ category: "apparent_tension", severity: "medium", sourceRows: [23, 25] });
    expect(negated[0].elements.map((e) => e.column)).toEqual([GUARANTEE, REASON]);
    expect(negated[0].justification).toContain("ne signifie pas qu'elle a été acceptée, jugée suffisante");
    expect(consistency.filter((c) => c.category === "skip_violation" || c.category === "logical_contradiction")).toEqual([]);
    expect(JSON.stringify(dataset.rows)).toBe(before);
  });

  it("le diagnostic présente la question conditionnelle comme une décision, avec ses conséquences", async () => {
    const { dataset, preparation, profile, structure, variables, conditionals, structural, consistency } = await load();
    const diagnosis = diagnoseData(dataset, preparation, profile, structure, variables, { conditionals, structural, consistency });
    const item = diagnosis.items.find((i) => i.id === `conditional-${REASON}`)!;
    expect(item).toMatchObject({ level: "decision", action: { type: "toggle_structural", column: REASON, enable: false } });
    expect(item.consequence).toBe("Les motifs sont calculés sur 22 répondant(s) éligible(s) ; les 28 « Non concernée » sont indiquées à part, hors dénominateur.");
    expect(diagnosis.items.some((i) => i.id === `codes-${REASON}`)).toBe(false);
    expect(diagnosis).toMatchObject({ rows: 50, rowsUsed: 50, duplicates: 0, conditionalQuestions: 1, coherenceAlerts: 1 });
    expect(diagnosis.items.every((i) => i.consequence.length > 0)).toBe(true);
  });
});

describe("Provenance des données", () => {
  async function interpretationFor(provenance: DataProvenance) {
    const { planOf, dataset, preparation, variables, structural, report, consistency } = await load();
    const plan = planOf();
    const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset, preparation, variables, alpha: 0.05, independenceConfirmed: true, key: "k", structural });
    const interpretation = buildInterpretation(execution, plan, report, QUESTION, { problem: "Refus de crédit.", generalObjective: "", specificObjectives: [] }, { provenance, consistency });
    return { execution, interpretation };
  }

  it("synthétique : avertissement visible dans la réponse, la conclusion, les limites et les exports", async () => {
    const { execution, interpretation } = await interpretationFor({ kind: "synthetic_test", description: "jeu fictif ACADIA" });
    expect(SYNTHETIC_WARNING).toBe("Jeu de données synthétique — validation du logiciel uniquement ; aucune conclusion ne peut être tirée sur la population étudiée.");
    expect(interpretation.provenance).toEqual({
      value: { kind: "synthetic_test", description: "jeu fictif ACADIA" },
      label: "Données de test synthétiques",
      warning: SYNTHETIC_WARNING,
      statement: "Provenance des données déclarée par l'utilisateur : Données de test synthétiques — « jeu fictif ACADIA ». Cette provenance n'a pas été vérifiée indépendamment par ACADIA.",
    });
    expect(interpretation.answer[0].text).toBe(SYNTHETIC_WARNING);
    expect(interpretation.conclusion[0].text).toBe(SYNTHETIC_WARNING);
    expect(interpretation.limits).toContain(SYNTHETIC_WARNING);
    expect(JSON.stringify(interpretation)).not.toMatch(/éléments empiriques|preuves? empirique(?!s tant)/);
    expect(interpretation.hypotheses[0].detail).toContain("Portée : sur ce jeu de test, sans portée sur la population.");
    expect(interpretation.limits.join(" ")).toContain("Tension apparente à clarifier");

    const { journeyDocument, journeySheets } = await import("@/lib/core/export/reports");
    const { renderHtml } = await import("@/lib/core/export/document");
    const { buildDocx } = await import("@/lib/core/export/docx");
    const { unzipSync, strFromU8 } = await import("fflate");
    const doc = journeyDocument({ question: QUESTION, execution, interpretation });
    expect(doc.blocks.slice(0, 5)).toContainEqual({ type: "warn", text: SYNTHETIC_WARNING });
    expect(renderHtml(doc)).toContain(SYNTHETIC_WARNING);
    expect(strFromU8(unzipSync(buildDocx(doc))["word/document.xml"])).toContain("Jeu de données synthétique");
    expect(journeySheets({ question: QUESTION, execution, interpretation })[0].rows.flat()).toContain(`⚠ ${SYNTHETIC_WARNING}`);
    // Annexe des tests : conditions d'application présentes, interprétation non répétée.
    const annex = doc.blocks.slice(doc.blocks.findIndex((b) => b.type === "h1" && b.text.startsWith("Annexe 2")));
    expect(annex.some((b) => b.type === "table" && b.head[0] === "Condition d'application")).toBe(true);
    expect(annex.some((b) => b.type === "p" && b.text.startsWith("Conclusion."))).toBe(false);
  });

  it("inconnue : « provenance non renseignée », pas de qualification empirique automatique", async () => {
    const { interpretation } = await interpretationFor({ kind: "unknown", description: "" });
    expect(interpretation.provenance.label).toBe("Provenance inconnue");
    expect(interpretation.provenance.statement).toBe("Provenance des données : non renseignée par l'utilisateur.");
    expect(interpretation.answer[0].text).toBe(UNKNOWN_WARNING);
    expect(interpretation.framework.problem?.text).toContain("éléments à confirmer");
    expect(interpretation.framework.problem?.text).not.toContain("empiriques");
  });

  it("réelle (déclarée) : aucun avertissement de démonstration, résultats qualifiés d'empiriques dans l'échantillon", async () => {
    const { interpretation } = await interpretationFor({ kind: "real_survey", description: "" });
    expect(interpretation.provenance.warning).toBeNull();
    expect(interpretation.answer[0].text).toContain("dans l'échantillon étudié");
    expect(interpretation.framework.problem?.text).toContain("éléments empiriques");
    expect(interpretation.limits).not.toContain(SYNTHETIC_WARNING);
  });
});

/* ================================================================= */
/* Chantier « fiabilisation du raisonnement » : tests d'acceptation    */
/* ================================================================= */

describe("Alignement question ↔ variables : diagnostic structuré", () => {
  it("correspondance correcte : aucun signal bloquant ni avertissement, au moins un indice explicatif", async () => {
    const main = (await load()).planOf().items.find((i) => i.tier === "main")!;
    expect(main.alignment.status).toBe("info");
    expect(main.alignment.signals.some((sig) => sig.level === "blocking" || sig.level === "warning")).toBe(false);
    expect(main.alignment.signals.length).toBeGreaterThan(0);
  });

  it("mauvaise variable (marché, âge) : bloquant, avec explication", async () => {
    const { cartographyOf, planOf } = await load();
    const result = cartographyOf().concepts.find((c) => c.name.startsWith("Résultat"))!;
    for (const column of [MARKET, 8]) {
      const plan = planOf({ concepts: { [result.conceptKey]: { unitId: `col:${column}`, confirmed: true } }, unitRoles: {} });
      const relation = plan.items.find((i) => i.level === "relation")!;
      expect(relation.alignment.status).toBe("blocking");
      expect(relation.alignment.signals.find((sig) => sig.level === "blocking")?.message).toContain("La question porte sur « Résultat de la dernière demande de crédit »");
    }
  });

  it("faible recouvrement lexical mais colonne choisie par l'utilisateur : avertissement, pas de blocage", async () => {
    // L'en-tête de la colonne de résultat ne partage presque aucun mot avec la question.
    const csv = FIXTURE.replace("IV. RATIONNEMENT DU CREDITQuel a été le résultat de votre dernière demande de crédit ?", "Q12 Suite donnée au dossier");
    const { cartographyOf, planOf, dataset, preparation, variables, structural } = await load(undefined, csv);
    const result = cartographyOf().concepts.find((c) => c.name.startsWith("Résultat"))!;
    const plan = planOf({ concepts: { [result.conceptKey]: { unitId: `col:${RESULT}`, confirmed: true, manual: true } }, unitRoles: {} });
    const relation = plan.items.find((i) => i.level === "relation" && i.outcomeColumn === RESULT)!;
    expect(relation.alignment.status).not.toBe("blocking");
    expect(relation.alignment.signals.some((sig) => sig.code === "user_choice" || sig.level === "warning" || sig.level === "info")).toBe(true);
    const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset, preparation, variables, alpha: 0.05, independenceConfirmed: true, key: "k", structural });
    const done = execution.items.find((e) => e.item.id === relation.id);
    expect(done?.kind === "relation" && done.outcome.ok).toBe(true);
  });
});

describe("Conditions de passage et règles de cohérence", () => {
  it("lit les consignes de saut d'un questionnaire collé", () => {
    const questions = parseQuestionnaire(["1. Disposez-vous d'une garantie ?", "- Oui", "- Non → passez à la question 3", "2. Si oui, de quel type ?", "- Titre foncier", "3. Quel est votre âge ?"].join("\n"));
    expect(questions[0].options).toEqual(["Oui", "Non"]);
    expect(questions[0].jumps).toEqual([{ option: "Non", to: 3 }]);
    expect(questions[1].appliesIfPrevious).toBe("yes");
    expect(questions[2].jumps).toEqual([]);
  });

  it("règle déduite d'un intitulé : proposée, jamais appliquée sans confirmation", async () => {
    const { skipRules, consistency } = await load();
    expect(skipRules).toHaveLength(1);
    expect(skipRules[0].status).toBe("proposed");
    expect(consistency.some((c) => c.rule === "condition-de-passage")).toBe(false);
    expect(effectiveSkipRules(skipRules, { [skipRules[0].id]: "rejected" })).toEqual([]);
  });

  it("saut valide (règle confirmée) : aucune alerte ; « Non concernée » est accepté quand la logique le justifie", async () => {
    const { skipRules, dataset, preparation, structure } = await load();
    const confirmed = effectiveSkipRules(skipRules, { [skipRules[0].id]: "confirmed" });
    const issues = checkConsistency(dataset, preparation, structure, confirmed);
    expect(issues.filter((c) => c.rule === "condition-de-passage")).toEqual([]);
  });

  it("conditionnelle réellement incohérente : motif de refus pour un crédit obtenu, « non concernée » pour un refus", async () => {
    let csv = editCell(FIXTURE, "S1000", REASON, "Revenus jugés insufisant");
    csv = editCell(csv, "S1022", REASON, "Non concernée");
    const { skipRules, dataset, preparation, structure } = await load(undefined, csv);
    const confirmed = effectiveSkipRules(skipRules, { [skipRules[0].id]: "confirmed" });
    const issues = checkConsistency(dataset, preparation, structure, confirmed).filter((c) => c.rule === "condition-de-passage");
    expect(issues.map((c) => c.category)).toEqual(["skip_violation", "skip_violation"]);
    expect(issues[0].problem).toContain("alors que la condition");
    expect(issues.every((c) => c.elements.map((e) => e.column).join() === `${RESULT},${REASON}`)).toBe(true);
    expect(issues.every((c) => c.justification && c.action && c.sourceRows.length === 1)).toBe(true);
  });

  it("règle issue de l'instrument (« Si … ») : confirmée d'office", async () => {
    const { dataset, preparation, structure } = await load();
    const questions = parseQuestionnaire(["12. Quel a été le résultat de votre dernière demande de crédit ?", "- Crédit obtenu", "- Crédit refusé", "13. Si non, quelle était la principale raison du refus ?"].join("\n"));
    const links = questions.map((q, i) => ({ questionId: q.id, unitId: `col:${[RESULT, REASON][i]}`, score: 1, confidence: "high" as const, reason: "", alternatives: [] }));
    expect(questions[1].appliesIfPrevious).toBe("no");
    const rules = inferSkipRules({ dataset, preparation, structure, questions, links });
    // « Si non » renvoie à une question sans modalité oui/non : aucune valeur filtre n'est inventée.
    const instrument = rules.find((r) => r.source === "instrument");
    expect(instrument === undefined || instrument.when.values.length === 0).toBe(true);
  });

  it("l'utilisateur corrige les réponses filtres d'une règle proposée", async () => {
    const csv = editCell(FIXTURE, "S1000", REASON, "Revenus jugés insufisant");
    const { skipRules, dataset, preparation, structure } = await load(undefined, csv);
    const id = skipRules[0].id;
    expect(skipRules[0].options).toEqual(["Crédit obtenu", "Crédit refusé"]);
    const corrected = effectiveSkipRules(skipRules, { [id]: "confirmed" }, { [id]: ["Crédit obtenu", "Crédit refusé"] });
    expect(corrected[0].when.values).toEqual(["Crédit obtenu", "Crédit refusé"]);
    const issues = checkConsistency(dataset, preparation, structure, corrected).filter((c) => c.id.startsWith("skip-outside"));
    expect(issues).toEqual([]);
  });

  it("intitulé numéroté (« Q13. Si votre crédit… ») : condition de passage reconnue", async () => {
    const csv = FIXTURE.replace("\"Si votre crédit a été refusé", "\"Q13. Si votre crédit a été refusé");
    const { skipRules, conditionals } = await load(undefined, csv);
    expect(skipRules[0]).toMatchObject({ target: REASON, when: { column: RESULT, values: ["Crédit refusé"] }, status: "proposed" });
    expect(conditionals.find((q) => q.column === REASON)?.condition).toBe("votre crédit a été refusé ou reduit");
  });

  it("consigne de saut de l'instrument : règle confirmée d'office et appliquée", async () => {
    const { dataset, preparation, structure } = await load();
    const questions = parseQuestionnaire(["11. Disposez-vous d'une garantie ?", "- oui", "- non → passez à la question 13", "12. Résultat de la dernière demande ?", "13. Principale raison du refus ?"].join("\n"));
    const links = questions.map((q, i) => ({ questionId: q.id, unitId: `col:${[GUARANTEE, RESULT, REASON][i]}`, score: 1, confidence: "high" as const, reason: "", alternatives: [] }));
    const rules = inferSkipRules({ dataset, preparation, structure, questions, links });
    const rule = rules.find((r) => r.source === "instrument")!;
    expect(rule).toMatchObject({ target: RESULT, when: { column: GUARANTEE, values: ["oui"] }, status: "confirmed" });
    // Les 25 « non » ont pourtant répondu à la question 12 : réponses hors condition, gravité élevée (consigne explicite).
    const violation = checkConsistency(dataset, preparation, structure, rules).find((c) => c.id === `skip-outside-${rule.id}`)!;
    expect(violation).toMatchObject({ category: "skip_violation", severity: "high" });
    expect(violation.sourceRows).toHaveLength(25);
  });

  it("contradiction logique forte : la colonne vrai/faux coche une autre modalité que la réponse texte", async () => {
    const csv = editCell(editCell(FIXTURE, "S1000", 5, "false"), "S1000", 6, "true");
    const { consistency } = await load(undefined, csv);
    const contradiction = consistency.find((c) => c.category === "logical_contradiction")!;
    expect(contradiction).toMatchObject({ severity: "high", rule: "choix-unique-colonnes" });
    expect(contradiction.elements[0].column).toBe(MARKET);
  });

  it("tension (garantie = oui, motif « manque de garantie ») : jamais classée impossible", async () => {
    const { consistency } = await load();
    expect(consistency.filter((c) => c.rule === "possession-manque").every((c) => c.category === "apparent_tension")).toBe(true);
    expect(consistency.some((c) => c.category === "logical_contradiction")).toBe(false);
  });

  it("données propres : aucune alerte de gravité moyenne ou élevée", async () => {
    const csv = editCell(editCell(FIXTURE, "S1021", REASON, "Revenus jugés insufisant"), "S1023", REASON, "Revenus jugés insufisant");
    const { consistency } = await load(undefined, csv);
    expect(consistency.filter((c) => c.severity !== "low")).toEqual([]);
  });
});

describe("Tableau 2 × 2 : catégories choisies par l'utilisateur", () => {
  async function relationWith(categories?: { rowReference: string; outcomeEvent: string; direction: "comparison_vs_reference" | "reference_vs_comparison" }) {
    const { planOf, dataset, preparation, variables, structural } = await load();
    const plan = planOf();
    const main = plan.items.find((i) => i.tier === "main")!;
    const decisions = { ...emptyPlanDecisions(), categories: categories ? { [main.id]: categories } : {} };
    const execution = executePlan({ plan, decisions, dataset, preparation, variables, alpha: 0.05, independenceConfirmed: true, key: "k", structural });
    const relation = execution.items.find((e) => e.item.id === main.id)!;
    return { main, relation };
  }
  const rowsOf = (relation: Awaited<ReturnType<typeof relationWith>>["relation"]) => {
    if (relation.kind !== "relation" || !relation.outcome.ok) throw new Error("non calculé");
    return { report: relation.outcome.report, rows: Object.fromEntries(relation.outcome.report.results.map((x) => [x.label, x.value])) };
  };

  it("aperçu avant calcul : lignes, colonnes, effectifs ; choix par défaut affiché comme tel", async () => {
    const { main } = await relationWith();
    expect(main.preview).toMatchObject({ rowLabels: ["non", "oui"], colLabels: ["Crédit obtenu", "Crédit refusé"], counts: [[8, 17], [20, 5]], n: 50 });
    expect(defaultTwoByTwo(main.preview!)).toEqual({ rowReference: "non", outcomeEvent: "Crédit obtenu", direction: "comparison_vs_reference" });
    const { rows } = rowsOf((await relationWith()).relation);
    expect(rows["Catégories de référence"]).toContain("choix par défaut");
  });

  it("changer la référence change RR, OR et différence, pas le Khi-deux ni p", async () => {
    const base = rowsOf((await relationWith()).relation);
    const changed = rowsOf((await relationWith({ rowReference: "oui", outcomeEvent: "Crédit obtenu", direction: "comparison_vs_reference" })).relation);
    expect(changed.report.statistic.value).toBeCloseTo(base.report.statistic.value, 12);
    expect(changed.report.pValue).toBeCloseTo(base.report.pValue, 15);
    if (changed.report.detail.kind !== "chi_square") throw new Error("méthode");
    expect(changed.report.detail.rowLabels).toEqual(["oui", "non"]);
    expect(changed.rows["Rapport de proportions (risque relatif)"]).toMatch(/^0,4 \[/);
    expect(changed.rows["Différence de proportions"]).toMatch(/^[−-]48 points/);
    expect(changed.rows["Odds ratio"]).toMatch(/^0,11[0-9]* \[/);
    expect(changed.rows["Catégories de référence"]).toContain("choix de l'utilisateur");
    // Issue « refusé », référence « oui » : non vs oui → 68 % contre 20 %.
    const refused = rowsOf((await relationWith({ rowReference: "oui", outcomeEvent: "Crédit refusé", direction: "comparison_vs_reference" })).relation);
    expect(refused.rows["Rapport de proportions (risque relatif)"]).toMatch(/^3,4 \[/);
    expect(refused.rows["Proportion de « Crédit refusé »"]).toContain("non : 68 % (17/25)");
    expect(refused.rows["Proportion de « Crédit refusé »"]).toContain("oui : 20 % (5/25)");
  });

  it("sens inversé : mêmes groupes, lecture inverse (RR 0,4 au lieu de 2,5)", async () => {
    const reversed = rowsOf((await relationWith({ rowReference: "non", outcomeEvent: "Crédit obtenu", direction: "reference_vs_comparison" })).relation);
    expect(reversed.rows["Rapport de proportions (risque relatif)"]).toMatch(/^0,4 \[/);
    expect(reversed.report.pValue.toPrecision(3)).toBe("0.000629");
  });

  it("catégorie inexistante : erreur explicite, jamais de résultat de remplacement", async () => {
    const { relation } = await relationWith({ rowReference: "peut-être", outcomeEvent: "Crédit obtenu", direction: "comparison_vs_reference" });
    expect(relation.kind === "relation" && relation.outcome.ok).toBe(false);
  });
});

describe("Provenance déclarée par import", () => {
  it("conservée pour le jeu courant, redemandée pour un nouvel import", async () => {
    const first = await importOk("a.csv", new TextEncoder().encode(FIXTURE));
    const second = await importOk("a.csv", new TextEncoder().encode(FIXTURE));
    expect(first.importId).not.toBe(second.importId);
    const registry = declareProvenance({}, first.importId, { kind: "real_survey", description: "enquête terrain" });
    expect(provenanceFor(registry, first.importId)).toEqual({ kind: "real_survey", description: "enquête terrain" });
    expect(provenanceFor(registry, second.importId)).toBeNull();
    expect(provenanceFor(registry, undefined)).toBeNull();
  });

  it("le rapport distingue la provenance déclarée d'une provenance vérifiée", async () => {
    const { planOf, dataset, preparation, variables, structural, report } = await load();
    const plan = planOf();
    const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset, preparation, variables, alpha: 0.05, independenceConfirmed: true, key: "k", structural });
    const interpretation = buildInterpretation(execution, plan, report, QUESTION, undefined, { provenance: { kind: "real_survey", description: "enquête terrain, mars 2025" } });
    const { journeyDocument, journeySheets } = await import("@/lib/core/export/reports");
    const { buildDocx } = await import("@/lib/core/export/docx");
    const { unzipSync, strFromU8 } = await import("fflate");
    const statement = "Provenance des données déclarée par l'utilisateur : Données d'une enquête réelle — « enquête terrain, mars 2025 ». Cette provenance n'a pas été vérifiée indépendamment par ACADIA.";
    expect(interpretation.provenance.statement).toBe(statement);
    expect(journeySheets({ question: QUESTION, execution, interpretation })[0].rows.flat().join(" ")).toContain(statement);
    const xml = strFromU8(unzipSync(buildDocx(journeyDocument({ question: QUESTION, execution, interpretation })))["word/document.xml"]);
    expect(xml).toContain("n&apos;a pas été vérifiée indépendamment".replace("&apos;", "'")) ;
  });
});
