/**
 * Chaîne de cohérence de la recherche (sciences économiques et de gestion) :
 * problème → questions de recherche → objectifs → hypothèses → variables (VI / VD) → indicateurs
 * → questions du questionnaire → colonnes du fichier.
 *
 * ACADIA PROPOSE chaque lien (appariement des énoncés, rattachement des questions du questionnaire
 * aux variables) avec sa justification ; l'utilisateur valide ou corrige. Rien n'est présenté comme
 * établi tant qu'il n'est pas confirmé. Moteur déterministe : mêmes entrées ⇒ même chaîne.
 */
import type { ResearchUnderstandingInput, UnderstandingReport, VariableCard } from "@/lib/core/understanding";
import { KNOWLEDGE } from "@/lib/core/understanding/knowledge";
import { fold } from "@/lib/core/understanding/text";

import type { InstrumentQuestion, QuestionLink } from "../journey/instrument";
import type { Cartography } from "../journey/mapping";
import { corpusOf, coverage, tokensOf } from "../journey/match";
import type { FileStructure, QuestionUnit } from "../journey/structure";

/* ---------------------------------------------------------------- */
/* Modèle                                                            */
/* ---------------------------------------------------------------- */

export type StatementKind = "question" | "objective" | "hypothesis";

export interface ChainStatement {
  id: string;
  kind: StatementKind;
  /** Rang dans la saisie (0 = premier). */
  index: number;
  text: string;
  /** Écrit par le chercheur, ou proposé par ACADIA (à valider). */
  origin: "user" | "engine";
  /** Élément du moteur de compréhension correspondant (pour relier les relations repérées). */
  ref: string;
}

/** Côté d'une variable dans la relation étudiée. */
export type VariableSide = "independent" | "dependent";

export const SIDE_LABELS: Record<VariableSide, string> = { independent: "Variable indépendante (VI)", dependent: "Variable dépendante (VD)" };

export interface ChainVariable {
  key: string;
  name: string;
  side: VariableSide;
  /** Indicateurs connus pour ce concept (base méthodologique), proposés au chercheur. */
  suggestedIndicators: string[];
}

/** Une ligne de la matrice de cohérence : une question de recherche, son objectif, son hypothèse et ses variables. */
export interface ChainRow {
  id: string;
  questionId: string | null;
  objectiveId: string | null;
  hypothesisId: string | null;
  independent: string[];
  dependent: string[];
  /** Objectif descriptif (« décrire », « identifier ») : vérifié par la statistique descriptive, sans test. */
  descriptive: boolean;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  status: "proposed" | "confirmed";
}

/** Rôle d'une question du questionnaire dans la recherche. */
export type QuestionSide = "dependent" | "independent" | "profile" | "other";

export const QUESTION_SIDE_LABELS: Record<QuestionSide, string> = {
  dependent: "Mesure la variable dépendante",
  independent: "Mesure la variable indépendante",
  profile: "Profil des répondants",
  other: "Autre question",
};

export interface QuestionAssignment {
  unitId: string;
  text: string;
  side: QuestionSide;
  variableKey: string | null;
  /** Indicateur que la question mesure (indicateur connu reconnu, ou la question elle-même). */
  indicator: string;
  score: number;
  confidence: "high" | "medium" | "low";
  reason: string;
  origin: "engine" | "user";
  /** Autres variables possibles quand le rattachement est ambigu. */
  alternatives: string[];
}

export interface ResearchChain {
  problem: string;
  statements: ChainStatement[];
  variables: ChainVariable[];
  rows: ChainRow[];
  assignments: QuestionAssignment[];
  /** Énoncés qui n'ont trouvé aucune correspondance (à compléter par le chercheur). */
  issues: string[];
}

