/**
 * Évaluation de chaque hypothèse à partir de TOUS ses croisements VI × VD.
 * Plusieurs tests sur une même hypothèse augmentent le risque d'un résultat « significatif » dû au hasard :
 * les p-values sont ajustées par la méthode de Holm au sein de chaque hypothèse. Une hypothèse n'est jamais
 * déclarée « prouvée » ; une association n'établit pas une causalité.
 */
import { fmt, fmtP, type AnalysisReport } from "@/lib/core/analysis/inferential";

import type { Execution } from "../journey/execute";
import { statementOf, type ResearchChain } from "./chain";

/** Ajustement de Holm (pas-à-pas descendant) : p ajustées, dans l'ordre d'origine. */
export function holmAdjust(p: number[]): number[] {
  const m = p.length;
  const order = p.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const adjusted = new Array<number>(m);
  let running = 0;
  order.forEach(({ value, index }, rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * value));
    adjusted[index] = running;
  });
  return adjusted;
}

export type ChainVerdict = "supported" | "partially_supported" | "not_supported" | "contrary" | "inconclusive" | "not_examined";

export const CHAIN_VERDICT_LABELS: Record<ChainVerdict, string> = {
  supported: "Compatible avec les données (non prouvée)",
  partially_supported: "Partiellement compatible avec les données",
  not_supported: "Non soutenue par ces données (non réfutée)",
  contrary: "Sens observé contraire à l'hypothèse",
  inconclusive: "Non concluante : conditions des tests non réunies",
  not_examined: "Non examinée",
};

export interface CrossingEvidence {
  itemId: string;
  title: string;
  ivUnitId: string;
  dvUnitId: string;
  n: number;
  statistic: string;
  /** p utilisée pour la décision (test, ou test exact de Fisher si le Chi² n'est pas fiable sur un 2 × 2). */
  p: number | null;
  pSource: "test" | "fisher" | null;
  pAdjusted: number | null;
  reliable: boolean;
  significant: boolean;
  effect: string | null;
  magnitude: string | null;
  conditions: "satisfied" | "fisher" | "unreliable";
  report: AnalysisReport | null;
  failure: string | null;
}

export interface HypothesisAssessment {
  rowId: string;
  hypothesisId: string | null;
  label: string;
  verdict: ChainVerdict;
  confidence: "high" | "medium" | "low";
  alpha: number;
  tests: number;
  significant: number;
  /** Seuil de Bonferroni α / m (repère prudent). */
  bonferroni: number | null;
  crossings: CrossingEvidence[];
  /** Ce qui rapproche les données de l'hypothèse, et ce qui les en éloigne (phrases déterministes). */
  supporting: string[];
  opposing: string[];
}

function expectsDirection(text: string): "positive" | "negative" | undefined {
  if (/positiv|augment|plus [eé]lev|sup[eé]rieur|favoris|am[eé]lior|facilit/i.test(text)) return "positive";
  if (/n[eé]gativ|diminu|r[eé]dui|inf[eé]rieur|moins [eé]lev|limit|freine/i.test(text)) return "negative";
  return undefined;
}

function evidenceOf(itemId: string, title: string, ivUnitId: string, dvUnitId: string, report: AnalysisReport | null, failure: string | null): CrossingEvidence {
  if (!report) return { itemId, title, ivUnitId, dvUnitId, n: 0, statistic: "—", p: null, pSource: null, pAdjusted: null, reliable: false, significant: false, effect: null, magnitude: null, conditions: "unreliable", report: null, failure };
  const fisher = report.detail.kind === "chi_square" ? report.detail.result.fisher : undefined;
  const useFisher = !report.reliable && !!fisher;
  return {
    itemId,
    title,
    ivUnitId,
    dvUnitId,
    n: report.data.n,
    statistic: `${report.statistic.name} = ${fmt(report.statistic.value)} (ddl ${report.statistic.df})`,
    p: report.reliable ? report.pValue : useFisher ? fisher!.pValue : null,
    pSource: report.reliable ? "test" : useFisher ? "fisher" : null,
    pAdjusted: null,
    reliable: report.reliable || useFisher,
    significant: false,
    effect: report.effect ? `${report.effect.name} = ${fmt(report.effect.value)}` : null,
    magnitude: report.effect?.magnitude ?? null,
    conditions: report.reliable ? "satisfied" : useFisher ? "fisher" : "unreliable",
    report,
    failure: null,
  };
}

