import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { addOperation, createPreparation } from "@/lib/core/data/preparation";
import { profileDataset } from "@/lib/core/data/profile";
import type { PreparationState } from "@/lib/core/data/types";
import { buildUnderstanding } from "@/lib/core/data/understanding";
import { analyzeStructure, buildCartography, buildPlan, emptyMappingDecisions, emptyPlanDecisions, executePlan, executionKey, linkQuestions, type InstrumentKind } from "@/lib/core/journey";
import { applyRouting, classify, datasetView, ENGINES, orchestrate, specialtiesFor, SPECIALTIES, type ClassificationInput, type ClassificationOverrides, type DomainId, type EngineId, type SpecialtyId } from "@/lib/core/orchestrator";
import { buildUnderstandingReport, validateResearchInput } from "@/lib/core/understanding";

import { importOk } from "../data/helpers";

// Tous les fichiers de ce test sont SYNTHÉTIQUES, construits pour vérifier le routage.
const csv = (rows: string[][]) => rows.map((r) => r.map((v) => `"${v}"`).join(";")).join("\n") + "\n";

interface Scenario {
  rows: string[][];
  research: Record<string, unknown>;
  domain?: DomainId | null;
  specialty?: SpecialtyId | null;
  instrument?: InstrumentKind | null;
  types?: Record<number, "nominal" | "ordinal" | "quantitative_continuous">;
  overrides?: ClassificationOverrides;
  extra?: (p: PreparationState) => PreparationState;
}

async function scenario(s: Scenario) {
  const dataset = await importOk("synthetique.csv", new TextEncoder().encode(csv(s.rows)));
  let preparation = createPreparation(dataset);
  for (const [column, type] of Object.entries(s.types ?? {})) preparation = addOperation(preparation, { type: "set_statistical_type", column: Number(column), statisticalType: type });
  if (s.extra) preparation = s.extra(preparation);
  const profile = profileDataset(dataset, preparation);
  const { variables } = buildUnderstanding({ dataset, profile, preparation });
  const structure = analyzeStructure(dataset, profile, variables);
  const validation = validateResearchInput(s.research);
  if (!validation.ok) throw new Error("recherche invalide");
  const input: ClassificationInput = { domain: s.domain ?? null, specialty: s.specialty ?? null, research: validation.input, instrument: s.instrument ?? null, data: datasetView(dataset, preparation, variables, structure), overrides: s.overrides };
  const sheet = classify(input);
  const routing = orchestrate(sheet);
  const step = (id: EngineId) => routing.steps.find((x) => x.engineId === id);
  return { dataset, preparation, variables, structure, input: validation.input, sheet, routing, step, classifyWith: (extra: Partial<ClassificationInput>) => classify({ ...input, ...extra }) };
}

const pick = <T>(list: T[], i: number) => list[i % list.length];

/* ---------------------------------------------------------------- */
/* Jeux de données synthétiques                                      */
/* ---------------------------------------------------------------- */

