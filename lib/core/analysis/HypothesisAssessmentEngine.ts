// ============================================================
// ACADIA — MOTEUR DE DÉCISION D'HYPOTHÈSE (Mission 6, incrément 1)
//
// 100 % déterministe, zéro appel OpenAI. Ne recalcule AUCUNE
// statistique — lit uniquement les StatisticalResult déjà produits
// par StatisticalExecutionEngine.ts (Mission 5) et les compare au
// seuil alpha du run pour dériver une décision SUPPORTED /
// NOT_SUPPORTED / PARTIALLY_SUPPORTED / INCONCLUSIVE.
//
// INCONCLUSIVE est toujours la valeur par défaut dès que la preuve
// est insuffisante (hypothèse non reliée à une analyse, analyse non
// exécutée, résultat sans test de signification) — jamais une
// déduction optimiste sans preuve traçable dans `basis`.
// ============================================================

import type { ResearchProject, ResearchHypothesis, ConfidenceLevel } from "@/lib/core/research/ResearchTypes";
import type { AnalysisPlan } from "@/lib/core/analysis/AnalysisPlanTypes";
import type { StatisticalAnalysisRun, StatisticalResult } from "@/lib/core/statistics/StatisticalTypes";
import type { HypothesisAssessment, HypothesisAssessmentDecision } from "./ScientificInterpretationTypes";
import { formatStat } from "./StatisticsMath";

/** p en-dessous de ce seuil s'affiche "< 0,0001" plutôt qu'arrondi à "0,0000" (faux zéro trompeur). */
const P_VALUE_DISPLAY_FLOOR = 0.0001;

function formatPValue(pValue: number): string {
  return pValue < P_VALUE_DISPLAY_FLOOR ? "< 0,0001" : `= ${formatStat(pValue, 4)}`;
}

interface ResultEvaluation {
  resultId: string;
  significant: boolean | null;
  rationale: string[];
}

function extractPValue(result: StatisticalResult): { pValue: number | null; label: string } {
  const bivariate = result.bivariate;
  if (!bivariate) return { pValue: null, label: "" };
  if (bivariate.chiSquare && bivariate.chiSquare.pValue !== null) {
    return { pValue: bivariate.chiSquare.pValue, label: "test du χ²" };
  }
  if (bivariate.pearson && bivariate.pearson.pValue !== null) {
    return { pValue: bivariate.pearson.pValue, label: "corrélation de Pearson" };
  }
  if (bivariate.spearman && bivariate.spearman.pValue !== null) {
    return { pValue: bivariate.spearman.pValue, label: "corrélation de Spearman" };
  }
  return { pValue: null, label: "" };
}

function evaluateResult(result: StatisticalResult, alpha: number): ResultEvaluation {
  if (result.status !== "completed") {
    return {
      resultId: result.id,
      significant: null,
      rationale: [
        `Résultat ${result.status === "skipped" ? "non calculé" : "en échec"}${result.reason ? ` : ${result.reason}` : "."}`,
      ],
    };
  }

  const { pValue, label } = extractPValue(result);
  if (pValue === null) {
    return {
      resultId: result.id,
      significant: null,
      rationale: ["Aucun test de signification disponible pour ce résultat (analyse descriptive seule ou méthode sans p-value)."],
    };
  }

  const significant = pValue < alpha;
  return {
    resultId: result.id,
    significant,
    rationale: [
      `${label} : p ${formatPValue(pValue)} (seuil α = ${formatStat(alpha, 2)}) → ${significant ? "significatif" : "non significatif"} (n = ${result.n}).`,
    ],
  };
}

function deriveConfidence(results: StatisticalResult[]): ConfidenceLevel {
  const warningCount = results.reduce((acc, r) => acc + r.warnings.length, 0);
  const minN = Math.min(...results.map((r) => r.n));
  const assumptionIssue = results.some((r) => r.bivariate?.chiSquare && r.bivariate.chiSquare.assumptionsMet === false);

  if (assumptionIssue || minN < 30 || warningCount > 2) return "low";
  if (minN < 100 || warningCount > 0) return "medium";
  return "high";
}

function inconclusive(hypothesis: ResearchHypothesis, basis: string[], reason: string): HypothesisAssessment {
  return {
    hypothesisId: hypothesis.id,
    statement: hypothesis.statement,
    decision: "INCONCLUSIVE",
    basis,
    confidence: "low",
    rationale: [reason],
    generatedAt: new Date().toISOString(),
  };
}

export function assessHypotheses(
  project: ResearchProject,
  plan: AnalysisPlan,
  run: StatisticalAnalysisRun
): HypothesisAssessment[] {
  return project.hypotheses.map((hypothesis) => {
    const items = plan.items.filter((item) => item.hypothesisId === hypothesis.id);
    if (items.length === 0) {
      return inconclusive(hypothesis, [], "Aucune analyse du plan n'est reliée à cette hypothèse.");
    }

    const results = items
      .map((item) => run.results.find((r) => r.analysisItemId === item.id))
      .filter((r): r is StatisticalResult => Boolean(r));

    if (results.length === 0) {
      return inconclusive(hypothesis, [], "Aucun résultat statistique exécuté pour les analyses reliées à cette hypothèse dans ce run.");
    }

    const evaluations = results.map((r) => evaluateResult(r, run.alpha));
    const usable = evaluations.filter((e) => e.significant !== null);

    if (usable.length === 0) {
      return inconclusive(
        hypothesis,
        results.map((r) => r.id),
        "Les résultats disponibles ne permettent aucun test de signification exploitable."
      );
    }

    const significantCount = usable.filter((e) => e.significant === true).length;
    const nonSignificantCount = usable.filter((e) => e.significant === false).length;

    let decision: HypothesisAssessmentDecision;
    if (significantCount > 0 && nonSignificantCount === 0) decision = "SUPPORTED";
    else if (nonSignificantCount > 0 && significantCount === 0) decision = "NOT_SUPPORTED";
    else decision = "PARTIALLY_SUPPORTED";

    return {
      hypothesisId: hypothesis.id,
      statement: hypothesis.statement,
      decision,
      basis: results.map((r) => r.id),
      confidence: deriveConfidence(results),
      rationale: evaluations.flatMap((e) => e.rationale),
      generatedAt: new Date().toISOString(),
    };
  });
}
