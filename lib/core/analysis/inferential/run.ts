/**
 * Exécution d'une analyse et rédaction du rapport (interprétation DÉTERMINISTE, sans IA).
 * Règles d'interprétation :
 *  - l'hypothèse de recherche n'est jamais déclarée « prouvée » ; on raisonne sur H0 ;
 *  - une p-value n'est pas la probabilité que H0 soit vraie ; la significativité n'est pas l'importance ;
 *  - aucune conclusion causale ; conditions d'application non satisfaites ⇒ résultat signalé non fiable.
 */
import { statisticalTypeLabel } from "@/lib/core/data/preparation";
import type { ImportedDataset, PreparationState, VariableMetadata } from "@/lib/core/data/types";

import { categoriesOf, headerOf, pairObservations, type Encoding, type PairObservations } from "./data";
import { fmt, fmtP, fmtPct, fmtPExact } from "./format";

/** Cellule « p-value » : forme arrondie et valeur exacte (3 chiffres significatifs). */
const pCell = (p: number) => `${fmtP(p).replace("= ", "")} (valeur exacte : ${fmtPExact(p)})`;
const CONTEXT_NOTE = " Ces repères dépendent du domaine et du contexte : ce ne sont pas des seuils universels.";
import { METHOD_LABELS, selectMethods, type MethodId, type MethodSelection } from "./selection";
import {
  chiSquareTest,
  oneWayAnova,
  pearsonCorrelation,
  spearmanCorrelation,
  twoByTwoMeasures,
  welchTTest,
  type AnovaResult,
  type ChiSquareResult,
  type Check,
  type CorrelationResult,
  type WelchResult,
} from "./tests";

export const INFERENTIAL_ENGINE_VERSION = "1.0.0";

export interface AnalysisRequest {
  outcomeColumn: number;
  explanatoryColumn: number;
  method: MethodId;
  alpha: number;
  question: string;
  researchHypothesis?: string;
  /** Réponse de l'utilisateur : chaque observation est une unité distincte, dans un seul groupe. */
  independenceConfirmed: boolean;
  /**
   * Tableau 2 × 2 : catégorie de référence de la variable explicative, issue étudiée de la variable
   * à expliquer et sens de lecture. Sans choix, la 1re modalité (ordre alphabétique) sert de référence
   * et le rapport l'indique explicitement comme choix par défaut.
   */
  categories?: { rowReference: string; outcomeEvent: string; direction: "comparison_vs_reference" | "reference_vs_comparison" };
}

export interface Row {
  label: string;
  value: string;
}

export type AnalysisDetail =
  | {
      kind: "chi_square";
      rowVariable: string;
      colVariable: string;
      rowLabels: string[];
      colLabels: string[];
      result: ChiSquareResult;
      /** Catégories retenues pour un 2 × 2 (choisies par l'utilisateur ou par défaut, signalé). */
      choice?: { rowReference: string; outcomeEvent: string; direction: "comparison_vs_reference" | "reference_vs_comparison"; chosen: boolean };
    }
  | { kind: "welch_t"; measure: string; grouping: string; result: WelchResult }
  | { kind: "anova"; measure: string; grouping: string; result: AnovaResult }
  | { kind: "pearson" | "spearman"; x: string; y: string; result: CorrelationResult; points: Array<{ x: number; y: number }> };

export interface EffectSize {
  name: string;
  value: number;
  magnitude: "négligeable" | "faible" | "moyenne" | "forte";
  explanation: string;
}

export interface AnalysisReport {
  engineVersion: string;
  method: MethodId;
  methodLabel: string;
  question: string;
  researchHypothesis: string | null;
  alpha: number;
  variables: Array<{ role: "outcome" | "explanatory"; header: string; type: string; usedAs: string }>;
  data: {
    rowsTotal: number;
    rowsExcluded: number;
    excludedSourceRows: number[];
    rowsAfterExclusions: number;
    rowsDropped: number;
    n: number;
    usedSourceRows: number[];
    perVariable: Array<{ header: string; missing: number; invalid: number; invalidExamples: string[] }>;
  };
  justification: string;
  hypotheses: { research: string | null; h0: string; h1: string; note: string };
  results: Row[];
  statistic: { name: string; value: number; df: string };
  pValue: number;
  significant: boolean;
  /** Lecture de la p-value au seuil retenu (texte déterministe). */
  pInterpretation: string;
  effect: EffectSize | null;
  detail: AnalysisDetail;
  verification: Row[];
  checks: Check[];
  reliable: boolean;
  limits: string[];
  interpretation: string[];
  conclusion: string;
  multipleTesting: string | null;
}

export type AnalysisOutcome = { ok: true; report: AnalysisReport } | { ok: false; reason: string; selection?: MethodSelection };

const ENCODING_LABELS: Record<Encoding, string> = { number: "valeurs numériques", category: "modalités (groupes)", rank: "rangs" };

function magnitude(value: number, thresholds: [number, number, number]): EffectSize["magnitude"] {
  const v = Math.abs(value);
  if (v < thresholds[0]) return "négligeable";
  if (v < thresholds[1]) return "faible";
  if (v < thresholds[2]) return "moyenne";
  return "forte";
}