const SATISFACTION = ["Pas du tout satisfait", "Peu satisfait", "Satisfait", "Très satisfait"];
const hrRows = () => [
  ["Horodateur", "Q1. Dans quel service travaillez-vous ?", "Q2. Êtes-vous satisfait de votre rémunération ?", "Q3. Avez-vous suivi une formation cette année ?", "Q4. Quel est votre sexe ?"],
  ...Array.from({ length: 40 }, (_, i) => [`2025-05-${String((i % 28) + 1).padStart(2, "0")} 10:${String(i % 60).padStart(2, "0")}`, pick(["Comptabilité", "Production", "Logistique", "Commercial"], i), pick(SATISFACTION, (i * 3) % 4), i % 3 === 0 ? "non" : "oui", i % 2 ? "Femme" : "Homme"]),
];
const campaignRows = () => [
  ["Campagne", "Canal", "Date de lancement", "Impressions", "Clics", "Conversions", "Coût (USD)"],
  ...Array.from({ length: 30 }, (_, i) => [`C${100 + i}`, pick(["Facebook", "Radio", "SMS"], i), `2025-0${(i % 3) + 1}-01`, String(5000 + i * 137), String(120 + (i * 7) % 90), String(5 + (i * 3) % 20), String(200 + i * 11)]),
];
const financialRows = () => [
  ["Poste", "Exercice 2022", "Exercice 2023"],
  ["Immobilisations corporelles", "125000", "131000"],
  ["Stocks", "42000", "39000"],
  ["Créances clients", "36000", "41000"],
  ["Trésorerie", "18000", "22500"],
  ["Total actif", "221000", "233500"],
  ["Capitaux propres", "98000", "104000"],
  ["Dettes financières", "70000", "66000"],
  ["Dettes fournisseurs", "53000", "63500"],
  ["Total passif", "221000", "233500"],
  ["Chiffre d'affaires", "310000", "342000"],
  ["Résultat net", "21000", "26000"],
];
const monetaryRows = () => [
  ["Mois", "Taux de change (CDF/USD)", "Inflation mensuelle (%)", "Taux directeur (%)"],
  ...Array.from({ length: 24 }, (_, i) => [`${2023 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`, String(2000 + i * 31.5), String((1.2 + (i % 5) * 0.3).toFixed(2)), String(i < 12 ? 11 : 25)]),
];
const pairedRows = () => [
  ["Participant", "Score avant formation", "Score après formation", "Service"],
  ...Array.from({ length: 30 }, (_, i) => [`P${i + 1}`, String(40 + (i * 7) % 30), String(48 + (i * 5) % 35), pick(["A", "B"], i)]),
];

const CREDIT_QUESTION = "La disponibilité d'une garantie est-elle associée au résultat de la dernière demande de crédit des entrepreneures ?";
const creditRows = () => readFileSync("tests/fixtures/acadia-parcours-credit-50.csv", "utf8").trim().split("\n").map((l) => l.split(";").map((c) => c.replace(/^"|"$/g, "")));
const CREDIT = { title: CREDIT_QUESTION, mainQuestion: CREDIT_QUESTION, generalObjective: "Examiner la relation entre la disponibilité d'une garantie et le résultat de la dernière demande de crédit.", hypotheses: ["La disponibilité d'une garantie est associée au résultat de la dernière demande de crédit."], population: "Femmes entrepreneures de Lubumbashi" };
const GUARANTEE = 11;
const RESULT = 12;
const MARKET = 4;

/* ---------------------------------------------------------------- */
/* Référentiel                                                       */
/* ---------------------------------------------------------------- */

describe("Référentiel des domaines et spécialités", () => {
  it("affiche seulement les spécialités du domaine choisi ; les spécialités prévues restent masquées", () => {
    expect(specialtiesFor("management").map((s) => s.label)).toEqual(["Ressources humaines", "Marketing et gestion commerciale", "Entrepreneuriat et PME", "Gestion financière", "Autre spécialité en gestion"]);
    expect(specialtiesFor("economics").map((s) => s.label)).toEqual(["Économie monétaire et bancaire", "Économie du développement", "Économie rurale", "Économie générale ou autre spécialité économique"]);
    expect(SPECIALTIES.filter((s) => s.status === "planned").map((s) => s.id)).toEqual(["management_information_systems", "customs"]);
  });

  it("registre : 4 moteurs opérationnels réellement testés, les autres seulement prévus", () => {
    const operational = ENGINES.filter((e) => e.status === "operational");
    expect(operational.map((e) => e.id)).toEqual(["research-understanding", "data-preparation", "descriptive-statistics", "inferential-statistics"]);
    for (const e of operational) for (const file of e.validationTests) expect(existsSync(file), file).toBe(true);
    for (const e of ENGINES.filter((x) => x.status === "planned")) {
      expect(e.validationTests).toEqual([]);
      expect(e.entryPoint).toBeNull();
    }
  });
});

