import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { checkCausality } from "@/lib/core/analysis/InterpretationGuards";
import { buildChain } from "@/lib/core/chain";
import { buildDocx } from "@/lib/core/export/docx";
import { chartsSheet, buildWorkbook } from "@/lib/core/export/xlsx";
import { chartsOf } from "@/lib/core/export/document";
import {
  ambiguousCredit,
  buildChapter,
  buildCriteria,
  companyLabel,
  computeFinance,
  conceptsOf,
  DEMO_RESEARCH,
  demoDossier,
  diagnose,
  evaluateHypotheses,
  financeDocument,
  financeProposals,
  financeReflexes,
  financeSheets,
  indicatorTargets,
  interpretFinance,
  linkStructures,
  runChecks,
  thresholdOf,
} from "@/lib/core/finance";
import { buildUnderstandingReport, emptyDecisions, splitLines, validateResearchInput } from "@/lib/core/understanding";

// Données et sujet FICTIFS (entreprise imaginaire SOKAMA SARL).
const ids = (text: string) => conceptsOf(text).map((c) => c.id);

describe("Concepts financiers du sujet", () => {
  it("expression la plus longue d'abord : pas de collision", () => {
    expect(ids("Le crédit fournisseurs et le délai clients")).toEqual(["credit_fournisseurs", "credit_clients"]);
    expect(ids("Le crédit-bail et le crédit bancaire")).toEqual(["credit_bail", "credit_bancaire"]);
    expect(ids("La rentabilité financière et la rentabilité")).toEqual(["rentabilite_financiere", "rentabilite"]);
    expect(ids("La valeur ajoutée et la création de valeur")).toEqual(["valeur_ajoutee", "creation_valeur"]);
    expect(ids("Les dettes fiscales et les dettes fournisseurs")).toEqual(["fiscalite", "credit_fournisseurs"]);
    expect(ids("L'effet de levier de l'endettement")).toEqual(["effet_levier", "endettement"]);
  });

  it("« crédit » seul n'est rattaché à rien : ACADIA demande de préciser", () => {
    expect(ids("Le crédit et la performance")).toEqual(["performance_financiere"]);
    expect(ambiguousCredit("Le crédit et la performance")).toBe(true);
    expect(ambiguousCredit("Le crédit bancaire et le crédit clients")).toBe(false);
  });

  it("seuils cités dans une hypothèse", () => {
    expect(thresholdOf("La liquidité générale est supérieure à 1,2")).toEqual({ op: ">=", value: 1.2 });
    expect(thresholdOf("L'autonomie financière atteint au moins 30 %")).toEqual({ op: ">=", value: 0.3 });
    expect(thresholdOf("La capacité de remboursement est inférieure à 3 ans")).toEqual({ op: "<=", value: 3 });
    expect(thresholdOf("L'entreprise est solvable")).toBeNull();
  });

  it("propositions : paire endettement → rentabilité, sans répéter ce que l'étudiant a écrit", () => {
    const ctx = { company: "SOKAMA SARL", from: "2021", to: "2023" };
    const p = financeProposals({ subject: "Endettement et rentabilité financière", existing: "" }, ctx);
    expect(p.map((x) => x.kind)).toEqual(["question", "objective", "hypothesis"]);
    expect(p[2].text).toBe("L'endettement améliore la rentabilité financière de SOKAMA SARL (effet de levier positif).");
    const already = financeProposals({ subject: "Endettement et rentabilité financière", existing: p[2].text }, ctx);
    expect(already.some((x) => x.kind === "hypothesis")).toBe(false);
    expect(financeProposals({ subject: "La liquidité de l'entreprise", existing: "" }, ctx).find((x) => x.kind === "hypothesis")!.text).toBe("La liquidité de SOKAMA SARL est satisfaisante sur la période 2021-2023.");
    expect(companyLabel("SOKAMA SARL (entreprise fictive)")).toBe("SOKAMA SARL");
  });
});