const CAUSALITY = "Un résultat statistique d'association ou de différence ne démontre pas une relation de cause à effet : d'autres facteurs non pris en compte peuvent expliquer ce qui est observé.";

export function runAnalysis(dataset: ImportedDataset, preparation: PreparationState, variables: VariableMetadata[], request: AnalysisRequest): AnalysisOutcome {
  const outcome = variables.find((v) => v.column === request.outcomeColumn);
  const explanatory = variables.find((v) => v.column === request.explanatoryColumn);
  if (!outcome || !explanatory) return { ok: false, reason: "Variable introuvable dans les données importées." };
  if (!(request.alpha > 0 && request.alpha < 0.5)) return { ok: false, reason: "Le seuil de signification doit être compris entre 0 et 0,5." };
  const selection = selectMethods(dataset, preparation, outcome, explanatory);
  if (selection.refused) return { ok: false, reason: selection.refused, selection };
  const option = selection.options.find((o) => o.method === request.method);
  if (!option) {
    return {
      ok: false,
      reason: `${METHOD_LABELS[request.method]} n'est pas adapté à ces variables (« ${headerOf(outcome)} » : ${statisticalTypeLabel(outcome.effectiveType)} ; « ${headerOf(explanatory)} » : ${statisticalTypeLabel(explanatory.effectiveType)}). Méthode(s) compatible(s) : ${selection.options.map((o) => METHOD_LABELS[o.method]).join(", ")}.`,
      selection,
    };
  }
  if (selection.needsIndependence && request.method !== "pearson" && request.method !== "spearman" && !request.independenceConfirmed) {
    return { ok: false, reason: "Confirmez d'abord que chaque ligne correspond à une unité différente (personne, entreprise…) et qu'aucune n'apparaît dans plusieurs groupes : ce test suppose des observations indépendantes, pas des mesures répétées.", selection };
  }

  const pair = pairObservations(dataset, preparation, { variable: outcome, encoding: option.encodings.outcome }, { variable: explanatory, encoding: option.encodings.explanatory });
  if (pair.n === 0) return { ok: false, reason: "Aucune observation complète : chaque ligne a une valeur manquante ou invalide pour au moins une des deux variables.", selection };
  const ctx = { request, outcome, explanatory, pair, alpha: request.alpha, justification: option.why + (option.difference ? ` ${option.difference}` : "") };
  switch (request.method) {
    case "chi_square":
      return chiSquareReport(ctx);
    case "welch_t":
    case "anova":
      return groupReport(ctx);
    default:
      return correlationReport(ctx);
  }
}

interface Ctx {
  request: AnalysisRequest;
  outcome: VariableMetadata;
  explanatory: VariableMetadata;
  pair: PairObservations;
  alpha: number;
  justification: string;
}

function baseReport(ctx: Ctx) {
  const { pair, request, outcome, explanatory } = ctx;
  return {
    engineVersion: INFERENTIAL_ENGINE_VERSION,
    method: request.method,
    methodLabel: METHOD_LABELS[request.method],
    question: request.question.trim() || `Existe-t-il une association entre « ${headerOf(explanatory)} » et « ${headerOf(outcome)} » ?`,
    researchHypothesis: request.researchHypothesis?.trim() || null,
    alpha: ctx.alpha,
    variables: [
      { role: "outcome" as const, header: headerOf(outcome), type: statisticalTypeLabel(outcome.effectiveType), usedAs: ENCODING_LABELS[pair.a.encoding] },
      { role: "explanatory" as const, header: headerOf(explanatory), type: statisticalTypeLabel(explanatory.effectiveType), usedAs: ENCODING_LABELS[pair.b.encoding] },
    ],
    data: {
      rowsTotal: pair.rowsTotal,
      rowsExcluded: pair.rowsExcluded,
      excludedSourceRows: pair.excludedSourceRows,
      rowsAfterExclusions: pair.rowsAfterExclusions,
      rowsDropped: pair.rowsDropped,
      n: pair.n,
      usedSourceRows: pair.usedSourceRows,
      perVariable: [pair.a, pair.b].map((v) => ({ header: v.header, missing: v.missing, invalid: v.invalid, invalidExamples: v.invalidExamples })),
    },
    justification: ctx.justification,
    multipleTesting: null,
  };
}

function dataSentence(ctx: Ctx): string {
  const { pair } = ctx;
  const parts = [`L'analyse porte sur ${pair.n} observation(s) complète(s)`];
  if (pair.rowsExcluded) parts.push(`${pair.rowsExcluded} ligne(s) exclue(s) par vous`);
  if (pair.rowsDropped) parts.push(`${pair.rowsDropped} ligne(s) écartée(s) car incomplète(s) ou invalide(s) pour l'une des deux variables (aucune valeur n'a été remplacée)`);
  return `${parts.join(" ; ")}.`;
}

function pSentence(p: number, alpha: number, h0: string): { text: string; significant: boolean } {
  const significant = p < alpha;
  const a = fmt(alpha, 3);
  return {
    significant,
    text: significant
      ? `p ${fmtP(p)} est inférieure au seuil α = ${a} : si H0 (« ${h0} ») était vraie, un écart au moins aussi marqué que celui observé serait peu probable. Les données conduisent donc à rejeter H0 à ce seuil. Cela ne prouve pas l'hypothèse de recherche et ne dit rien, à lui seul, de l'importance pratique du résultat.`
      : `p ${fmtP(p)} n'est pas inférieure au seuil α = ${a} : les données ne permettent pas de rejeter H0 (« ${h0} »). Cela ne démontre pas l'absence d'effet : l'effet peut être faible ou l'échantillon insuffisant pour le détecter.`,
  };
}

