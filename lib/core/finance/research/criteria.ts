/**
 * Des hypothèses aux critères vérifiables sur les états financiers. Avec 2 à 5 exercices, aucun test
 * statistique n'a de sens (peu de points, exercices non indépendants) : ACADIA vérifie si les indicateurs
 * vont dans le sens de l'hypothèse, à l'aide de critères explicites, proposés et modifiables :
 *  - niveau : l'indicateur atteint un repère (ou un seuil cité dans l'hypothèse) ;
 *  - tendance : l'indicateur s'améliore ou se dégrade sur la période ;
 *  - évolution conjointe : l'indicateur de la variable explicative et celui de la variable expliquée
 *    évoluent dans le sens attendu (ce n'est pas une corrélation) ;
 *  - mécanisme : une identité comptable (effet de levier, FR − BF = trésorerie, autofinancement).
 */
import { fold, hashKey } from "@/lib/core/understanding/text";

import { INDICATOR_BY_ID } from "../indicators/catalogue";
import { chosenIndicators, type IndicatorChoices, type IndicatorTarget, type LinkStructure } from "./structure";

export type CriterionKind = "level" | "trend" | "comovement" | "mechanism";
export type Mechanism = "levier" | "bfr_tresorerie" | "autofinancement";

export interface Criterion {
  id: string;
  rowId: string;
  kind: CriterionKind;
  /** Indicateur jugé (niveau, tendance) ; [explicatif, expliqué] (évolution conjointe) ; indicateur du mécanisme. */
  indicators: string[];
  /** Niveau : « favorable » (repère) ou seuil ; tendance : amélioration / dégradation ; évolution : même sens / sens contraire ; mécanisme : sens attendu. */
  expected: "favorable" | "amelioration" | "degradation" | "same" | "opposite" | "positive" | "negative";
  /** Exercices concernés (niveau, mécanisme). */
  scope: "dernier" | "tous" | "majorite";
  /** Seuil cité dans l'hypothèse (remplace le repère usuel). */
  threshold: { op: ">=" | "<="; value: number } | null;
  mechanism?: Mechanism;
  enabled: boolean;
  label: string;
}

export interface CriterionDecision {
  enabled?: boolean;
  scope?: Criterion["scope"];
  threshold?: Criterion["threshold"];
}

export type CriteriaDecisions = Record<string, CriterionDecision>;