export function assessChain(chain: ResearchChain, execution: Execution): HypothesisAssessment[] {
  const alpha = execution.alpha;
  const assessments: HypothesisAssessment[] = [];
  for (const row of chain.rows) {
    const executed = execution.items.filter((e) => e.kind === "relation" && e.item.chain?.rowId === row.id);
    if (row.descriptive || (!executed.length && !row.hypothesisId)) continue;
    const hypothesis = statementOf(chain, row.hypothesisId);
    const crossings = executed.map((e) => (e.kind === "relation" ? evidenceOf(e.item.id, e.item.title, e.item.chain?.ivUnitId ?? "", e.item.chain?.dvUnitId ?? "", e.outcome.ok ? e.outcome.report : null, e.outcome.ok ? null : e.outcome.reason) : evidenceOf(e.item.id, e.item.title, "", "", null, null)));
    const reliable = crossings.filter((c) => c.reliable && c.p !== null);
    const adjusted = holmAdjust(reliable.map((c) => c.p!));
    reliable.forEach((c, i) => {
      c.pAdjusted = adjusted[i];
      c.significant = adjusted[i] < alpha;
    });
    const significant = reliable.filter((c) => c.significant);
    const expected = hypothesis ? expectsDirection(hypothesis.text) : undefined;
    const contrary = significant.some((c) => c.report && (c.report.detail.kind === "pearson" || c.report.detail.kind === "spearman") && expected && (c.report.effect?.value ?? 0) * (expected === "positive" ? 1 : -1) < 0);
    const verdict: ChainVerdict = !crossings.length ? "not_examined" : !reliable.length ? "inconclusive" : contrary ? "contrary" : significant.length === reliable.length ? "supported" : significant.length ? "partially_supported" : "not_supported";
    const minN = Math.min(...crossings.map((c) => c.n || Infinity));
    const confidence: HypothesisAssessment["confidence"] = !reliable.length || minN < 30 || crossings.some((c) => !c.reliable) || crossings.length > 8 ? "low" : minN >= 100 ? "high" : "medium";
    const describe = (c: CrossingEvidence) =>
      `« ${c.title} » : ${c.statistic}, p ${c.pSource === "fisher" ? "(test exact de Fisher) " : ""}${fmtP(c.p!)}${reliable.length > 1 ? `, p ajustée (Holm) ${fmtP(c.pAdjusted!)}` : ""}${c.effect ? `, ${c.effect} (intensité ${c.magnitude})` : ""}`;
    assessments.push({
      rowId: row.id,
      hypothesisId: row.hypothesisId,
      label: hypothesis ? `Hypothèse ${hypothesis.index + 1}` : `Objectif ${(statementOf(chain, row.objectiveId)?.index ?? 0) + 1}`,
      verdict,
      confidence,
      alpha,
      tests: reliable.length,
      significant: significant.length,
      bonferroni: reliable.length > 1 ? alpha / reliable.length : null,
      crossings,
      supporting: significant.map((c) => `${describe(c)} — association significative.`),
      opposing: [
        ...reliable.filter((c) => !c.significant).map((c) => `${describe(c)} — pas d'association significative.`),
        ...crossings.filter((c) => !c.reliable).map((c) => `« ${c.title} » : ${c.failure ?? "conditions d'application non réunies (effectifs attendus trop faibles) : résultat non concluant."}`),
      ],
    });
  }
  return assessments;
}
