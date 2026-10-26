/**
 * « Comment ce chiffre a été obtenu » : chaque indicateur écrit en toutes lettres, avec les montants
 * des états financiers. Par exemple :
 *   Endettement net = DA + DB + DT − BT = 2 040 000 + 0 + 473 176 − 60 000 = 2 453 176
 *   Gearing = Endettement net ÷ CP = 2 453 176 ÷ 1 568 911 = 1,56
 * puis ce que le résultat signifie (en clair, au regard du repère, et dans le temps).
 * Les montants affichés sont exactement ceux utilisés par le calcul (aucune valeur arrondie avant calcul).
 */
import { nodeOf, trendOf, type FinanceComputation, type IndicatorSeries } from "./compute";
import { bandsText, formatValue } from "./format";
import type { Node } from "./formula";
import { AGGREGATES } from "./indicators/aggregates";
import { INDICATOR_BY_ID } from "./indicators/catalogue";
import { formatAmount } from "./numbers";
import { exerciseMonths } from "./statements";
import { POSTE_BY_CODE } from "./syscohada/chart";
import { SECTOR_LABELS, type FinanceDossier } from "./types";

/** Noms courts des agrégats dans les formules écrites. */
export const AGGREGATE_NAMES: Record<string, string> = {
  FR: "FR",
  BF: "BF",
  BFE: "BFE",
  BFHAO: "BF HAO",
  TRESO_NETTE: "TN",
  DETTES_FIN: "Dettes financières",
  DETTES_NETTES: "Endettement net",
  DETTES_TOTALES: "Dettes totales",
  CAFG: "CAFG",
  CAFG_ADD: "CAFG (méthode additive)",
  CMV: "Coût d'achat des marchandises vendues",
  CONSO: "Achats consommés",
  ACHATS_BS: "Achats de biens et services",
  CHARGES_DEC: "Charges décaissables",
  PRODUCTION: "Production",
  CAP_ECO: "Capital économique",
  RE_NETTE: "Résultat d'exploitation après impôt",
  INVEST: "Investissements",
};

const PARAM_NAMES: Record<string, string> = { tva: "TVA", taux_is: "taux d'impôt", jours: "jours" };
const OPS: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };
const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

export interface CalcLine {
  exercise: string;
  /** Étapes intermédiaires (agrégats) puis le calcul final, déjà chiffrés. */
  steps: string[];
  /** Valeur finale lisible (« 1,56 », « 6,0 % », « 62 j »…). */
  result: string | null;
  /** Raison si l'indicateur n'est pas calculable pour cet exercice. */
  unavailable?: string;
}

export interface IndicatorExplanation {
  id: string;
  label: string;
  /** Formule écrite avec les codes et les noms (« Endettement net ÷ CP »). */
  formula: string;
  /** Légende des codes cités (« CP : total capitaux propres… »). */
  legend: string;
  lines: CalcLine[];
  /** Ce que cela signifie : en clair, au regard du repère, dans le temps. */
  meaning: string[];
}

const wrap = (s: string) => `(${s})`;

function symbolic(node: Node, parent?: { op: string; right: boolean }): string {
  switch (node.t) {
    case "num":
      return formatAmount(node.v);
    case "id":
      return POSTE_BY_CODE[node.name] ? node.name : (AGGREGATE_NAMES[node.name] ?? PARAM_NAMES[node.name] ?? node.name);
    case "neg":
      return `−${symbolic(node.e, { op: "*", right: true })}`;
    case "call": {
      const inner = node.args.map((a) => symbolic(a)).join(" ; ");
      if (node.fn === "prev") return `${node.args[0].t === "id" ? inner : wrap(inner)} de l'exercice précédent`;
      if (node.fn === "avg") return `moyenne de ${inner} (exercice et exercice précédent)`;
      return `${node.fn === "abs" ? "valeur absolue" : node.fn}(${inner})`;
    }
    case "bin": {
      const s = `${symbolic(node.a, { op: node.op, right: false })} ${OPS[node.op]} ${symbolic(node.b, { op: node.op, right: true })}`;
      const needs = parent && (PRECEDENCE[node.op] < PRECEDENCE[parent.op] || (PRECEDENCE[node.op] === PRECEDENCE[parent.op] && parent.right && (parent.op === "-" || parent.op === "/")));
      return needs ? wrap(s) : s;
    }
  }
}

type Value = (name: string, index: number) => number | null;

