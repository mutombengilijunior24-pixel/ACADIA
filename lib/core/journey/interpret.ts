/**
 * Interprétation finale, organisée autour de la recherche (A à F).
 * Chaque paragraphe indique son origine : « calcul » (valeurs produites par les moteurs) ou
 * « règles » (formulation déterministe d'ACADIA). Aucune IA ici ; rien n'est affirmé au-delà des calculs.
 */
import { fmt, fmtP, type AnalysisReport } from "@/lib/core/analysis/inferential";
import type { UnderstandingReport } from "@/lib/core/understanding";

import { CONSISTENCY_LABELS, type ConsistencyIssue } from "./consistency";
import type { Execution } from "./execute";
import { coverObjectives, type CoverageAnalysis, type ObjectiveCoverage } from "./objectives";
import type { PopulationGap } from "./population";
import type { AnalysisPlan } from "./plan";
import { evidenceWording, PROVENANCE_LABELS, provenanceStatement, provenanceWarning, UNDECLARED, type DataProvenance } from "./provenance";

export interface InterpretationContext {
  /** Provenance déclarée du jeu de données (« unknown » si non renseignée). */
  provenance?: DataProvenance;
  /** Couples de réponses signalés (jamais corrigés). */
  consistency?: ConsistencyIssue[];
  /** Écarts entre la population ciblée et l'échantillon observé (répondants jamais exclus d'office). */
  populationGaps?: PopulationGap[];
}

export type ParagraphOrigin = "calcul" | "règles";

export interface Paragraph {
  text: string;
  origin: ParagraphOrigin;
}

export type HypothesisVerdict = "compatible" | "not_supported" | "contrary" | "unreliable" | "not_examined";

export const VERDICT_LABELS: Record<HypothesisVerdict, string> = {
  compatible: "Compatible avec les données (non prouvée)",
  not_supported: "Non soutenue par ces données (non réfutée)",
  contrary: "Sens observé contraire à l'hypothèse",
  unreliable: "Non concluant : conditions du test non satisfaites",
  not_examined: "Non examinée",
};

/** Cadre de la recherche (moteur de compréhension) confronté aux analyses réalisées. */
export interface ResearchFramework {
  problem: string;
  generalObjective: string;
  specificObjectives: string[];
}

export { OBJECTIVE_LABELS, type ObjectiveStatus } from "./objectives";

export interface Interpretation {
  provenance: { value: DataProvenance; label: string; warning: string | null; statement: string };
  framework: {
    problem: Paragraph | null;
    objectives: ObjectiveCoverage[];
  };
  data: Paragraph[];
  meaning: Paragraph[];
  hypotheses: Array<{ text: string; verdict: HypothesisVerdict; detail: string }>;
  answer: Paragraph[];
  limits: string[];
  conclusion: Paragraph[];
}

function expectsDirection(text: string): "positive" | "negative" | undefined {
  if (/positiv|augment|plus [eé]lev|sup[eé]rieur|favoris|am[eé]lior|facilit/i.test(text)) return "positive";
  if (/n[eé]gativ|diminu|r[eé]dui|inf[eé]rieur|moins [eé]lev|limit|freine/i.test(text)) return "negative";
  return undefined;
}

function resultSentence(report: AnalysisReport): string {
  const effect = report.effect ? `, ${report.effect.name} = ${fmt(report.effect.value)} (ampleur ${report.effect.magnitude})` : "";
  return `${report.methodLabel} sur ${report.data.n} observation(s) : ${report.statistic.name} = ${fmt(report.statistic.value)} (ddl ${report.statistic.df}), p ${fmtP(report.pValue)}${effect}.`;
}