const POSITIVE = /\b(ameliore|ameliorent|ameliorer|amelioration|augmente|augmentent|accroit|favorise|favorisent|renforce|renforcent|stimule|soutient|contribue positivement|hausse|positif|positive|positivement|suffit|suffisent|suffisante?s?|satisfaisante?s?|saine?s?|solvable|rentable|soutenable|equilibree?|respecte|progresse|progressent|s'ameliore)\b/;
const NEGATIVE = /\b(degrade|degradent|degrader|degradation|reduit|reduisent|diminue|diminuent|fragilise|fragilisent|penalise|penalisent|pese|pesent|limite|limitent|freine|freinent|baisse|baissent|negatif|negative|negativement|insuffisante?s?|deteriore|deteriorent|affaiblit|affaiblissent|compromet|menace|s'est degradee?)\b/;
const RISE = /\b(allongement|hausse|augmentation|croissance|accroissement|alourdissement|expansion|progression)\b/;
const FALL = /\b(baisse|reduction|diminution|raccourcissement|contraction|recul)\b/;
const TREND = /\b(s'est amelioree?|s'ameliore|progresse|s'est degradee?|se degrade|diminue|recule|evolue|evolution)\b/;
const LEVEL = /\b(satisfaisante?s?|suffisante?s?|saine?s?|solvable|rentable|soutenable|equilibree?|respecte|eleve|elevee|faible|positive?|negative?|superieure?s? a|inferieure?s? a|au moins|au plus)\b/;

/** Seuil numérique cité (« supérieur à 1 », « au moins 20 % », « inférieur à 3 ans »). */
export function thresholdOf(text: string): Criterion["threshold"] {
  const f = fold(text);
  const m = f.match(/(superieure?s? a|au moins|depasse|inferieure?s? a|au plus|ne depasse pas)\s+(\d+(?:[.,]\d+)?)\s*(%|pour ?cent)?/);
  if (!m) return null;
  const value = Number(m[2].replace(",", ".")) / (m[3] ? 100 : 1);
  return { op: /inferieur|au plus|ne depasse pas/.test(m[1]) ? "<=" : ">=", value };
}

const effectSign = (text: string): 1 | -1 | 0 => {
  const f = fold(text);
  const neg = NEGATIVE.test(f);
  const pos = POSITIVE.test(f);
  return neg && !pos ? -1 : pos && !neg ? 1 : neg && pos ? (f.search(NEGATIVE) < f.search(POSITIVE) ? -1 : 1) : 0;
};

const MECHANISMS: Array<{ mechanism: Mechanism; causes: string[]; effects: string[]; indicator: string }> = [
  { mechanism: "levier", causes: ["endettement", "effet_levier", "credit_bancaire", "frais_financiers"], effects: ["rentabilite_financiere", "rentabilite", "performance_financiere"], indicator: "levier_ecart" },
  { mechanism: "bfr_tresorerie", causes: ["credit_clients", "stocks", "bfr", "croissance", "credit_fournisseurs"], effects: ["tresorerie", "liquidite"], indicator: "tn" },
  { mechanism: "autofinancement", causes: ["autofinancement"], effects: ["investissement"], indicator: "autofin_invest" },
];

export const MECHANISM_LABELS: Record<Mechanism, string> = {
  levier: "Effet de levier : rentabilité financière = rentabilité économique + (rentabilité économique − coût de la dette) × dettes ÷ capitaux propres",
  bfr_tresorerie: "Équilibre fonctionnel : trésorerie nette = fonds de roulement − besoin de financement",
  autofinancement: "Financement des investissements : autofinancement ÷ investissements",
};

const name = (id: string) => INDICATOR_BY_ID[id]?.label ?? id;

export function buildCriteria(links: LinkStructure[], targets: IndicatorTarget[], choices: IndicatorChoices, decisions: CriteriaDecisions = {}): Criterion[] {
  const indicatorsOf = (conceptId: string | undefined) => {
    const target = targets.find((t) => t.key === `concept:${conceptId}`);
    return target ? chosenIndicators(target, choices) : [];
  };
  const criteria: Criterion[] = [];
  const push = (c: Omit<Criterion, "enabled">) => {
    const d = decisions[c.id] ?? {};
    criteria.push({ ...c, enabled: d.enabled ?? true, scope: d.scope ?? c.scope, threshold: d.threshold !== undefined ? d.threshold : c.threshold });
  };
  for (const link of links) {
    const text = link.statement;
    const f = fold(text);
    const threshold = thresholdOf(text);
    if (link.independent && link.dependent) {
      const vi = indicatorsOf(link.independent.id)[0];
      const vd = indicatorsOf(link.dependent.id)[0];
      const sign = effectSign(text) || 1;
      const viMove = FALL.test(f) && !RISE.test(f) ? -1 : 1;
      if (vi && vd) {
        const vdDirection = INDICATOR_BY_ID[vd].direction === "lower" ? -1 : 1;
        const same = viMove * sign * vdDirection > 0;
        push({ id: `${link.rowId}:comovement`, rowId: link.rowId, kind: "comovement", indicators: [vi, vd], expected: same ? "same" : "opposite", scope: "tous", threshold: null, label: `Quand « ${name(vi)} » ${viMove > 0 ? "augmente" : "baisse"}, « ${name(vd)} » ${same === (viMove > 0) ? "augmente" : "baisse"} (évolution conjointe d'un exercice à l'autre)` });
      }
      const mech = MECHANISMS.find((m) => m.causes.includes(link.independent!.id) && m.effects.includes(link.dependent!.id));
      if (mech) {
        const expected = mech.mechanism === "bfr_tresorerie" ? (sign < 0 ? "negative" : "positive") : sign < 0 ? "negative" : "positive";
        push({
          id: `${link.rowId}:mechanism`,
          rowId: link.rowId,
          kind: "mechanism",
          indicators: [mech.indicator],
          expected,
          scope: "majorite",
          threshold: null,
          mechanism: mech.mechanism,
          label:
            mech.mechanism === "levier"
              ? `Effet de levier ${expected === "positive" ? "positif" : "négatif"} : la rentabilité économique après impôt ${expected === "positive" ? "dépasse" : "est inférieure à"} le coût de la dette après impôt`
              : mech.mechanism === "bfr_tresorerie"
                ? `La trésorerie ${expected === "negative" ? "baisse" : "progresse"} parce que le besoin de financement d'exploitation ${expected === "negative" ? "augmente plus vite" : "augmente moins vite"} que le fonds de roulement`
                : "L'autofinancement couvre les investissements (rapport d'au moins 1)",
        });
      }
      continue;
    }
    // Objectif descriptif ou hypothèse sur un seul concept : niveau et/ou tendance.
    const concepts = link.described.slice(0, 2);
    for (const concept of concepts) {
      const judged = indicatorsOf(concept.id).filter((id) => INDICATOR_BY_ID[id].direction !== "neutral" && INDICATOR_BY_ID[id].norms).slice(0, 3);
      const isTrend = TREND.test(f) && !LEVEL.test(f);
      for (const id of judged) {
        if (isTrend) {
          const degradation = effectSign(text) < 0 || /degrad|diminu|recul|baiss/.test(f);
          push({ id: `${link.rowId}:trend:${id}`, rowId: link.rowId, kind: "trend", indicators: [id], expected: degradation ? "degradation" : "amelioration", scope: "tous", threshold: null, label: `« ${name(id)} » ${degradation ? "se dégrade" : "s'améliore"} entre le premier et le dernier exercice` });
        } else {
          const def = INDICATOR_BY_ID[id];
          const growth = def.family === "croissance";
          push({ id: `${link.rowId}:level:${id}`, rowId: link.rowId, kind: "level", indicators: [id], expected: "favorable", scope: "dernier", threshold: threshold && judged[0] === id ? threshold : growth ? { op: ">=", value: 0 } : null, label: `« ${name(id)} » ${threshold && judged[0] === id ? `${threshold.op === ">=" ? "au moins" : "au plus"} ${threshold.value}` : growth ? "positive" : "dans la zone favorable de son repère"}` });
        }
      }
    }
  }
  return criteria;
}

export const criteriaKey = (criteria: Criterion[], statements: string) => hashKey({ criteria: criteria.map((c) => [c.id, c.enabled, c.scope, c.threshold, c.indicators, c.expected]), statements });