function numeric(node: Node, index: number, value: Value, parent?: { op: string; right: boolean }): string {
  switch (node.t) {
    case "num":
      return formatAmount(node.v);
    case "id": {
      const v = value(node.name, index);
      if (v === null) return "?";
      const text = node.name === "tva" || node.name === "taux_is" ? formatAmount(v) : formatAmount(Math.round(v * 100) / 100);
      return v < 0 && parent ? wrap(text) : text;
    }
    case "neg":
      return `−${numeric(node.e, index, value, { op: "*", right: true })}`;
    case "call": {
      if (node.fn === "prev") return numeric(node.args[0], index - 1, value, parent);
      if (node.fn === "avg") return `(${numeric(node.args[0], index, value, { op: "+", right: false })} + ${numeric(node.args[0], index - 1, value, { op: "+", right: true })}) ÷ 2`;
      return `${node.fn === "abs" ? "valeur absolue" : node.fn}(${node.args.map((a) => numeric(a, index, value)).join(" ; ")})`;
    }
    case "bin": {
      const s = `${numeric(node.a, index, value, { op: node.op, right: false })} ${OPS[node.op]} ${numeric(node.b, index, value, { op: node.op, right: true })}`;
      const needs = parent && (PRECEDENCE[node.op] < PRECEDENCE[parent.op] || (PRECEDENCE[node.op] === PRECEDENCE[parent.op] && parent.right && (parent.op === "-" || parent.op === "/")));
      return needs ? wrap(s) : s;
    }
  }
}

function identifiers(node: Node, out: Set<string>): Set<string> {
  if (node.t === "id") out.add(node.name);
  else if (node.t === "neg") identifiers(node.e, out);
  else if (node.t === "bin") {
    identifiers(node.a, out);
    identifiers(node.b, out);
  } else if (node.t === "call") node.args.forEach((a) => identifiers(a, out));
  return out;
}

/** Agrégats utilisés, dans l'ordre où il faut les calculer (les plus profonds d'abord). */
function aggregatesOf(node: Node): string[] {
  const order: string[] = [];
  const visit = (n: Node) => {
    for (const name of identifiers(n, new Set())) {
      if (!AGGREGATES[name] || order.includes(name)) continue;
      visit(nodeOf(AGGREGATES[name].formula));
      if (!order.includes(name)) order.push(name);
    }
  };
  visit(node);
  return order;
}

/** Valeur finale lisible, avec la conversion en pourcentage ou en points quand il y a lieu. */
function resultText(value: number, unit: IndicatorSeries["def"]["unit"]): string {
  const raw = formatAmount(Math.round(value * 1000) / 1000);
  if (unit === "pct") return `${raw}, soit ${formatValue(value, "pct")}`;
  if (unit === "points") return `${raw}, soit ${formatValue(value, "points").replace("pts", "points")}`;
  if (unit === "jours") return formatValue(value, "jours").replace(" j", " jours");
  if (unit === "annees") return formatValue(value, "annees");
  if (unit === "montant") return formatAmount(Math.round(value));
  return formatValue(value, unit);
}