function limits(ctx: Ctx, extra: string[] = []): string[] {
  const list = [...extra];
  if (ctx.pair.rowsDropped > 0) {
    const share = ctx.pair.rowsDropped / Math.max(1, ctx.pair.rowsAfterExclusions);
    list.push(`${ctx.pair.rowsDropped} ligne(s) (${fmtPct(share)}) ont été écartées faute de valeur valide : si ces absences ne sont pas dues au hasard, le résultat peut être biaisé.`);
  }
  list.push("Test bilatéral : il examine une association ou une différence dans les deux sens.");
  list.push("La généralisation à une population suppose un échantillon représentatif de cette population.");
  list.push(CAUSALITY);
  return list;
}

function conclusionText(ctx: Ctx, significant: boolean, reliable: boolean, what: string, numbers: string, direction?: "positive" | "negative"): string {
  const question = ctx.request.question.trim();
  const hypothesis = ctx.request.researchHypothesis?.trim();
  let text = question ? `Question examinée : « ${question} ». ` : "";
  if (!reliable) text += "Les conditions d'application du test ne sont pas réunies : le résultat ci-dessous est indicatif et ne doit pas être présenté comme fiable. ";
  text += significant
    ? `Au seuil retenu, les données fournissent un élément statistique en faveur d'${what} (${numbers}).`
    : `Au seuil retenu, les données ne fournissent pas d'élément statistique suffisant en faveur d'${what} (${numbers}).`;
  if (hypothesis) {
    const expects = /positiv|augment|plus [eé]lev|sup[eé]rieur|favoris|am[eé]lior/i.test(hypothesis) ? "positive" : /n[eé]gativ|diminu|r[eé]dui|inf[eé]rieur|moins [eé]lev/i.test(hypothesis) ? "negative" : undefined;
    if (!significant) text += ` Ces données n'apportent donc pas de soutien statistique à l'hypothèse de recherche « ${hypothesis} », sans pour autant la réfuter.`;
    else if (expects && direction && expects !== direction) text += ` Attention : le sens observé (${direction === "positive" ? "positif" : "négatif"}) est contraire à celui attendu par l'hypothèse « ${hypothesis} » ; les données ne la soutiennent pas.`;
    else text += ` Ce résultat est compatible avec l'hypothèse de recherche « ${hypothesis} » mais ne la prouve pas : il ne porte que sur l'hypothèse nulle statistique, dans cet échantillon.`;
  }
  return text;
}

/* ---------------------------------------------------------------- */