export interface ChainDecisions {
  /** Corrections de l'appariement (ligne → énoncés) et confirmations. */
  rows: Record<string, { questionId?: string | null; objectiveId?: string | null; hypothesisId?: string | null; confirmed?: boolean }>;
  /** Rattachement d'une question du questionnaire choisi par l'utilisateur. */
  assignments: Record<string, { side: QuestionSide; variableKey: string | null }>;
}

export const emptyChainDecisions = (): ChainDecisions => ({ rows: {}, assignments: {} });

/* ---------------------------------------------------------------- */
/* Appariement questions ↔ objectifs ↔ hypothèses                     */
/* ---------------------------------------------------------------- */

const DESCRIPTIVE_OBJECTIVE = /^\s*(d[ée]crire|identifier|caract[ée]riser|pr[ée]senter|recenser|dresser|inventorier|conna[iî]tre|mesurer le niveau)/i;

function similarity(a: string, b: string): number {
  const ta = tokensOf(a);
  const tb = tokensOf(b);
  if (!ta.length || !tb.length) return 0;
  return (coverage(ta, tb).score + coverage(tb, ta).score) / 2;
}

/**
 * Appariement glouton : les paires les plus semblables d'abord ; à égalité (ou sans mot commun),
 * le même rang (1re question ↔ 1er objectif) l'emporte. Chaque énoncé n'est utilisé qu'une fois.
 */
function pair(left: ChainStatement[], right: ChainStatement[], relationsOf: (ref: string) => Set<string>): Map<string, { id: string; score: number; reason: string }> {
  const candidates: Array<{ l: ChainStatement; r: ChainStatement; score: number; lexical: number }> = [];
  for (const l of left)
    for (const r of right) {
      // Une même relation repérée dans les deux énoncés est le signal d'appariement le plus sûr.
      const shared = [...relationsOf(l.ref)].some((id) => relationsOf(r.ref).has(id));
      const lexical = Math.min(1, similarity(l.text, r.text) + (shared ? 0.35 : 0));
      candidates.push({ l, r, lexical, score: lexical + (l.index === r.index ? 0.15 : 0) });
    }
  candidates.sort((a, b) => b.score - a.score);
  const usedL = new Set<string>();
  const usedR = new Set<string>();
  const result = new Map<string, { id: string; score: number; reason: string }>();
  for (const c of candidates) {
    if (usedL.has(c.l.id) || usedR.has(c.r.id)) continue;
    // Sans aucun mot commun, seul le même rang justifie l'appariement.
    if (c.lexical < 0.15 && c.l.index !== c.r.index) continue;
    usedL.add(c.l.id);
    usedR.add(c.r.id);
    // Mots communs affichés tels que le chercheur les a écrits (et non leurs racines).
    const shared = new Set(tokensOf(c.l.text).filter((t) => tokensOf(c.r.text).includes(t)));
    const common = [...new Set(c.l.text.split(/[^A-Za-zÀ-ÿ'’-]+/).filter((w) => w.length >= 4 && tokensOf(w).some((t) => shared.has(t))).map((w) => w.toLowerCase().replace(/^.*['’]/, "")))];
    result.set(c.l.id, { id: c.r.id, score: c.lexical, reason: c.lexical >= 0.15 ? `mots communs : ${common.slice(0, 5).join(", ") || "formulations proches"}` : "même rang dans votre saisie" });
  }
  return result;
}

const REF_PREFIX: Record<StatementKind, string> = { question: "specificQuestion", objective: "specificObjective", hypothesis: "hypothesis" };

const statementsOf = (kind: StatementKind, texts: string[], options: { origin?: "user" | "engine"; ref?: (index: number) => string } = {}): ChainStatement[] =>
  texts
    .map((text, index) => ({ id: `${kind[0]}${index + 1}`, kind, index, text: text.trim(), origin: options.origin ?? ("user" as const), ref: options.ref ? options.ref(index) : `${REF_PREFIX[kind]}:${index}` }))
    .filter((s) => s.text.length > 0);