/* ---------------------------------------------------------------- */
/* Routage par cas                                                   */
/* ---------------------------------------------------------------- */

describe("Routage des études", () => {
  it("Gestion → Ressources humaines → questionnaire de satisfaction", async () => {
    const { sheet, routing, step } = await scenario({
      rows: hrRows(),
      domain: "management",
      specialty: "hr",
      instrument: "questionnaire",
      research: { title: "Satisfaction du personnel d'une entreprise de Lubumbashi", generalObjective: "Décrire la satisfaction du personnel.", specificObjectives: ["Comparer la satisfaction selon la formation suivie."] },
    });
    expect(sheet.source).toMatchObject({ value: "survey", origin: "user" });
    expect(sheet.unit.value).toBe("individual");
    expect(["cross_sectional", "grouped_hierarchical"]).toContain(sheet.structure.value);
    expect(sheet.objectives.map((o) => o.value)).toEqual(expect.arrayContaining(["describe", "compare"]));
    expect(step("descriptive-statistics")?.status).toBe("ready");
    expect(step("inferential-statistics")?.status).toBe("ready");
    expect(routing.perspective).toContain("ressources humaines");
    expect(routing.steps.some((s) => s.engineId === "causal-evaluation")).toBe(false);
  });

  it("Gestion → Marketing → données de campagne : comparaisons possibles, unité = opération", async () => {
    const { sheet, step, routing } = await scenario({
      rows: campaignRows(),
      domain: "management",
      specialty: "marketing",
      research: { title: "Performance des campagnes publicitaires d'un opérateur", generalObjective: "Comparer les conversions selon le canal de diffusion.", specificObjectives: ["Décrire les campagnes et leurs conversions."] },
    });
    expect(sheet.source.value).toBe("transactional");
    expect(sheet.unit.value).toBe("transaction");
    expect(sheet.structure.value).toBe("cross_sectional");
    expect(step("descriptive-statistics")?.status).toBe("ready");
    expect(step("inferential-statistics")?.status).toBe("ready");
    expect(routing.perspective).toContain("une association n'est pas l'effet d'une campagne");
  });

  it("Gestion → Gestion financière → états financiers : aucun test classique, moteur financier signalé non disponible", async () => {
    const { sheet, step, routing } = await scenario({
      rows: financialRows(),
      domain: "management",
      specialty: "finance",
      research: { title: "Diagnostic financier de la société X", generalObjective: "Diagnostiquer la santé financière de la société X sur deux exercices." },
    });
    expect(sheet.source.value).toBe("financial_statements");
    expect(sheet.unit.value).toBe("accounting_item");
    expect(step("inferential-statistics")).toMatchObject({ status: "excluded" });
    expect(step("inferential-statistics")?.reason).toContain("pas des observations indépendantes");
    expect(step("financial-statements")).toMatchObject({ status: "unavailable" });
    expect(step("financial-statements")?.alternatives.join(" ")).toContain("Statistiques descriptives");
    expect(step("descriptive-statistics")?.status).toBe("ready");
    expect(routing.inferentialAllowed).toBe(false);
  });

  it("Économie → Économie monétaire → série temporelle : ni Chi² ni ANOVA ; moteur de séries temporelles prévu", async () => {
    const { sheet, step, routing, dataset, preparation, variables, structure, input } = await scenario({
      rows: monetaryRows(),
      domain: "economics",
      specialty: "monetary_banking",
      types: { 1: "quantitative_continuous", 2: "quantitative_continuous" },
      research: { title: "Taux de change et inflation en RDC", generalObjective: "Analyser l'évolution du taux de change et de l'inflation.", hypotheses: ["Le taux de change est associé à l'inflation mensuelle."] },
    });
    expect(sheet.source.value).toBe("economic_time_series");
    expect(sheet.structure.value).toBe("time_series");
    expect(sheet.unit.value).toBe("economic_period");
    expect(step("inferential-statistics")?.status).toBe("excluded");
    expect(step("inferential-statistics")?.reason).toContain("le Chi² et l'ANOVA classiques");
    expect(step("time-series")?.status).toBe("unavailable");
    // Le plan détaillé du parcours ne lance aucun test de relation.
    const report = buildUnderstandingReport(input);
    const cartography = buildCartography({ report, structure, questions: [], links: linkQuestions([], structure), decisions: emptyMappingDecisions() });
    const plan = applyRouting(buildPlan({ report, cartography, structure, dataset, preparation, variables, instrument: null, mainQuestion: input.title }), routing);
    expect(plan.items.filter((i) => i.level === "relation" && i.feasible)).toEqual([]);
    for (const item of plan.items.filter((i) => i.level === "relation")) expect(item.blocker).toContain("orchestrateur");
  });

  it("Économie → Économie du développement → enquête sur le crédit : bonnes variables, Chi² justifié, marché en contexte", async () => {
    const { sheet, routing, step, dataset, preparation, variables, structure, input } = await scenario({
      rows: creditRows(),
      domain: "economics",
      specialty: "development",
      instrument: "questionnaire",
      types: { [GUARANTEE]: "nominal", [RESULT]: "nominal", [MARKET]: "nominal" },
      research: CREDIT,
    });
    expect(sheet.source.value).toBe("survey");
    expect(sheet.unit.value).toBe("individual");
    expect(sheet.structure.value).toBe("cross_sectional");
    expect(sheet.variables.find((v) => v.column === GUARANTEE)?.nature).toMatchObject({ value: "nominal", origin: "user" });
    expect(step("inferential-statistics")?.status).toBe("ready");
    const report = buildUnderstandingReport(input);
    const cartography = buildCartography({ report, structure, questions: [], links: linkQuestions([], structure), decisions: emptyMappingDecisions() });
    const plan = applyRouting(buildPlan({ report, cartography, structure, dataset, preparation, variables, instrument: "questionnaire", mainQuestion: CREDIT_QUESTION }), routing);
    const main = plan.items.find((i) => i.tier === "main")!;
    expect(main).toMatchObject({ level: "relation", feasible: true, method: "chi_square", outcomeColumn: RESULT, explanatoryColumn: GUARANTEE });
    expect(main.variables.find((v) => v.column === RESULT)?.role).toBe("à expliquer");
    expect(plan.items.some((i) => i.level === "relation" && i.columns.includes(MARKET))).toBe(false);
    expect(cartography.units.find((u) => u.unit.primaryColumn === MARKET)?.role).toBe("context");
    expect(routing.perspective).toContain("sélection des répondants");
  });

  it("sans objectif de relation, le Chi² n'est pas proposé même si les variables le permettent", async () => {
    const { step, routing, dataset, preparation, variables, structure, input } = await scenario({
      rows: creditRows(),
      domain: "economics",
      specialty: "development",
      instrument: "questionnaire",
      types: { [GUARANTEE]: "nominal", [RESULT]: "nominal" },
      research: { title: "Accès au crédit des entrepreneures de Lubumbashi", generalObjective: "Décrire la disponibilité d'une garantie et le résultat de la dernière demande de crédit." },
    });
    expect(step("inferential-statistics")?.status).toBe("not_needed");
    const report = buildUnderstandingReport(input);
    const cartography = buildCartography({ report, structure, questions: [], links: linkQuestions([], structure), decisions: emptyMappingDecisions() });
    const plan = applyRouting(buildPlan({ report, cartography, structure, dataset, preparation, variables, instrument: "questionnaire", mainQuestion: input.title }), routing);
    expect(plan.items.filter((i) => i.level === "relation" && i.feasible)).toEqual([]);
    expect(plan.items.some((i) => i.level === "descriptive" && i.feasible)).toBe(true);
  });

  it("le mot « impact » n'impose pas une analyse causale", async () => {
    const { step } = await scenario({
      rows: creditRows(),
      domain: "economics",
      specialty: "development",
      instrument: "questionnaire",
      types: { [GUARANTEE]: "nominal", [RESULT]: "nominal" },
      research: { ...CREDIT, generalObjective: "Évaluer l'impact de la garantie sur le résultat de la demande de crédit." },
    });
    expect(step("inferential-statistics")?.status).toBe("ready");
    expect(step("inferential-statistics")?.conditions.join(" ")).toContain("association, pas l'effet causal");
    expect(step("causal-evaluation")?.status).toBe("unavailable");
  });

  it("étude interdisciplinaire : routage déterminé par les données et l'objectif, perspective interdisciplinaire", async () => {
    const { sheet, step, routing } = await scenario({ rows: hrRows(), domain: "interdisciplinary", specialty: "interdisciplinary_other", instrument: "questionnaire", research: { title: "Santé au travail et satisfaction", generalObjective: "Examiner le lien entre la formation et la satisfaction." } });
    expect(sheet.domain).toMatchObject({ value: "interdisciplinary", origin: "user" });
    expect(step("inferential-statistics")?.status).toBe("ready");
    expect(routing.perspective).toContain("interdisciplinaire");
  });

  it("domaine ambigu : domaine proposé (non validé) et question de clarification, sans effet sur les méthodes", async () => {
    const { sheet, step } = await scenario({ rows: hrRows(), instrument: "questionnaire", research: { title: "Crédit bancaire et satisfaction du personnel", generalObjective: "Comparer la satisfaction selon la formation." } });
    expect(sheet.domain.origin).toBe("proposed");
    expect(sheet.domain.confirmed).toBe(false);
    expect(sheet.uncertainties.map((u) => u.id)).toContain("domain");
    expect(step("inferential-statistics")?.status).toBe("ready");
  });

  it("données à structure mixte : question posée, aucun test tant que la structure n'est pas confirmée", async () => {
    const rows = [["Mois", "Score avant formation", "Score après formation"], ...Array.from({ length: 12 }, (_, i) => [`2024-${String(i + 1).padStart(2, "0")}`, String(40 + i), String(45 + i)])];
    const { sheet, step, classifyWith } = await scenario({ rows, research: { title: "Effet d'une formation", generalObjective: "Comparer les scores avant et après la formation." } });
    expect(sheet.structure).toMatchObject({ value: "mixed_undetermined", confidence: "low" });
    expect(sheet.uncertainties.find((u) => u.id === "structure")?.options.map((o) => o.value)).toEqual(expect.arrayContaining(["time_series", "paired_repeated"]));
    expect(step("inferential-statistics")?.status).toBe("to_confirm");
    // Réponse de l'utilisateur : mesures appariées.
    const confirmed = orchestrate(classifyWith({ overrides: { structure: "paired_repeated" } }));
    expect(confirmed.steps.find((s) => s.engineId === "inferential-statistics")?.status).toBe("excluded");
    expect(confirmed.steps.find((s) => s.engineId === "paired-tests")?.status).toBe("unavailable");
  });

  it("mesures appariées (avant/après) : tests pour groupes indépendants exclus, tests appariés prévus", async () => {
    const { sheet, step } = await scenario({ rows: pairedRows(), domain: "management", specialty: "hr", types: { 1: "quantitative_continuous", 2: "quantitative_continuous" }, research: { title: "Effet d'une formation sur les compétences", generalObjective: "Comparer les scores avant et après la formation." } });
    expect(sheet.structure.value).toBe("paired_repeated");
    expect(step("inferential-statistics")?.status).toBe("excluded");
    expect(step("paired-tests")?.status).toBe("unavailable");
    expect(step("descriptive-statistics")?.status).toBe("ready");
  });

  it("recherche exploratoire : aucune variable dépendante ni test imposé", async () => {
    const { step } = await scenario({ rows: hrRows(), domain: "management", specialty: "hr", instrument: "questionnaire", research: { title: "Profil du personnel", generalObjective: "Décrire le profil et la satisfaction du personnel." } });
    expect(step("inferential-statistics")?.status).toBe("not_needed");
    expect(step("descriptive-statistics")?.status).toBe("ready");
  });
});