describe("Raisonnement sur le sujet d'exemple (fictif)", () => {
  const dossier = demoDossier();
  const v = validateResearchInput({ ...DEMO_RESEARCH, specificQuestions: splitLines(DEMO_RESEARCH.specificQuestions), specificObjectives: splitLines(DEMO_RESEARCH.specificObjectives), hypotheses: splitLines(DEMO_RESEARCH.hypotheses) });
  if (!v.ok) throw new Error("sujet d'exemple invalide");
  const chain = buildChain({ research: v.input, report: buildUnderstandingReport(v.input, emptyDecisions()) });
  const links = linkStructures(chain, v.input.title);
  const targets = indicatorTargets(links);
  const criteria = buildCriteria(links, targets, {});
  const computation = computeFinance(dossier);
  const results = evaluateHypotheses(links, criteria, computation, dossier);
  const diagnosis = diagnose(computation, dossier);
  const reflexes = financeReflexes(computation, dossier, { provenance: "fictifs", acceptedGaps: 0 });
  const reasoning = interpretFinance({ links, results, computation, diagnosis, reflexes, dossier, mainQuestion: v.input.mainQuestion, company: "SOKAMA SARL" });

  it("variables reconnues dans chaque hypothèse (cause → effet)", () => {
    expect(links.map((l) => [l.independent?.id, l.dependent?.id])).toEqual([
      ["endettement", "rentabilite_financiere"],
      ["credit_clients", "tresorerie"],
    ]);
    expect(targets.find((t) => t.key === "concept:credit_clients")!.proposed[0]).toBe("delai_clients");
  });

  it("critères : évolution conjointe et mécanisme comptable pour chaque hypothèse", () => {
    expect(criteria.map((c) => `${c.rowId.slice(-1)}:${c.kind}:${c.expected}:${c.indicators.join("+")}`)).toEqual(["1:comovement:same:gearing+roe", "1:mechanism:positive:levier_ecart", "2:comovement:opposite:delai_clients+tn", "2:mechanism:negative:tn"]);
  });

  it("H1 partiellement compatible (levier positif puis négatif en 2023) ; H2 compatible, jamais « prouvée »", () => {
    expect(results.map((r) => r.verdict)).toEqual(["partially_supported", "supported"]);
    expect(results[0].results.map((r) => r.status)).toEqual(["contraire", "respecte"]);
    expect(results[0].results[1].observed).toContain("En 2023, l'effet s'inverse");
    expect(reasoning.readings[0].mechanism).toContain("retire environ 3,2 points");
    expect(reasoning.readings[1].verdictLabel).toBe("Compatible avec les états financiers (non prouvée)");
    expect(reasoning.mainAnswer).toContain("Hypothèse 1");
  });

  it("une décision de l'étudiant (critère retiré) change le verdict", () => {
    const fewer = buildCriteria(links, targets, {}, { [criteria[0].id]: { enabled: false } });
    expect(evaluateHypotheses(links, fewer, computation, dossier)[0].verdict).toBe("supported");
  });

  it("aucun texte du raisonnement n'emploie un vocabulaire causal sans précaution", () => {
    const texts = [...reasoning.readings.flatMap((r) => [...r.approaches, ...r.distances, r.mechanism ?? "", r.conclusion]), ...reasoning.angles.map((a) => a.text), ...reasoning.limits, reasoning.mainAnswer];
    expect(checkCausality(texts.map((text, i) => ({ field: String(i), text })))).toEqual([]);
  });

  it("chapitre : présentation, diagnostic, analyses des variables, vérification de chaque hypothèse, discussion, limites", () => {
    const plan = buildChapter({ dossier, computation, diagnosis, links, results, reasoning, targets, choices: {}, reflexes, provenance: "fictifs", company: "SOKAMA SARL", acceptedGaps: 0 });
    expect(plan.sections.map((s) => s.id)).toEqual(["presentation", "diagnostic", "concept:endettement", "concept:rentabilite_financiere", `link:${links[0].rowId}`, "concept:credit_clients", "concept:tresorerie", `link:${links[1].rowId}`, "discussion", "limites"]);
    expect(plan.sections[2].draft[0]).toMatch(/Endettement net \/ capitaux propres \(gearing\) passe de 0,76 en 2021 à 1,56 en 2023/);
    const moved = buildChapter({ dossier, computation, diagnosis, links, results, reasoning, targets, choices: {}, reflexes, provenance: "fictifs", company: "SOKAMA SARL", acceptedGaps: 0 }, { order: ["discussion"], removed: ["limites"] });
    expect(moved.sections[0].id).toBe("discussion");
    expect(moved.sections.some((s) => s.id === "limites")).toBe(false);
  });

  it("rapport Word et Excel : courbes natives, mention « données fictives », aucun test statistique", () => {
    const chapter = buildChapter({ dossier, computation, diagnosis, links, results, reasoning, targets, choices: {}, reflexes, provenance: "fictifs", company: "SOKAMA SARL", acceptedGaps: 0 });
    const input = { dossier, computation, diagnosis, reflexes, results, reasoning, chapter, checks: runChecks(dossier), provenance: { kind: "fictifs" as const, description: "" }, acceptedGaps: {}, title: v.input.title, mainQuestion: v.input.mainQuestion, isDemo: true };
    const doc = financeDocument(input, ["#4f46e5", "#0ea5e9", "#10b981"]);
    const files = unzipSync(buildDocx(doc));
    const xml = strFromU8(files["word/document.xml"]);
    expect(xml).toContain("DONNÉES FICTIVES");
    expect(xml).toContain("Vérification de l");
    expect(xml).not.toMatch(/Chi²|p-value|p ajustée/);
    const chartXml = Object.keys(files).filter((f) => f.startsWith("word/charts/chart")).map((f) => strFromU8(files[f]));
    expect(chartXml.some((c) => c.includes("<c:lineChart>"))).toBe(true);
    const workbook = unzipSync(buildWorkbook([...financeSheets(input), chartsSheet(chartsOf(doc))]));
    expect(Object.keys(workbook).some((f) => f.startsWith("xl/charts/"))).toBe(true);
    expect(financeSheets(input).map((s) => s.name)).toEqual(["Synthèse", "États validés", "Contrôles", "Indicateurs", "Hypothèses", "Soutenance", "Lexique"]);
  });
});
