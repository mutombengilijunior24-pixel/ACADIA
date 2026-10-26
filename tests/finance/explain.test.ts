import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { checkCausality } from "@/lib/core/analysis/InterpretationGuards";
import { buildChain } from "@/lib/core/chain";
import { buildDocx } from "@/lib/core/export/docx";
import {
  buildChapter,
  buildCriteria,
  computeFinance,
  DEMO_RESEARCH,
  defenseOf,
  demoDossier,
  diagnose,
  evaluateHypotheses,
  explainIndicator,
  financeDocument,
  financeReflexes,
  financeSheets,
  GLOSSARY,
  indicatorTargets,
  interpretFinance,
  linkStructures,
  runChecks,
} from "@/lib/core/finance";
import { buildUnderstandingReport, emptyDecisions, splitLines, validateResearchInput } from "@/lib/core/understanding";

// Données et sujet FICTIFS (entreprise imaginaire SOKAMA SARL).
const dossier = demoDossier();
const computation = computeFinance(dossier);
const last = (id: string) => explainIndicator(id, computation, dossier)!.lines.at(-1)!;

describe("Comment chaque chiffre a été obtenu", () => {
  it("formule écrite avec les montants des états, étape par étape", () => {
    expect(last("gearing").steps).toEqual(["Endettement net = DA + DB + DT − BT = 2 040 000 + 0 + 473 176 − 60 000 = 2 453 176", "Endettement net / capitaux propres = Endettement net ÷ CP = 2 453 176 ÷ 1 568 911 = 1,56"]);
    expect(last("roe").steps).toEqual(["Rentabilité financière = XI ÷ CP = 94 176 ÷ 1 568 911 = 0,06, soit 6 %"]);
    expect(last("delai_clients").steps).toEqual(["Délai moyen de recouvrement des créances clients = BI ÷ (XB × (1 + TVA)) × jours = 1 782 417 ÷ (8 922 000 × (1 + 0,16)) × 360 = 62 jours"]);
    expect(last("bfe").steps).toEqual(["Besoin de financement d'exploitation (BFE) = BK − BA − (DP − DH) = 3 166 150 − 0 − (1 499 063 − 0) = 1 667 087"]);
    expect(last("capacite_remb").steps).toEqual([
      "Dettes financières = DA + DB = 2 040 000 + 0 = 2 040 000",
      "CAFG = XD + TK + TM + TO − RM − RP − RQ − RS = 530 250 + 1 000 + 0 + 0 − 326 713 − 0 − 0 − 40 361 = 164 176",
      "Capacité de remboursement = Dettes financières ÷ CAFG = 2 040 000 ÷ 164 176 = 12,4 ans",
    ]);
    expect(last("croissance_ca").steps[0]).toBe("Croissance : Chiffre d'affaires = XB ÷ XB de l'exercice précédent − 1 = 8 922 000 ÷ 7 146 000 − 1 = 0,25, soit 24,9 %");
  });

  it("chaque exercice est détaillé ; un exercice non calculable l'est avec sa raison", () => {
    const e = explainIndicator("croissance_ca", computation, dossier)!;
    expect(e.lines.map((l) => l.exercise)).toEqual(["2021", "2022", "2023"]);
    expect(e.lines[0].unavailable).toBe("il faut l'exercice précédent");
    expect(e.legend).toBe("XB : chiffre d'affaires");
  });

  it("ce que cela signifie : en clair, au regard du repère du secteur, dans le temps", () => {
    const meaning = explainIndicator("delai_clients", computation, dossier)!.meaning;
    expect(meaning[0]).toMatch(/^En clair : /);
    expect(meaning[2]).toContain("c'est défavorable au regard du repère usuel pour le secteur « commerce »");
    expect(meaning[3]).toBe("Évolution : 38 j (2021) → 50 j (2022) → 62 j (2023) : hausse, c'est une dégradation.");
  });
});