function chiSquareReport(ctx: Ctx): AnalysisOutcome {
  const { pair, outcome, explanatory } = ctx;
  let rowLabels = categoriesOf(pair.valuesB, pair.b.order);
  let colLabels = categoriesOf(pair.valuesA, pair.a.order);
  // 2 × 2 : référence en 1re ligne, issue étudiée en 1re colonne (l'ordre ne change pas le Chi²).
  let choice: { rowReference: string; outcomeEvent: string; direction: "comparison_vs_reference" | "reference_vs_comparison"; chosen: boolean } | undefined;
  if (rowLabels.length === 2 && colLabels.length === 2) {
    const wanted = ctx.request.categories;
    if (wanted && (!rowLabels.includes(wanted.rowReference) || !colLabels.includes(wanted.outcomeEvent))) {
      return { ok: false, reason: `Catégories choisies introuvables dans les données (référence « ${wanted.rowReference} », issue « ${wanted.outcomeEvent} ») : revoyez le choix des catégories.` };
    }
    choice = wanted ? { ...wanted, chosen: true } : { rowReference: rowLabels[0], outcomeEvent: colLabels[0], direction: "comparison_vs_reference", chosen: false };
    rowLabels = [choice.rowReference, ...rowLabels.filter((l) => l !== choice!.rowReference)];
    colLabels = [choice.outcomeEvent, ...colLabels.filter((l) => l !== choice!.outcomeEvent)];
  }
  const observed = rowLabels.map(() => colLabels.map(() => 0));
  pair.valuesA.forEach((a, i) => {
    observed[rowLabels.indexOf(String(pair.valuesB[i]))][colLabels.indexOf(String(a))] += 1;
  });
  const test = chiSquareTest(observed);
  if (!test.ok) return { ok: false, reason: test.reason };
  const r = test.value;
  const x = headerOf(explanatory);
  const y = headerOf(outcome);
  const h0 = `« ${x} » et « ${y} » sont indépendantes`;
  const kStar = Math.min(rowLabels.length, colLabels.length) - 1;
  const thresholds: [number, number, number] = kStar === 1 ? [0.1, 0.3, 0.5] : kStar === 2 ? [0.07, 0.21, 0.35] : [0.06, 0.17, 0.29];
  const effect: EffectSize = {
    name: "V de Cramér",
    value: r.cramersV,
    magnitude: magnitude(r.cramersV, thresholds),
    explanation: `V varie de 0 (aucune association) à 1 (association parfaite). Repères indicatifs de Cohen (1988) pour ${kStar} degré(s) de liberté minimal(aux) : ${thresholds.map((t) => fmt(t, 2)).join(" / ")} pour faible / moyenne / forte.${CONTEXT_NOTE}`,
  };
  let top = { i: 0, j: 0, c: -1 };
  r.contributions.forEach((row, i) => row.forEach((c, j) => c > top.c && (top = { i, j, c })));
  const { text, significant } = pSentence(r.pValue, ctx.alpha, h0);
  const checks = [...r.checks];
  const interpretation = [
    dataSentence(ctx),
    `Tableau croisé de ${rowLabels.length} × ${colLabels.length} modalités. Le plus grand écart à l'indépendance concerne « ${x} » = ${rowLabels[top.i]} et « ${y} » = ${colLabels[top.j]} : ${r.observed[top.i][top.j]} observation(s) pour ${fmt(r.expected[top.i][top.j], 2)} attendue(s) si les variables étaient indépendantes.`,
    `χ² = ${fmt(r.statistic)} avec ${r.df} degré(s) de liberté. ${text}`,
    `${effect.name} = ${fmt(r.cramersV)} : association d'intensité ${effect.magnitude} selon les repères indicatifs ; l'importance pratique dépend de votre domaine.`,
  ];
  const reversed = choice?.direction === "reference_vs_comparison";
  // Sens de lecture inversé : le groupe de référence devient le groupe lu, comparé à l'autre.
  const t = r.twoByTwo && reversed ? twoByTwoMeasures([r.observed[1], r.observed[0]], ctx.alpha) : r.twoByTwo;
  const baseRow = reversed ? 1 : 0;
  const focusRow = reversed ? 0 : 1;
  const twoByTwoRows: Row[] = [];
  if (t && choice) {
    const event = colLabels[0];
    const ref = rowLabels[baseRow];
    const cmp = rowLabels[focusRow];
    const conf = `${fmt(t.confidence * 100, 0)} %`;
    const ci = (v: [number, number] | null, d = 3) => (v ? ` [IC ${conf} : ${fmt(v[0], d)} ; ${fmt(v[1], d)}]` : "");
    twoByTwoRows.push(
      {
        label: "Catégories de référence",
        value: `Issue étudiée : « ${y} » = ${event} ; groupe de référence : « ${x} » = ${choice.rowReference} ; lecture : ${cmp} comparé à ${ref} (${choice.chosen ? "choix de l'utilisateur" : "choix par défaut (ordre alphabétique), modifiable dans le plan"})`,
      },
      { label: `Proportion de « ${event} »`, value: `${cmp} : ${fmtPct(t.pComparison)} (${r.observed[focusRow][0]}/${r.rowTotals[focusRow]}) ; ${ref} : ${fmtPct(t.pReference)} (${r.observed[baseRow][0]}/${r.rowTotals[baseRow]})` },
      { label: "Différence de proportions", value: `${t.difference >= 0 ? "+" : ""}${fmt(t.difference * 100, 1)} points de pourcentage [IC ${conf} : ${fmt(t.differenceCi[0] * 100, 1)} ; ${fmt(t.differenceCi[1] * 100, 1)}]` },
      { label: "Rapport de proportions (risque relatif)", value: t.riskRatio === null ? "non calculable" : `${fmt(t.riskRatio, 3)}${ci(t.riskRatioCi)}` },
      { label: "Odds ratio", value: t.oddsRatio === null ? "non calculable" : `${fmt(t.oddsRatio, 3)}${ci(t.oddsRatioCi)}` },
    );
    interpretation.push(
      `En comparant « ${cmp} » à « ${ref} », la proportion de « ${event} » est de ${fmtPct(t.pComparison)} pour « ${cmp} » contre ${fmtPct(t.pReference)} pour « ${ref} », soit une différence de ${t.difference >= 0 ? "+" : ""}${fmt(t.difference * 100, 1)} points (IC ${conf} : ${fmt(t.differenceCi[0] * 100, 1)} à ${fmt(t.differenceCi[1] * 100, 1)} points)${t.riskRatio !== null ? `, un rapport de proportions de ${fmt(t.riskRatio, 2)}${ci(t.riskRatioCi, 2)}` : ""}${t.oddsRatio !== null ? ` et un odds ratio de ${fmt(t.oddsRatio, 2)}${ci(t.oddsRatioCi, 2)}` : ""}. Les intervalles de confiance larges traduisent l'imprécision liée à la taille de l'échantillon.${t.continuityCorrection ? " Une case vaut 0 : 0,5 a été ajouté à chaque case pour le risque relatif et l'odds ratio (correction de Haldane-Anscombe)." : ""}`,
    );
  }
  if (!r.conditionsMet) {
    interpretation.unshift(`Attention : les effectifs attendus sont trop faibles (${r.cellsBelow5} case(s) sous 5, ${r.cellsBelow1} sous 1). L'approximation du Chi² n'est pas fiable dans ces conditions : ne présentez pas cette p-value comme un résultat établi.`);
    if (r.fisher) interpretation.push(`Le test exact de Fisher, qui ne dépend pas de cette approximation, donne p ${fmtP(r.fisher.pValue)} pour ce tableau 2 × 2.`);
    else interpretation.push("Regrouper des modalités peu représentées permettrait d'augmenter les effectifs attendus.");
  }
  interpretation.push(CAUSALITY);
  const reliable = r.conditionsMet;
  return {
    ok: true,
    report: {
      ...baseReport(ctx),
      hypotheses: { research: ctx.request.researchHypothesis?.trim() || null, h0: `H0 : ${h0} (la répartition de « ${y} » est la même quelle que soit la modalité de « ${x} »).`, h1: `H1 : les deux variables sont associées.`, note: "Le test porte sur H0, l'hypothèse nulle statistique — pas directement sur votre hypothèse de recherche." },
      results: [
        { label: "Observations utilisées", value: String(r.n) },
        { label: "χ² (Pearson, sans correction de continuité)", value: fmt(r.statistic) },
        { label: "Degrés de liberté", value: String(r.df) },
        { label: "p-value", value: pCell(r.pValue) },
        { label: "V de Cramér", value: fmt(r.cramersV) },
        ...(r.fisher ? [{ label: "Test exact de Fisher (2 × 2), p-value bilatérale", value: pCell(r.fisher.pValue) }] : []),
        ...twoByTwoRows,
      ],
      statistic: { name: "χ²", value: r.statistic, df: String(r.df) },
      pValue: r.pValue,
      significant,
      pInterpretation: text,
      effect,
      detail: { kind: "chi_square", rowVariable: x, colVariable: y, rowLabels, colLabels, result: r, choice },
      verification: [
        { label: "Formule", value: "χ² = Σ (O − E)² / E, avec E = (total ligne × total colonne) / n" },
        { label: "Degrés de liberté", value: `(lignes − 1) × (colonnes − 1) = (${rowLabels.length} − 1) × (${colLabels.length} − 1) = ${r.df}` },
        { label: "V de Cramér", value: `√(χ² / (n × (min(lignes, colonnes) − 1))) = √(${fmt(r.statistic)} / (${r.n} × ${kStar})) = ${fmt(r.cramersV)}` },
        { label: "Plus petit effectif attendu", value: fmt(r.minExpected, 2) },
        { label: "Plus forte contribution au χ²", value: `${fmt(top.c)} (case ${rowLabels[top.i]} × ${colLabels[top.j]})` },
        ...(t
          ? [
              { label: "Intervalle de la différence", value: t.differenceCiMethod },
              { label: "Intervalles du risque relatif et de l'odds ratio", value: "méthode logarithmique (Katz pour le risque relatif, Woolf pour l'odds ratio)" },
            ]
          : []),
      ],
      checks,
      reliable,
      limits: limits(ctx, reliable ? [] : ["Conditions de Cochran non satisfaites : p-value du Chi² non fiable."]),
      interpretation,
      conclusion: conclusionText(ctx, significant, reliable, `une association entre « ${x} » et « ${y} »`, `χ²(${r.df}) = ${fmt(r.statistic)}, p ${fmtP(r.pValue)}, V = ${fmt(r.cramersV)}`),
    },
  };
}