/* ---------------------------------------------------------------- */
/* Rattachement des questions du questionnaire                        */
/* ---------------------------------------------------------------- */

/** Questions de profil (sexe, âge, études…), reconnues par leur intitulé. */
const PROFILE = /\b(age|ages|tranche d.age|sexe|genre|niveau d.etudes?|etudes|instruction|scolarit|etat civil|statut matrimonial|situation matrimoniale|profession|occupation|anciennete|experience|commune|quartier|ville|province|lieu|localisation|residence|taille du menage|religion|nationalit|statut juridique|forme juridique|nombre d.employes)\b/;

const folded = (text: string) => fold(text).replace(/[’']/g, ".");

function vocabularyOf(card: VariableCard): { name: string[]; extra: string[][]; indicators: Array<{ label: string; tokens: string[] }> } {
  const known = KNOWLEDGE.find((k) => k.label === card.matchedAlias);
  const indicators = [...card.dimensions, ...(card.ai?.dimensions ?? [])].flatMap((d) => d.indicators.map((i) => ({ label: i.label, tokens: tokensOf(i.label) })));
  return {
    name: tokensOf(card.name),
    extra: [...(known?.aliases ?? []), ...card.dimensions.map((d) => d.name)].map(tokensOf).filter((t) => t.length),
    indicators,
  };
}

/* ---------------------------------------------------------------- */
/* Construction                                                      */
/* ---------------------------------------------------------------- */

export function buildChain(input: {
  research: ResearchUnderstandingInput;
  report: UnderstandingReport;
  structure?: FileStructure | null;
  cartography?: Cartography | null;
  questions?: InstrumentQuestion[];
  links?: QuestionLink[];
  decisions?: ChainDecisions;
}): ResearchChain {
  const { research, report } = input;
  const decisions = input.decisions ?? emptyChainDecisions();
  // Questions de recherche : questions spécifiques, ou à défaut la question principale.
  const questions = research.specificQuestions.length ? statementsOf("question", research.specificQuestions) : statementsOf("question", research.mainQuestion.trim() ? [research.mainQuestion] : [], { ref: () => "mainQuestion" });
  const objectives = research.specificObjectives.length ? statementsOf("objective", research.specificObjectives) : statementsOf("objective", research.generalObjective.trim() ? [research.generalObjective] : [], { ref: () => "generalObjective" });
  // Sans hypothèse saisie, ACADIA propose celles qu'il déduit des relations formulées (à valider).
  const hypotheses = research.hypotheses.length ? statementsOf("hypothesis", research.hypotheses) : statementsOf("hypothesis", report.candidateHypotheses.map((h) => h.text), { origin: "engine" });
  // Relations du moteur de compréhension citées par chaque énoncé.
  const relationsByRef = new Map<string, Set<string>>();
  for (const relation of report.relations) for (const source of relation.sources) relationsByRef.set(source.element, new Set([...(relationsByRef.get(source.element) ?? []), relation.id]));
  const relationsOf = (ref: string) => relationsByRef.get(ref) ?? new Set<string>();
  const statements = [...questions, ...objectives, ...hypotheses];
  const byId = (id: string | null | undefined) => (id ? statements.find((s) => s.id === id) : undefined);

  // Variables de la recherche : rôle VI / VD tiré des relations formulées.
  const cards = report.variables.filter((v) => v.status !== "rejected");
  const sideOf = (card: VariableCard): VariableSide | null => (card.role === "dependent" ? "dependent" : card.role === "explanatory" || card.role === "mediator" ? "independent" : null);
  const variables: ChainVariable[] = cards
    .map((card) => ({ card, side: sideOf(card) }))
    .filter((x): x is { card: VariableCard; side: VariableSide } => x.side !== null)
    .map(({ card, side }) => ({ key: card.key, name: card.name, side, suggestedIndicators: [...card.dimensions, ...(card.ai?.dimensions ?? [])].flatMap((d) => d.indicators.map((i) => i.label)).slice(0, 8) }));

  // 1. Appariement : ancrage sur les questions (ou les objectifs, ou les hypothèses).
  const anchor = questions.length ? questions : objectives.length ? objectives : hypotheses;
  const qToO = anchor === questions ? pair(questions, objectives, relationsOf) : new Map();
  const oToH = pair(objectives, hypotheses, relationsOf);
  const qToH = anchor === questions ? pair(questions, hypotheses, relationsOf) : new Map();
  const usedH = new Set<string>();
  const rows: ChainRow[] = anchor.map((a, i) => {
    const id = `row-${i + 1}`;
    const reasons: string[] = [];
    let questionId: string | null = null;
    let objectiveId: string | null = null;
    let hypothesisId: string | null = null;
    if (a.kind === "question") {
      questionId = a.id;
      const o = qToO.get(a.id);
      if (o) {
        objectiveId = o.id;
        reasons.push(`Question ${a.index + 1} ↔ objectif ${byId(o.id)!.index + 1} : ${o.reason}.`);
      }
    } else if (a.kind === "objective") objectiveId = a.id;
    else hypothesisId = a.id;
    if (!hypothesisId) {
      const h = (objectiveId ? oToH.get(objectiveId) : undefined) ?? (questionId ? qToH.get(questionId) : undefined);
      if (h && !usedH.has(h.id)) {
        hypothesisId = h.id;
        reasons.push(`${objectiveId ? `Objectif ${byId(objectiveId)!.index + 1}` : `Question ${a.index + 1}`} ↔ hypothèse ${byId(h.id)!.index + 1} : ${h.reason}.`);
      }
    }
    if (hypothesisId) usedH.add(hypothesisId);
    return { id, questionId, objectiveId, hypothesisId, independent: [], dependent: [], descriptive: false, confidence: "low" as const, reasons, status: "proposed" as const };
  });
  // Hypothèses restées sans ligne : une ligne chacune (le chercheur pourra les rattacher).
  for (const h of hypotheses.filter((x) => !usedH.has(x.id))) {
    const objective = oToH.size ? [...oToH.entries()].find(([, v]) => v.id === h.id)?.[0] ?? null : null;
    rows.push({ id: `row-${rows.length + 1}`, questionId: null, objectiveId: objective && !rows.some((r) => r.objectiveId === objective) ? objective : null, hypothesisId: h.id, independent: [], dependent: [], descriptive: false, confidence: "low", reasons: ["Hypothèse sans question de recherche correspondante : rattachez-la à une question ou à un objectif."], status: "proposed" });
  }

  // 2. Décisions de l'utilisateur, puis variables et confiance de chaque ligne.
  for (const row of rows) {
    const d = decisions.rows[row.id];
    if (d) {
      if (d.questionId !== undefined) row.questionId = d.questionId;
      if (d.objectiveId !== undefined) row.objectiveId = d.objectiveId;
      if (d.hypothesisId !== undefined) row.hypothesisId = d.hypothesisId;
      if (d.confirmed) row.status = "confirmed";
    }
    const objective = byId(row.objectiveId);
    row.descriptive = !row.hypothesisId && !!objective && DESCRIPTIVE_OBJECTIVE.test(objective.text);
    // Variables : celles de l'hypothèse ; à défaut, celles que citent l'objectif ou la question.
    const hypothesisPool = research.hypotheses.length ? report.hypotheses : report.candidateHypotheses;
    const hypothesis = row.hypothesisId ? hypothesisPool.find((h) => `h${h.index + 1}` === row.hypothesisId) : undefined;
    const fromHypothesis = hypothesis?.concepts ?? [];
    const cited = (s: ChainStatement | undefined) =>
      s ? cards.filter((c) => c.sources.some((src) => src.element === (s.kind === "question" ? `specificQuestion:${s.index}` : s.kind === "objective" ? `specificObjective:${s.index}` : `hypothesis:${s.index}`))).map((c) => c.key) : [];
    const keys = fromHypothesis.length ? fromHypothesis : [...new Set([...cited(objective), ...cited(byId(row.questionId))])];
    row.independent = keys.filter((k) => variables.find((v) => v.key === k)?.side === "independent");
    row.dependent = keys.filter((k) => variables.find((v) => v.key === k)?.side === "dependent");
    const linked = [row.questionId, row.objectiveId, row.hypothesisId].filter(Boolean).length;
    row.confidence = row.status === "confirmed" ? "high" : linked === 3 && row.reasons.every((r) => !r.includes("même rang")) ? "high" : linked >= 2 ? "medium" : "low";
    if (row.descriptive) row.reasons.push("Objectif descriptif : vérifié par la statistique descriptive, sans hypothèse à tester.");
    if (byId(row.hypothesisId)?.origin === "engine") row.reasons.push("Hypothèse proposée par ACADIA à partir de la relation que vous formulez : validez-la ou reformulez-la.");
    else if (row.hypothesisId && (!row.independent.length || !row.dependent.length)) row.reasons.push("Variables de l'hypothèse à préciser : ACADIA n'a pas reconnu clairement une VI et une VD.");
  }

  const issues: string[] = [];
  for (const o of objectives) if (!rows.some((r) => r.objectiveId === o.id)) issues.push(`Objectif ${o.index + 1} « ${o.text} » sans question de recherche correspondante.`);
  if (questions.length && objectives.length && questions.length !== objectives.length) issues.push(`${questions.length} question(s) de recherche pour ${objectives.length} objectif(s) : en principe, chaque question a son objectif.`);
  if (!variables.some((v) => v.side === "dependent") && hypotheses.length) issues.push("Aucune variable dépendante n'a été reconnue dans vos hypothèses : précisez ce que vous cherchez à expliquer.");

  return {
    problem: research.problem,
    statements,
    variables,
    rows,
    assignments: input.structure ? assignQuestions({ structure: input.structure, variables, cards, cartography: input.cartography ?? null, questions: input.questions ?? [], links: input.links ?? [], decisions }) : [],
    issues,
  };
}

function assignQuestions(input: {
  structure: FileStructure;
  variables: ChainVariable[];
  cards: VariableCard[];
  cartography: Cartography | null;
  questions: InstrumentQuestion[];
  links: QuestionLink[];
  decisions: ChainDecisions;
}): QuestionAssignment[] {
  const { structure, variables, cards, cartography, questions, links, decisions } = input;
  const units = structure.units.filter((u) => u.kind !== "technical");
  const questionOf = (unit: QuestionUnit) => {
    const link = links.find((l) => l.unitId === unit.id);
    return link ? questions.find((q) => q.id === link.questionId) : undefined;
  };
  const textOf = (unit: QuestionUnit) => `${unit.text} ${questionOf(unit)?.text ?? ""}`;
  const sectionOf = (unit: QuestionUnit) => tokensOf(questionOf(unit)?.section ?? "");
  const corpus = corpusOf(units.map(textOf));
  const vocab = new Map(variables.map((v) => [v.key, vocabularyOf(cards.find((c) => c.key === v.key)!)]));

  return units.map((unit) => {
    const text = unit.text;
    const decision = decisions.assignments[unit.id];
    if (decision) {
      const variable = variables.find((v) => v.key === decision.variableKey);
      return { unitId: unit.id, text, side: decision.side, variableKey: decision.variableKey, indicator: variable ? text : "—", score: 1, confidence: "high", reason: "Rattachement choisi par vous.", origin: "user", alternatives: [] };
    }
    const tokens = tokensOf(textOf(unit));
    // Question principale retenue pour un concept dans la cartographie : rattachement direct.
    const mapped = cartography?.concepts.find((c) => c.unitId === unit.id && variables.some((v) => v.key === c.conceptKey));
    let best: { key: string; score: number; indicator: string; reason: string } | null = mapped ? { key: mapped.conceptKey, score: 1, indicator: text, reason: `Question retenue pour « ${mapped.name} » à l'étape Variables.` } : null;
    const scores: Array<{ key: string; score: number }> = [];
    const section = sectionOf(unit);
    if (!best) {
      for (const variable of variables) {
        const v = vocab.get(variable.key)!;
        const byName = coverage(v.name, tokens, corpus).score;
        const byAlias = Math.max(0, ...v.extra.map((t) => coverage(t, tokens).score));
        let indicator: { label: string; score: number } | null = null;
        for (const i of v.indicators) {
          const s = coverage(i.tokens, tokens).score;
          if (s >= 0.5 && (!indicator || s > indicator.score)) indicator = { label: i.label, score: s };
        }
        // Section du questionnaire (« II. ACCÈS AU CRÉDIT ») qui porte le nom de la variable : indice supplémentaire.
        const bySection = section.length ? Math.max(coverage(v.name, section).score, ...v.extra.map((t) => coverage(t, section).score)) : 0;
        const score = Math.min(1, Math.max(byName, byAlias * 0.9, (indicator?.score ?? 0) * 0.8) + (bySection >= 0.6 ? 0.3 : 0));
        scores.push({ key: variable.key, score });
        if (score >= 0.45 && (!best || score > best.score)) {
          const why = byName >= byAlias * 0.9 && byName >= (indicator?.score ?? 0) * 0.8 ? `l'intitulé reprend « ${variable.name} »` : indicator && (indicator.score * 0.8 >= byAlias * 0.9) ? `elle mesure l'indicateur « ${indicator.label} »` : `l'intitulé emploie un synonyme de « ${variable.name} »`;
          best = { key: variable.key, score, indicator: indicator?.label ?? text, reason: `Rattachée à « ${variable.name} » : ${bySection >= 0.6 ? "elle figure dans la section du questionnaire consacrée à cette variable" : why}.` };
        }
      }
    }
    if (best) {
      const chosen = best;
      const variable = variables.find((v) => v.key === chosen.key)!;
      const rivals = scores.filter((s) => s.key !== chosen.key && s.score >= chosen.score - 0.1 && s.score >= 0.45).map((s) => s.key);
      return {
        unitId: unit.id,
        text,
        side: variable.side,
        variableKey: variable.key,
        indicator: chosen.indicator,
        score: chosen.score,
        confidence: rivals.length ? "low" : chosen.score >= 0.75 ? "high" : chosen.score >= 0.55 ? "medium" : "low",
        reason: rivals.length ? `${chosen.reason} À trancher : elle pourrait aussi mesurer ${rivals.map((k) => `« ${variables.find((v) => v.key === k)!.name} »`).join(", ")}.` : chosen.reason,
        origin: "engine",
        alternatives: rivals,
      };
    }
    if (PROFILE.test(folded(text))) return { unitId: unit.id, text, side: "profile", variableKey: null, indicator: "—", score: 0, confidence: "medium", reason: "Question de profil (caractéristiques des répondants) : elle décrit l'échantillon.", origin: "engine", alternatives: [] };
    return { unitId: unit.id, text, side: "other", variableKey: null, indicator: "—", score: 0, confidence: "low", reason: "Aucun lien reconnu avec les variables de la recherche : elle sera décrite, sans entrer dans les tests.", origin: "engine", alternatives: [] };
  });
}

/** Questions (unités) qui mesurent une variable donnée. */
export const unitsOfVariable = (chain: ResearchChain, key: string) => chain.assignments.filter((a) => a.variableKey === key).map((a) => a.unitId);

export const statementOf = (chain: ResearchChain, id: string | null | undefined) => (id ? chain.statements.find((s) => s.id === id) ?? null : null);