describe("Préparer la soutenance et rapport complet", () => {
  const v = validateResearchInput({ ...DEMO_RESEARCH, specificQuestions: splitLines(DEMO_RESEARCH.specificQuestions), specificObjectives: splitLines(DEMO_RESEARCH.specificObjectives), hypotheses: splitLines(DEMO_RESEARCH.hypotheses) });
  if (!v.ok) throw new Error("sujet d'exemple invalide");
  const chain = buildChain({ research: v.input, report: buildUnderstandingReport(v.input, emptyDecisions()) });
  const links = linkStructures(chain, v.input.title);
  const targets = indicatorTargets(links);
  const results = evaluateHypotheses(links, buildCriteria(links, targets, {}), computation, dossier);
  const diagnosis = diagnose(computation, dossier);
  const reflexes = financeReflexes(computation, dossier, { provenance: "fictifs", acceptedGaps: 0 });
  const reasoning = interpretFinance({ links, results, computation, diagnosis, reflexes, dossier, mainQuestion: v.input.mainQuestion, company: "SOKAMA SARL" });
  const chapter = buildChapter({ dossier, computation, diagnosis, links, results, reasoning, targets, choices: {}, reflexes, provenance: "fictifs", company: "SOKAMA SARL", acceptedGaps: 0 });
  const input = { dossier, computation, diagnosis, reflexes, results, reasoning, chapter, checks: runChecks(dossier), provenance: { kind: "fictifs" as const, description: "" }, acceptedGaps: {}, title: v.input.title, mainQuestion: v.input.mainQuestion, isDemo: true };
  const kit = defenseOf(input);

  it("l'essentiel à dire : données, état de l'entreprise, chaque hypothèse avec ses chiffres, prudence, recommandation", () => {
    expect(kit.pitch[0]).toBe("J'ai analysé les états financiers de SOKAMA SARL sur 3 exercices, de 2021 à 2023 : bilan, compte de résultat et tableau des flux de trésorerie, établis selon le SYSCOHADA révisé, en milliers de CDF.");
    expect(kit.pitch[2]).toContain("Mais « endettement net / capitaux propres » passe de 0,76 en 2021 à 1,56 en 2023, pendant que « rentabilité financière » passe de 15,4 % en 2021 à 6 % en 2023.");
    expect(kit.pitch[3]).toContain("« délai moyen de recouvrement des créances clients » passe de 38 j en 2021 à 62 j en 2023");
    expect(kit.pitch.join(" ")).toContain("je ne conclus pas à une relation de cause à effet.");
  });

  it("questions du jury : fiabilité des chiffres, verdict, mesure de chaque variable (calcul chiffré), hypothèses, absence de test, inflation, limites", () => {
    const q = Object.fromEntries(kit.questions.map((x) => [x.question, x.answer]));
    expect(q["D'où viennent vos chiffres ? Sont-ils fiables ?"]).toContain("total actif = total passif = 5 601 150 milliers de CDF en 2023");
    expect(q["Comment avez-vous mesuré « endettement » ?"]).toContain("2 453 176 ÷ 1 568 911 = 1,56");
    expect(q["Comment avez-vous mesuré « crédit clients » ?"]).toContain("= 62 jours");
    expect(q["Hypothèse 1 : votre hypothèse est-elle confirmée ?"]).toMatch(/^Partiellement compatible/);
    expect(Object.keys(q)).toEqual(expect.arrayContaining(["Pourquoi n'avez-vous pas fait de test statistique (corrélation, régression) ?", "Qu'est-ce que l'effet de levier et que montre-t-il ici ?", "Comment expliquez-vous l'évolution de la trésorerie ?", "Les montants sont en francs congolais : l'inflation ne fausse-t-elle pas vos conclusions ?", "Quelles sont les limites de votre travail ?", "Que recommandez-vous à l'entreprise ?"]));
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30);
  });

  it("aucune phrase du kit n'emploie un vocabulaire causal sans précaution", () => {
    const texts = [...kit.pitch, ...kit.questions.map((x) => x.answer), ...GLOSSARY.map((g) => g.plain)];
    expect(checkCausality(texts.map((text, i) => ({ field: String(i), text })))).toEqual([]);
  });

  it("rapport Word : l'essentiel à dire, calculs détaillés et leur sens, soutenance, lexique, note sur les graphiques modifiables", () => {
    const xml = strFromU8(unzipSync(buildDocx(financeDocument(input, ["#4f46e5", "#0ea5e9", "#10b981"])))["word/document.xml"]);
    for (const text of ["L'essentiel à dire à l'oral", "Comment ces chiffres ont été obtenus, et ce qu'ils signifient", "2 453 176 ÷ 1 568 911 = 1,56", "1 782 417 ÷ (8 922 000 × (1 + 0,16)) × 360 = 62 jours", "Ce que cela signifie", "Préparer la soutenance", "Lexique", "Activer la modification", "trésorerie nette = fonds de roulement − besoin de financement"]) expect(xml, text).toContain(text);
  });

  it("Excel : calcul détaillé et signification de chaque indicateur, feuilles « Soutenance » et « Lexique »", () => {
    const sheets = financeSheets(input);
    expect(sheets.map((s) => s.name)).toEqual(["Synthèse", "États validés", "Contrôles", "Indicateurs", "Hypothèses", "Soutenance", "Lexique"]);
    const indicators = sheets.find((s) => s.name === "Indicateurs")!.rows;
    const gearing = indicators.find((r) => r[1] === "Endettement net / capitaux propres (gearing)")!;
    expect(String(gearing.at(-2))).toBe("2023 : Endettement net = DA + DB + DT − BT = 2 040 000 + 0 + 473 176 − 60 000 = 2 453 176 ; Endettement net / capitaux propres = Endettement net ÷ CP = 2 453 176 ÷ 1 568 911 = 1,56");
  });
});