function groupReport(ctx: Ctx): AnalysisOutcome {
  const { pair, outcome, explanatory, request } = ctx;
  // La variable quantitative peut être côté « à expliquer » ou côté « explicative ».
  const measureIsA = pair.a.encoding === "number";
  const measureValues = (measureIsA ? pair.valuesA : pair.valuesB) as number[];
  const groupValues = measureIsA ? pair.valuesB : pair.valuesA;
  const groupUse = measureIsA ? pair.b : pair.a;
  const measure = headerOf(measureIsA ? outcome : explanatory);
  const grouping = headerOf(measureIsA ? explanatory : outcome);
  const labels = categoriesOf(groupValues, groupUse.order);
  const groups = labels.map((label) => ({ label, values: measureValues.filter((_, i) => String(groupValues[i]) === label) }));
  const independence: Check = { id: "independence", label: "Groupes indépendants", status: "ok", detail: "Vous avez confirmé que chaque observation est une unité distincte appartenant à un seul groupe (pas de mesures appariées)." };

  if (request.method === "welch_t") {
    if (groups.length !== 2) return { ok: false, reason: `Le test t compare exactement deux groupes ; « ${grouping} » en compte ${groups.length}. Utilisez l'ANOVA.` };
    const test = welchTTest(groups[0], groups[1], ctx.alpha);
    if (!test.ok) return { ok: false, reason: test.reason };
    const r = test.value;
    const [g1, g2] = r.groups;
    const h0 = `les moyennes de « ${measure} » sont égales dans les groupes « ${g1.label} » et « ${g2.label} »`;
    const effect: EffectSize = {
      name: "g de Hedges",
      value: r.hedgesG,
      magnitude: magnitude(r.hedgesG, [0.2, 0.5, 0.8]),
      explanation: "Différence des moyennes exprimée en écarts-types (écart-type combiné), corrigée du biais des petits échantillons. Repères indicatifs de Cohen : 0,2 / 0,5 / 0,8 pour faible / moyenne / forte." + CONTEXT_NOTE,
    };
    const { text, significant } = pSentence(r.pValue, ctx.alpha, h0);
    const conf = `${fmt(r.confidence * 100, 0)} %`;
    const interpretation = [
      dataSentence(ctx),
      `Moyenne de « ${measure} » : ${fmt(g1.mean)} (écart-type ${fmt(g1.sd)}, n = ${g1.n}) pour « ${g1.label} » et ${fmt(g2.mean)} (écart-type ${fmt(g2.sd)}, n = ${g2.n}) pour « ${g2.label} », soit une différence de ${fmt(r.difference)} (intervalle de confiance à ${conf} : ${fmt(r.ci[0])} à ${fmt(r.ci[1])}).`,
      `t = ${fmt(r.statistic)} avec ${fmt(r.df, 2)} degrés de liberté (Welch). ${text}`,
      `${r.ci[0] <= 0 && r.ci[1] >= 0 ? "L'intervalle de confiance contient 0 : une différence nulle reste compatible avec les données." : "L'intervalle de confiance ne contient pas 0."} Il indique l'ordre de grandeur plausible de la différence.`,
      `${effect.name} = ${fmt(r.hedgesG)} : effet d'ampleur ${effect.magnitude} selon les repères indicatifs.`,
      CAUSALITY,
    ];
    return {
      ok: true,
      report: {
        ...baseReport(ctx),
        hypotheses: { research: request.researchHypothesis?.trim() || null, h0: `H0 : ${h0}.`, h1: "H1 : les deux moyennes diffèrent (test bilatéral).", note: "Le test porte sur H0, l'hypothèse nulle statistique — pas directement sur votre hypothèse de recherche." },
        results: [
          { label: `« ${g1.label} » : n / moyenne / écart-type`, value: `${g1.n} / ${fmt(g1.mean)} / ${fmt(g1.sd)}` },
          { label: `« ${g2.label} » : n / moyenne / écart-type`, value: `${g2.n} / ${fmt(g2.mean)} / ${fmt(g2.sd)}` },
          { label: "Différence des moyennes", value: fmt(r.difference) },
          { label: "t (Welch)", value: fmt(r.statistic) },
          { label: "Degrés de liberté (Welch-Satterthwaite)", value: fmt(r.df, 2) },
          { label: "p-value (bilatérale)", value: pCell(r.pValue) },
          { label: `IC à ${conf} de la différence`, value: `[${fmt(r.ci[0])} ; ${fmt(r.ci[1])}]` },
          { label: "g de Hedges", value: fmt(r.hedgesG) },
        ],
        statistic: { name: "t", value: r.statistic, df: fmt(r.df, 2) },
        pValue: r.pValue,
        significant,
        pInterpretation: text,
        effect,
        detail: { kind: "welch_t", measure, grouping, result: r },
        verification: [
          { label: "Erreur type", value: `√(s₁²/n₁ + s₂²/n₂) = √(${fmt(g1.variance)}/${g1.n} + ${fmt(g2.variance)}/${g2.n}) = ${fmt(r.standardError)}` },
          { label: "Statistique", value: `t = (m₁ − m₂) / erreur type = ${fmt(r.difference)} / ${fmt(r.standardError)} = ${fmt(r.statistic)}` },
          { label: "Degrés de liberté", value: "(s₁²/n₁ + s₂²/n₂)² / [(s₁²/n₁)²/(n₁ − 1) + (s₂²/n₂)²/(n₂ − 1)]" },
          { label: "Valeur critique", value: `t(${fmt(1 - ctx.alpha / 2, 3)} ; ${fmt(r.df, 2)}) = ${fmt(r.tCritical)}` },
          { label: "Écart-type combiné (taille d'effet)", value: fmt(r.pooledSd) },
          { label: "d de Cohen (avant correction)", value: fmt(r.cohensD) },
        ],
        checks: [independence, ...r.checks],
        reliable: true,
        limits: limits(ctx, ["Le test compare des moyennes : avec des distributions très asymétriques ou des valeurs extrêmes, la moyenne peut mal résumer chaque groupe."]),
        interpretation,
        conclusion: conclusionText(ctx, significant, true, `une différence de moyenne de « ${measure} » entre « ${g1.label} » et « ${g2.label} »`, `t(${fmt(r.df, 2)}) = ${fmt(r.statistic)}, p ${fmtP(r.pValue)}, g = ${fmt(r.hedgesG)}`),
      },
    };
  }

  if (groups.length < 3) return { ok: false, reason: `L'ANOVA est proposée pour trois groupes ou plus ; « ${grouping} » en compte ${groups.length}. Utilisez le test t de Welch.` };
  const test = oneWayAnova(groups);
  if (!test.ok) return { ok: false, reason: test.reason };
  const r = test.value;
  const h0 = `les moyennes de « ${measure} » sont égales dans les ${groups.length} groupes de « ${grouping} »`;
  const effect: EffectSize = {
    name: "η² (eta carré)",
    value: r.etaSquared,
    magnitude: magnitude(r.etaSquared, [0.01, 0.06, 0.14]),
    explanation: `Part de la variance totale de « ${measure} » associée aux groupes. Repères indicatifs de Cohen : 0,01 / 0,06 / 0,14. L'oméga carré (ω² = ${fmt(r.omegaSquared)}), moins biaisé, est aussi indiqué.${CONTEXT_NOTE}`,
  };
  const { text, significant } = pSentence(r.pValue, ctx.alpha, h0);
  const variances = r.checks.find((c) => c.id === "variances");
  const reliable = variances?.status !== "failed";
  const interpretation = [
    dataSentence(ctx),
    `Moyennes de « ${measure} » : ${r.groups.map((g) => `${g.label} = ${fmt(g.mean)} (n = ${g.n})`).join(" ; ")}.`,
    `F(${r.dfBetween}, ${r.dfWithin}) = ${fmt(r.statistic)}. ${text}`,
    `${significant ? "Un résultat global significatif indique qu'au moins une moyenne diffère, sans dire lesquelles : des comparaisons post-hoc (non encore disponibles) seraient nécessaires." : "Aucune différence globale n'est mise en évidence entre les moyennes."}`,
    `${effect.name} = ${fmt(r.etaSquared)} : ${fmt(r.etaSquared * 100, 1)} % de la variance de « ${measure} » est associée aux groupes (ampleur ${effect.magnitude} selon les repères indicatifs).`,
    CAUSALITY,
  ];
  if (!reliable) interpretation.unshift("Attention : variances hétérogènes et groupes déséquilibrés. Dans ce cas, la p-value de l'ANOVA classique peut être nettement faussée : ne la présentez pas comme fiable.");
  return {
    ok: true,
    report: {
      ...baseReport(ctx),
      hypotheses: { research: request.researchHypothesis?.trim() || null, h0: `H0 : ${h0}.`, h1: "H1 : au moins une moyenne diffère des autres.", note: "Le test porte sur H0, l'hypothèse nulle statistique — pas directement sur votre hypothèse de recherche." },
      results: [
        ...r.groups.map((g) => ({ label: `« ${g.label} » : n / moyenne / écart-type`, value: `${g.n} / ${fmt(g.mean)} / ${fmt(g.sd)}` })),
        { label: "F", value: fmt(r.statistic) },
        { label: "Degrés de liberté (inter ; intra)", value: `${r.dfBetween} ; ${r.dfWithin}` },
        { label: "p-value", value: pCell(r.pValue) },
        { label: "η² (eta carré)", value: fmt(r.etaSquared) },
        { label: "ω² (oméga carré)", value: fmt(r.omegaSquared) },
      ],
      statistic: { name: "F", value: r.statistic, df: `${r.dfBetween} ; ${r.dfWithin}` },
      pValue: r.pValue,
      significant,
      pInterpretation: text,
      effect,
      detail: { kind: "anova", measure, grouping, result: r },
      verification: [
        { label: "Moyenne générale", value: fmt(r.grandMean) },
        { label: "SC inter-groupes", value: `Σ nᵢ (mᵢ − m)² = ${fmt(r.ssBetween)}` },
        { label: "SC intra-groupes", value: `Σ Σ (x − mᵢ)² = ${fmt(r.ssWithin)}` },
        { label: "SC totale", value: fmt(r.ssTotal) },
        { label: "Carrés moyens", value: `CM inter = ${fmt(r.ssBetween)} / ${r.dfBetween} = ${fmt(r.msBetween)} ; CM intra = ${fmt(r.ssWithin)} / ${r.dfWithin} = ${fmt(r.msWithin)}` },
        { label: "F", value: `CM inter / CM intra = ${fmt(r.statistic)}` },
        { label: "η²", value: `SC inter / SC totale = ${fmt(r.etaSquared)}` },
      ],
      checks: [independence, ...r.checks],
      reliable,
      limits: limits(ctx, ["Résultat global : il n'identifie pas quels groupes diffèrent (post-hoc non encore disponible).", ...(reliable ? [] : ["Variances hétérogènes avec groupes déséquilibrés : une ANOVA de Welch serait préférable (non encore disponible)."])]),
      interpretation,
      conclusion: conclusionText(ctx, significant, reliable, `une différence de moyenne de « ${measure} » entre les groupes de « ${grouping} »`, `F(${r.dfBetween}, ${r.dfWithin}) = ${fmt(r.statistic)}, p ${fmtP(r.pValue)}, η² = ${fmt(r.etaSquared)}`),
    },
  };
}