export function explainIndicator(id: string, computation: FinanceComputation, dossier: FinanceDossier): IndicatorExplanation | null {
  const def = INDICATOR_BY_ID[id];
  const series = computation.series[id];
  if (!def || !series) return null;
  const labels = computation.exercises.map((e) => e.label);
  const node = nodeOf(def.formula);
  const aggregates = aggregatesOf(node);
  const value: Value = (name, index) => {
    if (index < 0) return null;
    if (POSTE_BY_CODE[name]) return computation.values[index]?.[name]?.value ?? null;
    if (name === "tva") return computation.params.tva;
    if (name === "taux_is") return computation.params.taux_is;
    if (name === "jours") return (exerciseMonths(computation.exercises[index]) ?? 12) * 30;
    if (AGGREGATES[name]) return aggregateValue(name, index);
    return null;
  };
  // Valeur d'un agrégat : recalculée par la même évaluation que le moteur (via une série fictive).
  const aggregateCache = new Map<string, number | null>();
  function aggregateValue(name: string, index: number): number | null {
    const key = `${name}@${index}`;
    if (aggregateCache.has(key)) return aggregateCache.get(key)!;
    const result = evaluateNumeric(nodeOf(AGGREGATES[name].formula), index);
    aggregateCache.set(key, result);
    return result;
  }
  function evaluateNumeric(n: Node, index: number): number | null {
    switch (n.t) {
      case "num":
        return n.v;
      case "id":
        return value(n.name, index);
      case "neg": {
        const v = evaluateNumeric(n.e, index);
        return v === null ? null : -v;
      }
      case "bin": {
        const a = evaluateNumeric(n.a, index);
        const b = evaluateNumeric(n.b, index);
        if (a === null || b === null) return null;
        return n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : b === 0 ? null : a / b;
      }
      case "call": {
        if (n.fn === "prev") return evaluateNumeric(n.args[0], index - 1);
        const args = n.args.map((x) => evaluateNumeric(x, index));
        if (n.fn === "avg") {
          const before = evaluateNumeric(n.args[0], index - 1);
          return args[0] === null || before === null ? null : (args[0] + before) / 2;
        }
        if (args.some((x) => x === null)) return null;
        const vals = args as number[];
        return n.fn === "abs" ? Math.abs(vals[0]) : n.fn === "min" ? Math.min(...vals) : Math.max(...vals);
      }
    }
  }

  const codes = [...identifiers(node, new Set()), ...aggregates.flatMap((a) => [...identifiers(nodeOf(AGGREGATES[a].formula), new Set())])].filter((c, i, all) => POSTE_BY_CODE[c] && all.indexOf(c) === i);
  const legend = codes.map((c) => `${c} : ${POSTE_BY_CODE[c].label.charAt(0).toLowerCase()}${POSTE_BY_CODE[c].label.slice(1)}`).join(" ; ");
  const shortLabel = def.label.replace(/\s*\(.*\)\s*$/, "");

  const lines: CalcLine[] = labels.map((label, index) => {
    const point = series.values[index];
    if (point.value === null) return { exercise: label, steps: [], result: null, unavailable: point.reason ?? "non calculable" };
    const result = resultText(point.value, def.unit);
    // Indicateur qui EST un agrégat (FR, TN…) : une seule ligne, sous son nom complet.
    const self = node.t === "id" && AGGREGATES[node.name] ? node.name : null;
    const steps = aggregates.map((a) => {
      const f = nodeOf(AGGREGATES[a].formula);
      const head = a === self ? `${shortLabel} (${AGGREGATE_NAMES[a]})` : AGGREGATE_NAMES[a];
      return `${head} = ${symbolic(f)} = ${numeric(f, index, value)} = ${a === self ? result : formatAmount(Math.round((aggregateValue(a, index) ?? 0) * 100) / 100)}`;
    });
    if (!self) steps.push(`${shortLabel} = ${symbolic(node)} = ${numeric(node, index, value)} = ${result}`);
    return { exercise: label, steps, result: formatValue(point.value, def.unit, def.unit === "montant" ? dossier.company : undefined) };
  });

  // Ce que cela signifie.
  const meaning: string[] = [`En clair : ${def.definition}`, `Pourquoi c'est important : ${def.why}`];
  const lastIndex = series.values.map((v) => v.value !== null).lastIndexOf(true);
  if (lastIndex >= 0) {
    const last = series.values[lastIndex];
    const repere = bandsText(def, series.bands);
    const sector = def.norms?.bySector?.[dossier.company.sector] ? ` pour le secteur « ${SECTOR_LABELS[dossier.company.sector].split(" (")[0].toLowerCase()} »` : "";
    if (last.zone) meaning.push(`En ${labels[lastIndex]}, ${formatValue(last.value, def.unit, dossier.company)} : ${last.zone === "favorable" ? "c'est favorable" : last.zone === "vigilance" ? "c'est à surveiller" : "c'est défavorable"} au regard du repère usuel${sector} (${repere}) — ${def.reading[last.zone]}.`);
    else meaning.push(`En ${labels[lastIndex]}, ${formatValue(last.value, def.unit, dossier.company)}.`);
  }
  const trend = trendOf(series);
  const pts = series.values.map((v, i) => ({ v: v.value, i })).filter((p) => p.v !== null);
  if (trend && pts.length > 1) {
    const better = def.direction === "neutral" ? null : (trend === "hausse") === (def.direction === "higher");
    meaning.push(`Évolution : ${pts.map((p) => `${formatValue(p.v, def.unit)} (${labels[p.i]})`).join(" → ")} : ${trend === "stable" ? "stable" : trend}${better === null || trend === "stable" ? "" : better ? ", c'est une amélioration" : ", c'est une dégradation"}.`);
  }
  for (const limit of def.limits ?? []) meaning.push(`Attention : ${limit}`);
  if (def.caveat) meaning.push(`Attention : ${def.caveat}`);
  return { id, label: def.label, formula: `${shortLabel} = ${def.formulaLabel}`, legend, lines, meaning };
}