export function buildInterpretation(execution: Execution, plan: AnalysisPlan, understanding: UnderstandingReport, mainQuestion: string, research?: ResearchFramework, context: InterpretationContext = {}): Interpretation {
  const provenance = context.provenance ?? UNDECLARED;
  const warning = provenanceWarning(provenance);
  const wording = evidenceWording(provenance);
  const data: Paragraph[] = [];
  const meaning: Paragraph[] = [];
  const limits = new Set<string>();
  const relationReports: Array<{ report: AnalysisReport; itemTitle: string; hypotheses: string[] }> = [];
  if (warning) limits.add(warning);

  for (const executed of execution.items) {
    if (executed.kind === "descriptive") {
      if (executed.blocked) limits.add(`« ${executed.item.title} » non calculée : ${executed.blocked}`);
      for (const result of executed.results) {
        const structural = executed.structural.find((s) => s.column === result.column);
        // Dénominateur explicite : répondants éligibles, réponses structurelles hors dénominateur.
        const base = structural
          ? `n = ${result.valid} répondant(s) éligible(s) ; ${structural.count} « ${structural.values.join(" / ")} » hors dénominateur`
          : `n = ${result.valid}`;
        if (result.valid === 0) {
          data.push({ origin: "calcul", text: `« ${result.header} » : aucune réponse valide.` });
          continue;
        }
        if (result.kind === "quantitative") {
          data.push({ origin: "calcul", text: `« ${result.header} » (${base}) : moyenne ${fmt(result.mean ?? NaN)}, médiane ${fmt(result.median ?? NaN)}, écart-type ${fmt(result.sdSample ?? NaN)}.` });
        } else {
          const top = [...result.frequencies].sort((a, b) => b.count - a.count).slice(0, 3);
          data.push({ origin: "calcul", text: `« ${result.header} » (${base}) : ${top.map((f) => `${f.value} ${fmt(f.percent, 1)} % (${f.count}/${result.valid})`).join(" ; ")}${result.frequencies.length > 3 ? " ; …" : ""}.` });
        }
        const ordinaryMissing = result.missing - (structural?.count ?? 0);
        if (ordinaryMissing > 0) limits.add(`« ${result.header} » : ${ordinaryMissing} réponse(s) manquante(s) ou déclarée(s) comme non-réponse, exclue(s) des pourcentages.`);
      }
      for (const skipped of executed.skipped) limits.add(`« ${skipped.header} » non décrite : ${skipped.reason}`);
      continue;
    }
    if (!executed.outcome.ok) {
      limits.add(`« ${executed.item.title} » n'a pas pu être calculée : ${executed.outcome.reason}`);
      continue;
    }
    const report = executed.outcome.report;
    relationReports.push({ report, itemTitle: executed.item.title, hypotheses: executed.item.hypotheses });
    data.push({ origin: "calcul", text: `${executed.item.title} — ${resultSentence(report)}` });
    meaning.push({ origin: "règles", text: report.pInterpretation });
    if (report.effect) meaning.push({ origin: "règles", text: `${report.effect.name} = ${fmt(report.effect.value)} : intensité ${report.effect.magnitude} selon des repères indicatifs. ${report.effect.explanation}` });
    if (!report.reliable) meaning.push({ origin: "règles", text: `Pour « ${executed.item.title} », les conditions d'application ne sont pas satisfaites : ce résultat ne peut pas être présenté comme établi.${report.detail.kind === "chi_square" && report.detail.result.fisher ? ` Le test exact de Fisher donne p ${fmtP(report.detail.result.fisher.pValue)}.` : ""}` });
    for (const limit of report.limits) limits.add(limit);
  }
  // Seuls les signaux de gravité moyenne ou élevée figurent dans les limites (les situations inhabituelles restent au diagnostic).
  for (const issue of (context.consistency ?? []).filter((i) => i.severity !== "low")) limits.add(`${CONSISTENCY_LABELS[issue.category]} — ${issue.problem} ${issue.justification}`);
  for (const gap of context.populationGaps ?? []) limits.add(gap.message);
  for (const item of plan.items.filter((i) => !i.feasible)) limits.add(`Analyse non réalisable — ${item.title} : ${item.blocker}`);
  for (const missing of plan.missingForConclusion) limits.add(missing);
  if (execution.multipleTesting) limits.add(execution.multipleTesting);

  const hypotheses = understanding.hypotheses.map((h) => {
    const linked = relationReports.find((r) => r.hypotheses.includes(h.text));
    if (!linked) return { text: h.text, verdict: "not_examined" as const, detail: "Aucune analyse réalisée ne porte sur les concepts de cette hypothèse." };
    const { report } = linked;
    const expected = expectsDirection(h.text);
    const observed = report.detail.kind === "pearson" || report.detail.kind === "spearman" ? (report.effect && report.effect.value > 0 ? "positive" : "negative") : undefined;
    if (!report.reliable) return { text: h.text, verdict: "unreliable" as const, detail: `${resultSentence(report)} Les conditions du test ne sont pas réunies : aucune conclusion ferme.` };
    if (!report.significant) return { text: h.text, verdict: "not_supported" as const, detail: `${resultSentence(report)} Au seuil α = ${fmt(report.alpha)}, l'hypothèse nulle n'est pas rejetée ; cela ne prouve pas l'absence de relation.` };
    if (expected && observed && expected !== observed) return { text: h.text, verdict: "contrary" as const, detail: `${resultSentence(report)} La relation observée va dans le sens inverse de celui attendu.` };
    return { text: h.text, verdict: "compatible" as const, detail: `${resultSentence(report)} L'hypothèse nulle est rejetée au seuil α = ${fmt(report.alpha)} : résultat compatible avec l'hypothèse de recherche, qui n'est pas pour autant prouvée (échantillon, causalité, autres facteurs).` };
  }).map((h) => (warning && h.verdict !== "not_examined" ? { ...h, detail: `${h.detail} Portée : ${wording.scope}.` } : h));

  const question = mainQuestion.trim() || understanding.mainQuestion?.text || "";
  const answer: Paragraph[] = [];
  if (!relationReports.length) {
    answer.push({ origin: "règles", text: question ? `Aucun test de relation n'a été réalisé : les analyses effectuées décrivent les variables mais ne permettent pas de répondre à la question « ${question} » sur une relation.` : "Aucun test de relation n'a été réalisé." });
  } else {
    for (const { report, itemTitle } of relationReports) {
      const verdict = !report.reliable
        ? "les données ne permettent pas de conclure de façon fiable, car les conditions du test ne sont pas réunies (effectifs insuffisants)"
        : report.significant
          ? `les données mettent en évidence une association statistiquement significative (p ${fmtP(report.pValue)}), d'intensité ${report.effect?.magnitude ?? "non mesurée"}`
          : `les données ne mettent pas en évidence d'association statistiquement significative (p ${fmtP(report.pValue)})`;
      answer.push({ origin: "règles", text: `${question ? `À la question « ${question} » : ` : ""}concernant la ${itemTitle.charAt(0).toLowerCase()}${itemTitle.slice(1)}, ${verdict}, sur ${report.data.n} observation(s) — ${wording.scope}.` });
    }
  }
  if (warning) answer.unshift({ origin: "règles", text: warning });
  if (![...limits].some((l) => l.includes("cause à effet"))) limits.add("Une association statistique ne démontre pas une relation de cause à effet.");
  limits.add("La significativité statistique ne mesure pas, à elle seule, l'importance pratique d'un résultat.");

  const reliable = relationReports.filter((r) => r.report.reliable);
  const conclusion: Paragraph[] = [
    {
      origin: "règles",
      text: relationReports.length
        ? `${relationReports.length} analyse(s) de relation réalisée(s), dont ${reliable.length} dans des conditions d'application satisfaisantes ; ${reliable.filter((r) => r.report.significant).length} met(tent) en évidence une association significative au seuil α = ${fmt(execution.alpha)}. ${provenance.kind === "real_survey" || provenance.kind === "documentary" ? "Ces résultats décrivent l'échantillon étudié ; leur généralisation suppose un échantillon représentatif" : `Résultats ${wording.adjective}, ${wording.scope}`} ; aucune relation causale ne peut en être déduite.`
        : "Les analyses réalisées sont descriptives : elles présentent les variables mais ne testent aucune relation.",
    },
  ];
  if (relationReports.some((r) => !r.report.reliable)) conclusion.push({ origin: "règles", text: "Au moins un test n'est pas fiable dans ces conditions : avant toute conclusion, augmentez les effectifs ou regroupez les modalités peu représentées (dans le fichier source), puis relancez l'analyse." });
  const notable = (context.consistency ?? []).filter((i) => i.severity !== "low");
  if (notable.length) conclusion.push({ origin: "règles", text: `${notable.length} point(s) de cohérence entre réponses restent à clarifier (voir les limites) ; les réponses n'ont pas été modifiées.` });
  if (warning) conclusion.unshift({ origin: "règles", text: warning });
  const framework = confrontFramework(execution, research, provenance, understanding.variables.map((v) => v.name));
  for (const o of framework.objectives.filter((x) => x.status === "partial" || x.status === "not_addressed")) limits.add(`Objectif ${o.kind} « ${o.text} » : ${o.status === "partial" ? "partiellement couvert" : "non couvert"} par les analyses.${o.missing.length ? ` Aucune analyse ne porte sur ${o.missing.map((m) => `« ${m} »`).join(", ")}.` : ""}`);
  return {
    provenance: { value: provenance, label: PROVENANCE_LABELS[provenance.kind], warning, statement: provenanceStatement(provenance) },
    framework,
    data,
    meaning,
    hypotheses,
    answer,
    limits: [...limits],
    conclusion,
  };
}