function correlationReport(ctx: Ctx): AnalysisOutcome {
  const { pair, outcome, explanatory, request } = ctx;
  const y = (pair.valuesA as number[]).map(Number);
  const x = (pair.valuesB as number[]).map(Number);
  const spearman = request.method === "spearman";
  const test = spearman ? spearmanCorrelation(x, y, ctx.alpha) : pearsonCorrelation(x, y, ctx.alpha);
  if (!test.ok) return { ok: false, reason: test.reason };
  const r = test.value;
  const name = spearman ? "ρ de Spearman" : "r de Pearson";
  const xs = headerOf(explanatory);
  const ys = headerOf(outcome);
  const h0 = spearman ? `il n'existe pas d'association monotone entre « ${xs} » et « ${ys} » (ρ = 0)` : `il n'existe pas d'association linéaire entre « ${xs} » et « ${ys} » (ρ = 0)`;
  const mag = magnitude(r.coefficient, [0.1, 0.3, 0.5]);
  const direction = r.coefficient > 0 ? "positive" : r.coefficient < 0 ? "negative" : undefined;
  const effect: EffectSize = { name, value: r.coefficient, magnitude: mag, explanation: "Le coefficient varie de −1 à 1 ; son signe donne le sens, sa valeur absolue l'intensité. Repères indicatifs de Cohen : 0,1 / 0,3 / 0,5." + CONTEXT_NOTE };
  const { text, significant } = pSentence(r.pValue, ctx.alpha, h0);
  const conf = `${fmt(r.confidence * 100, 0)} %`;
  const interpretation = [
    dataSentence(ctx),
    `${name} = ${fmt(r.coefficient)} : association ${direction === "positive" ? "positive (les deux variables tendent à varier dans le même sens)" : direction === "negative" ? "négative (quand l'une augmente, l'autre tend à diminuer)" : "nulle"}, d'intensité ${mag} selon les repères indicatifs.${r.ci ? ` Intervalle de confiance à ${conf} : ${fmt(r.ci[0])} à ${fmt(r.ci[1])}.` : ""}`,
    Math.abs(r.coefficient) === 1 ? "Corrélation parfaite : toutes les observations sont exactement alignées (ou ordonnées de façon identique). Vérifiez qu'il ne s'agit pas de deux mesures d'une même chose ou d'une variable calculée à partir de l'autre." : `t = ${fmt(r.statistic)} avec ${r.df} degrés de liberté. ${text}`,
    ...(Math.abs(r.coefficient) === 1 ? [text] : []),
    spearman ? "Spearman mesure une tendance monotone sur les rangs ; il ne dit pas si la relation est linéaire." : "Pearson ne mesure que la composante linéaire de la relation.",
    "Une corrélation ne prouve pas une causalité, ni le sens d'une éventuelle influence.",
  ];
  return {
    ok: true,
    report: {
      ...baseReport(ctx),
      hypotheses: { research: request.researchHypothesis?.trim() || null, h0: `H0 : ${h0}.`, h1: "H1 : le coefficient de la population est différent de 0 (test bilatéral).", note: "Le test porte sur H0, l'hypothèse nulle statistique — pas directement sur votre hypothèse de recherche." },
      results: [
        { label: "Observations (paires complètes)", value: String(r.n) },
        { label: name, value: fmt(r.coefficient) },
        { label: "t", value: Number.isFinite(r.statistic) ? fmt(r.statistic) : "non défini (corrélation parfaite)" },
        { label: "Degrés de liberté", value: String(r.df) },
        { label: "p-value (bilatérale)", value: pCell(r.pValue) },
        { label: `IC à ${conf}`, value: r.ci ? `[${fmt(r.ci[0])} ; ${fmt(r.ci[1])}]` : r.ciMethod },
      ],
      statistic: { name: "t", value: r.statistic, df: String(r.df) },
      pValue: r.pValue,
      significant,
      pInterpretation: text,
      effect,
      detail: { kind: request.method as "pearson" | "spearman", x: xs, y: ys, result: r, points: x.slice(0, 5000).map((v, i) => ({ x: v, y: y[i] })) },
      verification: [
        { label: "Formule", value: spearman ? "ρ = corrélation de Pearson calculée sur les rangs (rangs moyens pour les ex æquo)" : "r = Σ(x − x̄)(y − ȳ) / √(Σ(x − x̄)² Σ(y − ȳ)²)" },
        { label: "Statistique", value: `t = r √((n − 2) / (1 − r²)), ${r.df} degrés de liberté${spearman ? " (approximation usuelle pour Spearman)" : ""}` },
        { label: "Intervalle de confiance", value: r.ciMethod },
        { label: `Moyenne / écart-type de « ${xs} »`, value: `${fmt(r.meanX)} / ${fmt(r.sdX)}` },
        { label: `Moyenne / écart-type de « ${ys} »`, value: `${fmt(r.meanY)} / ${fmt(r.sdY)}` },
        ...(r.ties ? [{ label: "Valeurs ex æquo", value: `${r.ties.x} pour « ${xs} », ${r.ties.y} pour « ${ys} »` }] : []),
      ],
      checks: r.checks,
      reliable: true,
      limits: limits(ctx, []),
      interpretation,
      conclusion: conclusionText(ctx, significant, true, `une association ${spearman ? "monotone" : "linéaire"} entre « ${xs} » et « ${ys} »`, `${spearman ? "ρ" : "r"} = ${fmt(r.coefficient)}, n = ${r.n}, p ${fmtP(r.pValue)}`, direction),
    },
  };
}

/** Plusieurs tests sur la même variable à expliquer : avertissement sur les comparaisons multiples. */
export function multipleTestingNote(count: number, alpha: number): string | null {
  if (count < 2) return null;
  const familywise = 1 - (1 - alpha) ** count;
  return `${count} tests ont été effectués : même sans aucun effet réel, la probabilité d'obtenir au moins un résultat « significatif » par hasard atteint environ ${fmtPct(familywise)} (au lieu de ${fmtPct(alpha, 0)}). Une correction de Bonferroni utiliserait le seuil α / ${count} = ${fmt(alpha / count, 4)}.`;
}