describe("Moteur non implémenté, changements de domaine et de fichier", () => {
  it("demander un moteur non implémenté : explication, alternatives, aucun calcul simulé", async () => {
    const { sheet } = await scenario({ rows: creditRows(), domain: "economics", specialty: "development", instrument: "questionnaire", research: CREDIT });
    const routing = orchestrate(sheet, { requested: ["econometrics"] });
    const step = routing.steps.find((s) => s.engineId === "econometrics")!;
    expect(step).toMatchObject({ status: "unavailable", requested: true });
    expect(step.reason).toContain("Aucun calcul de remplacement n'est simulé");
    expect(step.alternatives.length).toBeGreaterThan(0);
  });

  it("changer de domaine ou de spécialité ne touche ni aux données ni aux méthodes admissibles", async () => {
    const { classifyWith, dataset, routing } = await scenario({ rows: creditRows(), domain: "economics", specialty: "development", instrument: "questionnaire", types: { [GUARANTEE]: "nominal", [RESULT]: "nominal" }, research: CREDIT });
    const before = JSON.stringify(dataset.rows);
    const other = orchestrate(classifyWith({ domain: "management", specialty: "entrepreneurship" }));
    expect(other.inferentialAllowed).toBe(routing.inferentialAllowed);
    expect(other.steps.map((s) => [s.engineId, s.status])).toEqual(routing.steps.map((s) => [s.engineId, s.status]));
    expect(other.perspective).not.toBe(routing.perspective);
    expect(JSON.stringify(dataset.rows)).toBe(before);
  });

  it("modifier le fichier après validation du plan : nouvelle empreinte, calculs rattachés à l'ancien jeu", async () => {
    const first = await scenario({ rows: creditRows(), domain: "economics", specialty: "development", instrument: "questionnaire", types: { [GUARANTEE]: "nominal", [RESULT]: "nominal" }, research: CREDIT });
    const second = await scenario({ rows: creditRows(), domain: "economics", specialty: "development", instrument: "questionnaire", types: { [GUARANTEE]: "nominal", [RESULT]: "nominal" }, research: CREDIT });
    const report = buildUnderstandingReport(first.input);
    const cartography = buildCartography({ report, structure: first.structure, questions: [], links: [], decisions: emptyMappingDecisions() });
    const plan = buildPlan({ report, cartography, structure: first.structure, dataset: first.dataset, preparation: first.preparation, variables: first.variables, instrument: "questionnaire", mainQuestion: CREDIT_QUESTION });
    const key = executionKey(plan, emptyPlanDecisions(), first.preparation, {});
    expect(executionKey(plan, emptyPlanDecisions(), second.preparation, {})).not.toBe(key);
    const execution = executePlan({ plan, decisions: emptyPlanDecisions(), dataset: first.dataset, preparation: first.preparation, variables: first.variables, alpha: 0.05, independenceConfirmed: true, key });
    expect(execution.datasetId).toBe(first.dataset.importId);
    expect(execution.datasetId).not.toBe(second.dataset.importId);
  });

  it("un type confirmé par l'utilisateur n'est jamais modifié ; le format du fichier ne décide pas de la nature des données", async () => {
    const { sheet } = await scenario({ rows: creditRows(), instrument: "questionnaire", types: { [MARKET]: "nominal" }, research: CREDIT });
    const market = sheet.variables.find((v) => v.column === MARKET)!;
    expect(market.nature).toMatchObject({ value: "nominal", origin: "user", confirmed: true });
    expect(market.tags).toContain("geographic");
    expect(market.id).toBe(`col:${MARKET}`);
    const financial = await scenario({ rows: financialRows(), research: { title: "Analyse de la société X" } });
    expect(financial.sheet.source.value).toBe("financial_statements");
  });
});
