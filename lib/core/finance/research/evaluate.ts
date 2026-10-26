/**
 * Évaluation des critères sur les indicateurs calculés, puis verdict prudent par hypothèse
 * (jamais « prouvée » : quelques exercices d'une seule entreprise ne démontrent pas un lien général).
 */
import type { ChainVerdict } from "@/lib/core/chain";

import type { FinanceComputation, IndicatorSeries } from "../compute";
import { formatValue } from "../format";
import { INDICATOR_BY_ID } from "../indicators/catalogue";
import type { FinanceDossier } from "../types";
import type { Criterion } from "./criteria";
import type { LinkStructure } from "./structure";

export type CriterionStatus = "respecte" | "non_respecte" | "contraire" | "non_verifiable";

export const CRITERION_STATUS_LABELS: Record<CriterionStatus, string> = {
  respecte: "Vérifié",
  non_respecte: "Non vérifié",
  contraire: "Sens contraire",
  non_verifiable: "Non vérifiable",
};

export const FINANCE_VERDICT_LABELS: Record<ChainVerdict, string> = {
  supported: "Compatible avec les états financiers (non prouvée)",
  partially_supported: "Partiellement compatible avec les états financiers",
  not_supported: "Non soutenue par ces états financiers",
  contrary: "Contredite par l'évolution observée",
  inconclusive: "Non vérifiable avec ces états (données insuffisantes)",
  not_examined: "Non examinée (aucun critère retenu)",
};

export interface CriterionResult {
  criterion: Criterion;
  status: CriterionStatus;
  /** Constat chiffré. */
  observed: string;
  /** La même chose en une phrase simple, à dire à l'oral (« X passe de … à … pendant que Y … »). */
  plain: string;
}

export interface HypothesisResult {
  link: LinkStructure;
  verdict: ChainVerdict;
  results: CriterionResult[];
}

const sgn = (x: number, eps: number) => (x > eps ? 1 : x < -eps ? -1 : 0);
const epsilonOf = (s: IndicatorSeries) => (s.def.unit === "pct" || s.def.unit === "points" ? 0.001 : s.def.unit === "jours" ? 0.5 : s.def.unit === "ratio" ? 0.005 : 0.5);

export function evaluateCriterion(criterion: Criterion, computation: FinanceComputation, dossier: FinanceDossier): CriterionResult {
  const raw = evaluateRaw(criterion, computation, dossier);
  return { ...raw, plain: raw.status === "non_verifiable" ? raw.observed : plainSentence(criterion, computation, dossier) };
}

/** Phrase simple et chiffrée décrivant ce que montrent les indicateurs d'un critère. */
function plainSentence(criterion: Criterion, computation: FinanceComputation, dossier: FinanceDossier): string {
  const labels = computation.exercises.map((e) => e.label);
  const name = (id: string) => {
    const label = INDICATOR_BY_ID[id].label.replace(/\s*\((ROE|ROA|TN|FR|gearing|ROCE)\)\s*$/i, "");
    return `« ${label.charAt(0).toLowerCase()}${label.slice(1)} »`;
  };
  const span = (id: string) => {
    const pts = (computation.series[id]?.values ?? []).map((v, i) => ({ v: v.value, i })).filter((p) => p.v !== null);
    const f = (v: number) => formatValue(v, INDICATOR_BY_ID[id].unit, dossier.company);
    if (!pts.length) return null;
    const first = pts[0];
    const last = pts.at(-1)!;
    return { first: first.v!, last: last.v!, text: pts.length > 1 ? `passe de ${f(first.v!)} en ${labels[first.i]} à ${f(last.v!)} en ${labels[last.i]}` : `vaut ${f(last.v!)} en ${labels[last.i]}` };
  };
  const [a, b] = criterion.indicators;
  if (criterion.kind === "comovement") {
    const x = span(a);
    const y = span(b);
    return x && y ? `${name(a)} ${x.text}, pendant que ${name(b)} ${y.text}` : "";
  }
  if (criterion.mechanism === "levier") {
    const x = span("levier_ecart");
    if (!x) return "";
    return `l'écart entre la rentabilité économique et le coût de la dette (après impôt) ${x.text}${x.first > 0 && x.last < 0 ? " : l'effet de levier, positif au début, devient négatif" : x.last > 0 ? " : l'effet de levier reste positif" : " : l'effet de levier est négatif"}`;
  }
  if (criterion.mechanism === "bfr_tresorerie") {
    const tn = span("tn");
    const bfe = span("bfe");
    const fr = span("fr");
    return tn && bfe && fr ? `le besoin de financement d'exploitation ${bfe.text}, tandis que le fonds de roulement ${fr.text} : la différence entre les deux, c'est la trésorerie nette, qui ${tn.text}` : "";
  }
  if (criterion.mechanism === "autofinancement") {
    const x = span("autofin_invest");
    return x ? `la couverture des investissements par l'autofinancement ${x.text}` : "";
  }
  const x = span(a);
  return x ? `${name(a)} ${x.text}` : "";
}