/** Analyses réellement réalisées, sous la forme attendue par la confrontation aux objectifs. */
export function executedAnalyses(execution: Execution): CoverageAnalysis[] {
  return execution.items.flatMap((e): CoverageAnalysis[] => {
    if (e.kind === "descriptive") {
      const described = new Set(e.results.filter((r) => r.valid > 0).map((r) => r.column));
      const variables = e.item.variables.filter((v) => described.has(v.column));
      return variables.length ? [{ title: e.item.title, level: "descriptive", variables }] : [];
    }
    if (!e.outcome.ok) return [];
    const r = e.outcome.report;
    const verdict = !r.reliable ? "résultat non concluant (conditions non satisfaites)" : r.significant ? `association significative (p ${fmtP(r.pValue)})` : `pas d'association significative (p ${fmtP(r.pValue)})`;
    return [{ title: e.item.title, level: "relation", variables: e.item.variables, verdict }];
  });
}

/** Pour chaque objectif : quelles analyses réalisées portent réellement sur ses concepts, et avec quel résultat. */
function confrontFramework(execution: Execution, research: ResearchFramework | undefined, provenance: DataProvenance, concepts: string[]): Interpretation["framework"] {
  if (!research) return { problem: null, objectives: [] };
  const objectives = coverObjectives(
    [...(research.generalObjective ? [{ text: research.generalObjective, kind: "général" as const }] : []), ...research.specificObjectives.map((text) => ({ text, kind: "spécifique" as const }))],
    executedAnalyses(execution),
    concepts,
  );
  const tested = execution.items.filter((e) => e.kind === "relation" && e.outcome.ok);
  const problem = research.problem
    ? {
        origin: "règles" as const,
        text: `Problématique de départ : « ${research.problem} ». ${tested.length ? `Les tests de ce rapport apportent des éléments ${evidenceWording(provenance).adjective} sur cette problématique, ${evidenceWording(provenance).scope}, sans établir de causalité.` : "Aucun test de relation n'a été réalisé : les résultats décrivent la situation sans répondre directement à la problématique."}`,
      }
    : null;
  return { problem, objectives };
}