function evaluateRaw(criterion: Criterion, computation: FinanceComputation, dossier: FinanceDossier): Omit<CriterionResult, "plain"> {
  const { exercises, series } = computation;
  const labels = exercises.map((e) => e.label);
  const fmt = (id: string, v: number | null) => formatValue(v, INDICATOR_BY_ID[id].unit, dossier.company);
  const values = (id: string) => series[id]?.values.map((v) => v.value) ?? [];
  const history = (id: string) =>
    values(id)
      .map((v, i) => (v === null ? null : `${fmt(id, v)} (${labels[i]})`))
      .filter(Boolean)
      .join(", ");
  const none = (why: string): Omit<CriterionResult, "plain"> => ({ criterion, status: "non_verifiable", observed: why });

  if (criterion.kind === "level") {
    const id = criterion.indicators[0];
    const s = series[id];
    const points = s.values.map((v, i) => ({ v, i })).filter((p) => p.v.value !== null);
    if (!points.length) return none(`« ${s.def.label} » n'est pas calculable : ${s.values.find((v) => v.reason)?.reason ?? "données manquantes"}.`);
    const passes = (p: (typeof points)[number]) => {
      if (criterion.threshold) return criterion.threshold.op === ">=" ? p.v.value! >= criterion.threshold.value : p.v.value! <= criterion.threshold.value;
      return p.v.zone === "favorable";
    };
    const adverse = (p: (typeof points)[number]) => (criterion.threshold ? !passes(p) : p.v.zone === "defavorable");
    const scope = criterion.scope === "dernier" ? points.slice(-1) : points;
    const ok = scope.filter(passes).length;
    const status: CriterionStatus = criterion.scope === "majorite" ? (ok * 2 > scope.length ? "respecte" : scope.filter(adverse).length * 2 > scope.length ? "contraire" : "non_respecte") : ok === scope.length ? "respecte" : scope.some(adverse) ? "contraire" : "non_respecte";
    return { criterion, status, observed: `${s.def.label} : ${history(id)}.` };
  }

  if (criterion.kind === "trend") {
    const id = criterion.indicators[0];
    const s = series[id];
    const points = s.values.map((v, i) => ({ v: v.value, i })).filter((p) => p.v !== null);
    if (points.length < 2) return none(`Il faut au moins deux exercices où « ${s.def.label} » est calculable.`);
    const delta = points.at(-1)!.v! - points[0].v!;
    const better = s.def.direction === "lower" ? -sgn(delta, epsilonOf(s)) : sgn(delta, epsilonOf(s));
    const wanted = criterion.expected === "amelioration" ? 1 : -1;
    return { criterion, status: better === 0 ? "non_respecte" : better === wanted ? "respecte" : "contraire", observed: `${s.def.label} : ${history(id)}.` };
  }

  if (criterion.kind === "comovement") {
    const [vi, vd] = criterion.indicators;
    const a = values(vi);
    const b = values(vd);
    let agree = 0;
    let disagree = 0;
    let intervals = 0;
    for (let i = 1; i < exercises.length; i += 1) {
      if (a[i] === null || a[i - 1] === null || b[i] === null || b[i - 1] === null) continue;
      intervals += 1;
      const da = sgn(a[i]! - a[i - 1]!, epsilonOf(series[vi]));
      const db = sgn(b[i]! - b[i - 1]!, epsilonOf(series[vd]));
      if (!da || !db) continue;
      if ((criterion.expected === "same" ? da * db : -da * db) > 0) agree += 1;
      else disagree += 1;
    }
    if (!intervals) return none("Il faut au moins deux exercices successifs où les deux indicateurs sont calculables.");
    const needed = Math.ceil((2 * intervals) / 3);
    const status: CriterionStatus = agree >= needed ? "respecte" : disagree >= needed ? "contraire" : "non_respecte";
    const caution = intervals === 1 ? " Un seul intervalle : indice très fragile." : "";
    return { criterion, status, observed: `${series[vi].def.label} : ${history(vi)} ; ${series[vd].def.label} : ${history(vd)}. Sens attendu observé sur ${agree} intervalle(s) sur ${intervals}.${caution}` };
  }

  // Mécanismes comptables.
  if (criterion.mechanism === "levier") {
    const s = series.levier_ecart;
    const points = s.values.map((v, i) => ({ v: v.value, i })).filter((p) => p.v !== null);
    if (!points.length) return none(`Effet de levier non calculable : ${s.values.find((v) => v.reason)?.reason ?? "données manquantes"}.`);
    const wanted = criterion.expected === "positive" ? 1 : -1;
    const ok = points.filter((p) => sgn(p.v!, 1e-4) === wanted).length;
    const contrary = points.filter((p) => sgn(p.v!, 1e-4) === -wanted).length;
    const last = points.at(-1)!;
    const lastSign = sgn(last.v!, 1e-4);
    // Portée choisie : dernier exercice, chaque exercice, ou majorité des exercices.
    const status: CriterionStatus =
      criterion.scope === "dernier"
        ? lastSign === wanted ? "respecte" : lastSign === -wanted ? "contraire" : "non_respecte"
        : criterion.scope === "tous"
          ? ok === points.length ? "respecte" : contrary * 2 > points.length ? "contraire" : "non_respecte"
          : ok * 2 > points.length ? "respecte" : contrary * 2 > points.length ? "contraire" : "non_respecte";
    const lastText = sgn(last.v!, 1e-4) === wanted ? "" : ` En ${labels[last.i]}, l'effet s'inverse.`;
    return { criterion, status, observed: `Écart rentabilité économique − coût de la dette (après impôt) : ${history("levier_ecart")} ; sens attendu sur ${ok} exercice(s) sur ${points.length}.${lastText}` };
  }
  if (criterion.mechanism === "bfr_tresorerie") {
    const tn = values("tn");
    const bfe = values("bfe");
    const fr = values("fr");
    let falls = 0;
    let explained = 0;
    let rises = 0;
    const steps: string[] = [];
    for (let i = 1; i < exercises.length; i += 1) {
      if ([tn[i], tn[i - 1], bfe[i], bfe[i - 1], fr[i], fr[i - 1]].some((v) => v === null)) continue;
      const dTn = tn[i]! - tn[i - 1]!;
      const dBfe = bfe[i]! - bfe[i - 1]!;
      const dFr = fr[i]! - fr[i - 1]!;
      steps.push(`${labels[i - 1]} → ${labels[i]} : trésorerie ${fmt("tn", dTn)}, fonds de roulement ${fmt("fr", dFr)}, besoin de financement d'exploitation ${fmt("bfe", dBfe)}`);
      if (dTn < 0) {
        falls += 1;
        if (dBfe > 0 && dBfe > dFr) explained += 1;
      } else if (dTn > 0) rises += 1;
    }
    if (!steps.length) return none("Il faut au moins deux bilans successifs.");
    const wantedFall = criterion.expected === "negative";
    const status: CriterionStatus = wantedFall ? (falls && explained === falls ? "respecte" : rises > falls ? "contraire" : "non_respecte") : rises > falls ? "respecte" : "contraire";
    return { criterion, status, observed: `${steps.join(" ; ")}.` };
  }
  if (criterion.mechanism === "autofinancement") {
    const s = series.autofin_invest;
    const points = s.values.filter((v) => v.value !== null);
    if (!points.length) return none(`Couverture des investissements non calculable : ${s.values.find((v) => v.reason)?.reason ?? "données manquantes"}.`);
    const ok = points.filter((v) => v.value! >= 1).length;
    return { criterion, status: ok * 2 > points.length ? "respecte" : "contraire", observed: `${s.def.label} : ${history("autofin_invest")}.` };
  }
  return none("Critère non reconnu.");
}

export function evaluateHypotheses(links: LinkStructure[], criteria: Criterion[], computation: FinanceComputation, dossier: FinanceDossier): HypothesisResult[] {
  return links.map((link) => {
    const results = criteria.filter((c) => c.rowId === link.rowId && c.enabled).map((c) => evaluateCriterion(c, computation, dossier));
    const verifiable = results.filter((r) => r.status !== "non_verifiable");
    let verdict: ChainVerdict;
    if (!results.length) verdict = "not_examined";
    else if (!verifiable.length) verdict = "inconclusive";
    else {
      const ok = verifiable.filter((r) => r.status === "respecte").length;
      const contrary = verifiable.filter((r) => r.status === "contraire").length;
      verdict = ok === verifiable.length ? "supported" : contrary > ok && contrary * 2 >= verifiable.length ? "contrary" : ok * 2 >= verifiable.length ? "partially_supported" : "not_supported";
    }
    return { link, verdict, results };
  });
}
