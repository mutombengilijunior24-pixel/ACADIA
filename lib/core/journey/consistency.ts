/**
 * Logique de passage et cohérence des réponses.
 *
 * 1. Les CONDITIONS DE PASSAGE sont représentées explicitement (SkipRule) : « la question B s'applique
 *    quand la réponse à A appartient à {…} ». Elles viennent :
 *    - de l'instrument fourni (consignes de saut « Non → passez à la question 8 », « Si oui : ») : confirmées ;
 *    - de la formulation des intitulés (« Si oui… », « Si autre, précisez… », « Si votre crédit a été
 *      refusé… ») : seulement PROPOSÉES — elles ne servent à rien tant que l'utilisateur ne les confirme pas.
 *    Aucune règle n'est inventée sans appui dans l'instrument ou dans l'intitulé.
 * 2. Les CONTRÔLES DE COHÉRENCE sont un catalogue de règles explicites, testables une à une. Chaque
 *    signal indique la règle, les questions en cause, la nature du problème, sa gravité, la justification
 *    et l'action recommandée. Aucune réponse n'est jamais modifiée.
 */
import { interpretCell } from "@/lib/core/data/cells";
import { addOperation, missingCodesByColumn, preparedColumn } from "@/lib/core/data/preparation";
import type { ImportedDataset, PreparationState } from "@/lib/core/data/types";
import { fold } from "@/lib/core/understanding/text";

import type { InstrumentQuestion, QuestionLink } from "./instrument";
import { coverage, tokenSimilarity, tokensOf } from "./match";
import type { FileStructure, QuestionUnit } from "./structure";

const NOT_APPLICABLE = /^(non[- ]?concern[ée]e?s?|pas concern[ée]e?s?|sans objet|ne s['’]applique pas|non applicable)$/i;
const CONDITIONAL_HEADER = /^\s*(?:(?:q(?:uestion)?\s*)?\d+[.)°:-]?\s*)?(si |lorsque |lorsqu['’]|en cas |dans le cas |pour ceux |pour celles )/i;
const YES = new Set(["oui", "yes", "vrai", "true", "1"]);
const NO = new Set(["non", "no", "faux", "false", "0"]);
const clean = (label: string) => fold(label).replace(/^[^a-z0-9]+/, "").trim();

export const isNotApplicable = (label: string) => NOT_APPLICABLE.test(label.trim());

interface CellLabel {
  label: string | null;
  sourceRow: number;
}

function labelsOf(dataset: ImportedDataset, preparation: PreparationState, column: number): CellLabel[] {
  const prepared = preparedColumn(dataset, preparation, column);
  return prepared.values.map((raw, i) => {
    const cell = interpretCell(raw);
    return { label: cell.kind === "missing" || cell.kind === "empty_string" || cell.kind === "whitespace" ? null : cell.label.trim(), sourceRow: prepared.sourceRows[i] };
  });
}

/* ================================================================= */
/* Conditions de passage                                               */
/* ================================================================= */

export interface SkipRule {
  id: string;
  /** Colonne de la question conditionnelle. */
  target: number;
  targetHeader: string;
  /** La question s'applique quand la colonne `when.column` vaut l'une des valeurs `when.values`. */
  when: { column: number; header: string; values: string[] };
  /** Toutes les modalités observées de la question filtre (pour que l'utilisateur corrige `when.values`). */
  options: string[];
  source: "instrument" | "intitulé";
  status: "confirmed" | "proposed";
  rationale: string;
}

export type SkipDecisions = Record<string, "confirmed" | "rejected">;

export function inferSkipRules(input: { dataset: ImportedDataset; preparation: PreparationState; structure: FileStructure; questions?: InstrumentQuestion[]; links?: QuestionLink[] }): SkipRule[] {
  const { dataset, preparation, structure } = input;
  const units = structure.units.filter((u) => u.kind !== "technical" && u.primaryColumn !== null).sort((a, b) => a.primaryColumn! - b.primaryColumn!);
  const valuesOf = (unit: QuestionUnit) => [...new Set(labelsOf(dataset, preparation, unit.primaryColumn!).map((l) => l.label).filter((l): l is string => !!l))];
  const rules: SkipRule[] = [];
  const add = (rule: Omit<SkipRule, "id" | "options">) => {
    const id = `skip-${rule.target}-${rule.when.column}`;
    const trigger = units.find((u) => u.primaryColumn === rule.when.column);
    if (!rules.some((r) => r.id === id)) rules.push({ ...rule, id, options: trigger ? valuesOf(trigger) : rule.when.values });
  };

  // 1. Consignes de saut de l'instrument fourni (règles explicites, donc confirmées).
  const questions = input.questions ?? [];
  const columnOfQuestion = (q: InstrumentQuestion) => {
    const unitId = input.links?.find((l) => l.questionId === q.id)?.unitId;
    return units.find((u) => u.id === unitId);
  };
  questions.forEach((q, index) => {
    const trigger = columnOfQuestion(q);
    if (!trigger) return;
    for (const jump of q.jumps) {
      if (q.number === null) continue;
      const skipped = questions.filter((x) => x.number !== null && x.number > q.number! && x.number < jump.to);
      const remaining = valuesOf(trigger).filter((v) => clean(v) !== clean(jump.option));
      for (const target of skipped.map(columnOfQuestion).filter((u): u is QuestionUnit => !!u)) {
        add({ target: target.primaryColumn!, targetHeader: target.text, when: { column: trigger.primaryColumn!, header: trigger.text, values: remaining }, source: "instrument", status: "confirmed", rationale: `Consigne de l'instrument : « ${jump.option} → question ${jump.to} » (question ${q.number}).` });
      }
    }
    if (q.appliesIfPrevious && index > 0) {
      const previous = columnOfQuestion(questions[index - 1]);
      const target = columnOfQuestion(q);
      if (previous && target) {
        const set = q.appliesIfPrevious === "yes" ? YES : NO;
        add({ target: target.primaryColumn!, targetHeader: target.text, when: { column: previous.primaryColumn!, header: previous.text, values: valuesOf(previous).filter((v) => set.has(clean(v))) }, source: "instrument", status: "confirmed", rationale: `Consigne de l'instrument : « Si ${q.appliesIfPrevious === "yes" ? "oui" : "non"} » renvoie à la question précédente.` });
      }
    }
  });

  // 2. Formulation des intitulés (règles seulement proposées : à confirmer par l'utilisateur).
  units.forEach((unit, index) => {
    const header = unit.text;
    const before = units.slice(0, index).reverse();
    const yesNo = /^\s*(?:(?:q(?:uestion)?\s*)?\d+[.)°:-]?\s*)?si\s+(oui|non)\b/i.exec(header);
    if (yesNo) {
      const set = fold(yesNo[1]) === "oui" ? YES : NO;
      const trigger = before.find((u) => {
        const values = valuesOf(u).map(clean);
        return values.length >= 2 && values.every((v) => YES.has(v) || NO.has(v));
      });
      if (trigger) add({ target: unit.primaryColumn!, targetHeader: header, when: { column: trigger.primaryColumn!, header: trigger.text, values: valuesOf(trigger).filter((v) => set.has(clean(v))) }, source: "intitulé", status: "proposed", rationale: `L'intitulé commence par « Si ${yesNo[1]} » : il renvoie vraisemblablement à la question oui/non précédente, « ${trigger.text} ».` });
      return;
    }
    if (/^\s*(?:(?:q(?:uestion)?\s*)?\d+[.)°:-]?\s*)?(si autre|autre.*pr[ée]cis|pr[ée]cisez)/i.test(header)) {
      const trigger = before.find((u) => valuesOf(u).some((v) => /^autre/.test(clean(v))));
      if (trigger) add({ target: unit.primaryColumn!, targetHeader: header, when: { column: trigger.primaryColumn!, header: trigger.text, values: valuesOf(trigger).filter((v) => /^autre/.test(clean(v))) }, source: "intitulé", status: "proposed", rationale: `L'intitulé demande de préciser une réponse « Autre » : il dépend vraisemblablement de « ${trigger.text} ».` });
      return;
    }
    if (CONDITIONAL_HEADER.test(header)) {
      const condition = header.replace(CONDITIONAL_HEADER, "").split(/[,?]/)[0] ?? "";
      const conditionTokens = tokensOf(condition);
      // Modalités discriminantes : elles partagent un mot de la condition, sans que toutes le partagent.
      // Une question elle-même conditionnelle n'est retenue comme filtre qu'en dernier recours.
      const candidates = [...before.filter((u) => !CONDITIONAL_HEADER.test(u.text)), ...before.filter((u) => CONDITIONAL_HEADER.test(u.text))];
      for (const trigger of candidates) {
        const values = valuesOf(trigger);
        if (values.length < 2) continue;
        // Les mots présents dans la plupart des modalités (« Crédit » dans « Crédit obtenu » / « Crédit refusé ») ne discriminent rien.
        const shared = (t: string) => values.filter((v) => tokensOf(v).includes(t)).length > values.length / 2;
        const eligible = values.filter((v) => tokensOf(v).some((t) => !shared(t) && conditionTokens.some((c) => tokenSimilarity(t, c) >= 0.85)));
        if (!eligible.length || eligible.length === values.length) continue;
        add({ target: unit.primaryColumn!, targetHeader: header, when: { column: trigger.primaryColumn!, header: trigger.text, values: eligible }, source: "intitulé", status: "proposed", rationale: `La condition « ${condition.trim()} » correspond aux réponses ${eligible.map((e) => `« ${e} »`).join(", ")} de « ${trigger.text} ». D'autres modalités (par exemple une réponse partielle) peuvent aussi être visées : à vérifier.` });
        break;
      }
    }
  });
  return rules;
}

/**
 * Règles effectives après décisions de l'utilisateur : une règle proposée et confirmée devient confirmée ;
 * `values` remplace, si l'utilisateur l'a corrigée, la liste des réponses filtres qui rendent la question applicable.
 */
export function effectiveSkipRules(rules: SkipRule[], decisions: SkipDecisions, values: Record<string, string[]> = {}): SkipRule[] {
  return rules
    .filter((r) => decisions[r.id] !== "rejected")
    .map((r) => {
      const when = values[r.id] ? { ...r.when, values: r.options.filter((o) => values[r.id].includes(o)) } : r.when;
      return { ...r, when, status: decisions[r.id] === "confirmed" ? ("confirmed" as const) : r.status };
    });
}

/* ================================================================= */
/* Questions conditionnelles et dénominateurs                          */
/* ================================================================= */

export interface ConditionalQuestion {
  column: number;
  header: string;
  /** Condition formulée dans l'intitulé, si elle existe. */
  condition: string | null;
  /** Règle de passage connue (confirmée ou proposée). */
  rule: SkipRule | null;
  notApplicableValues: string[];
  notApplicableCount: number;
  eligibleCount: number;
  blankCount: number;
  detectedBy: string;
}

export function detectConditionalQuestions(dataset: ImportedDataset, preparation: PreparationState, structure: FileStructure, rules: SkipRule[] = []): ConditionalQuestion[] {
  const result: ConditionalQuestion[] = [];
  for (const unit of structure.units) {
    if (unit.kind === "technical" || unit.primaryColumn === null) continue;
    const column = unit.primaryColumn;
    const header = unit.text;
    const byHeader = CONDITIONAL_HEADER.test(header);
    const rule = rules.find((r) => r.target === column && r.status === "confirmed") ?? rules.find((r) => r.target === column) ?? null;
    const labels = labelsOf(dataset, preparation, column);
    const notApplicable = [...new Set(labels.map((l) => l.label).filter((l): l is string => !!l && isNotApplicable(l)))];
    if (!byHeader && !notApplicable.length && !rule) continue;
    const sources = [byHeader ? "intitulé" : "", notApplicable.length ? "réponses" : "", rule ? (rule.source === "instrument" ? "consigne de l'instrument" : "règle de passage proposée") : ""].filter(Boolean);
    result.push({
      column,
      header,
      condition: byHeader ? header.replace(CONDITIONAL_HEADER, "").split(/[,?]/)[0]?.trim() || null : null,
      rule,
      notApplicableValues: notApplicable,
      notApplicableCount: labels.filter((l) => l.label && notApplicable.includes(l.label)).length,
      eligibleCount: labels.filter((l) => l.label && !notApplicable.includes(l.label)).length,
      blankCount: labels.filter((l) => !l.label).length,
      detectedBy: sources.join(" et "),
    });
  }
  return result;
}

/**
 * Préparation utilisée pour les calculs : les réponses structurelles (« Non concernée ») des questions
 * conditionnelles retenues sont exclues du dénominateur, en mémoire, de façon réversible, sans toucher
 * aux valeurs brutes ni aux décisions enregistrées par l'utilisateur.
 */
export function structuralPreparation(preparation: PreparationState, structural: Record<number, string[]>): PreparationState {
  let result = preparation;
  const existing = missingCodesByColumn(preparation);
  for (const [column, values] of Object.entries(structural)) {
    if (!values.length) continue;
    const codes = [...new Set([...(existing.get(Number(column)) ?? []), ...values])];
    result = addOperation(result, { type: "declare_missing_codes", column: Number(column), values: codes }, new Date(0));
  }
  return result;
}

/* ================================================================= */
/* Contrôles de cohérence : catalogue de règles                        */
/* ================================================================= */

export type ConsistencyCategory = "logical_contradiction" | "apparent_tension" | "skip_violation" | "abnormal_missing" | "multi_answer_inconsistency" | "unusual";
export type ConsistencySeverity = "high" | "medium" | "low";

export const CONSISTENCY_LABELS: Record<ConsistencyCategory, string> = {
  logical_contradiction: "Contradiction logique forte",
  apparent_tension: "Tension apparente à clarifier",
  skip_violation: "Réponse incompatible avec une condition de passage",
  abnormal_missing: "Valeur manquante inattendue",
  multi_answer_inconsistency: "Incohérence entre plusieurs réponses",
  unusual: "Situation inhabituelle (sans blocage)",
};

export const SEVERITY_LABELS: Record<ConsistencySeverity, string> = { high: "élevée", medium: "moyenne", low: "faible" };

export interface ConsistencyIssue {
  id: string;
  /** Règle déclenchée. */
  rule: string;
  ruleLabel: string;
  category: ConsistencyCategory;
  severity: ConsistencySeverity;
  /** Questions (colonnes) en cause. */
  elements: Array<{ column: number; header: string }>;
  problem: string;
  justification: string;
  action: string;
  /** Numéros de ligne du fichier concernés. */
  sourceRows: number[];
}

export interface RuleContext {
  dataset: ImportedDataset;
  preparation: PreparationState;
  structure: FileStructure;
  units: QuestionUnit[];
  labels: (column: number) => CellLabel[];
  rules: SkipRule[];
}

export interface ConsistencyRule {
  id: string;
  label: string;
  description: string;
  run: (ctx: RuleContext) => ConsistencyIssue[];
}

const rowsText = (rows: number[]) => `lignes ${rows.slice(0, 20).join(", ")}${rows.length > 20 ? "…" : ""}`;
const element = (ctx: RuleContext, column: number) => ({ column, header: ctx.units.find((u) => u.primaryColumn === column)?.text ?? ctx.structure.columns.find((c) => c.column === column)?.label ?? String(column) });

/** Choix unique exporté deux fois (texte + colonnes vrai/faux) : les deux encodages doivent concorder. */
const oneHotRule: ConsistencyRule = {
  id: "choix-unique-colonnes",
  label: "Concordance entre une question et ses colonnes vrai/faux",
  description: "Pour une question à choix unique exportée aussi en colonnes vrai/faux, la modalité cochée doit être celle de la réponse texte, et une seule.",
  run: (ctx) => {
    const issues: ConsistencyIssue[] = [];
    for (const unit of ctx.structure.units.filter((u) => u.kind === "single_with_options" && u.primaryColumn !== null)) {
      const parent = ctx.labels(unit.primaryColumn!);
      const optionColumns = ctx.structure.columns.filter((c) => c.kind === "option_of" && c.unitId === unit.id);
      const options = optionColumns.map((c) => ({ option: c.option ?? "", values: ctx.labels(c.column) }));
      const contradictions: number[] = [];
      const multiple: number[] = [];
      parent.forEach((cell, i) => {
        const checked = options.filter((o) => YES.has(clean(o.values[i]?.label ?? ""))).map((o) => o.option);
        if (checked.length > 1) multiple.push(cell.sourceRow);
        if (!cell.label) return;
        const own = options.find((o) => clean(o.option) === clean(cell.label!));
        if (own && !YES.has(clean(own.values[i]?.label ?? "")) && checked.length > 0) contradictions.push(cell.sourceRow);
      });
      if (contradictions.length) {
        issues.push({
          id: `onehot-${unit.primaryColumn}`,
          rule: oneHotRule.id,
          ruleLabel: oneHotRule.label,
          category: "logical_contradiction",
          severity: "high",
          elements: [element(ctx, unit.primaryColumn!), ...optionColumns.map((c) => ({ column: c.column, header: c.label }))],
          problem: `${contradictions.length} réponse(s) à « ${unit.text} » indiquent une modalité alors que la colonne vrai/faux correspondante coche une autre modalité (${rowsText(contradictions)}).`,
          justification: "Les deux colonnes encodent la même réponse : elles ne peuvent pas désigner deux modalités différentes. Il s'agit d'une erreur d'export ou de saisie.",
          action: "Vérifier la réponse d'origine dans l'outil de collecte ; l'analyse utilise la colonne texte de la question.",
          sourceRows: contradictions,
        });
      }
      if (multiple.length) {
        issues.push({
          id: `onehot-multi-${unit.primaryColumn}`,
          rule: oneHotRule.id,
          ruleLabel: oneHotRule.label,
          category: "multi_answer_inconsistency",
          severity: "medium",
          elements: [element(ctx, unit.primaryColumn!)],
          problem: `${multiple.length} répondant(s) ont plusieurs modalités cochées pour « ${unit.text} », présentée comme une question à choix unique (${rowsText(multiple)}).`,
          justification: "Une question à choix unique n'admet qu'une modalité ; plusieurs coches indiquent une question en réalité à choix multiples, ou une erreur de saisie.",
          action: "Confirmer la nature de la question (choix unique ou multiple) avant de l'analyser.",
          sourceRows: multiple,
        });
      }
    }
    return issues;
  },
};

/** « Dispose de X = oui » et réponse « manque de X » ailleurs : tension, PAS une contradiction. */
const NEGATED = /^(?:manque|absence|insuffisance|defaut|pas|aucune?)\s+(?:de\s+|d['’]\s*|du\s+|des\s+)?(.+)$/i;
const negatedRule: ConsistencyRule = {
  id: "possession-manque",
  label: "Possession déclarée et manque invoqué",
  description: "Une personne déclare disposer d'un élément et invoque ailleurs son manque ou son insuffisance.",
  run: (ctx) => {
    const issues: ConsistencyIssue[] = [];
    const yesNo = ctx.units.filter((u) => {
      const values = new Set(ctx.labels(u.primaryColumn!).map((l) => (l.label ? clean(l.label) : null)).filter((v): v is string => !!v));
      return values.size > 0 && [...values].every((v) => YES.has(v) || NO.has(v));
    });
    for (const other of ctx.units) {
      const labels = ctx.labels(other.primaryColumn!);
      for (const value of new Set(labels.map((l) => l.label).filter((l): l is string => !!l))) {
        const m = NEGATED.exec(fold(value));
        if (!m) continue;
        for (const owner of yesNo) {
          if (owner.primaryColumn === other.primaryColumn || coverage(tokensOf(m[1]), tokensOf(owner.text)).score < 0.6) continue;
          const ownerLabels = ctx.labels(owner.primaryColumn!);
          const rows = labels.filter((l, i) => l.label === value && ownerLabels[i]?.label && YES.has(clean(ownerLabels[i].label!))).map((l) => l.sourceRow);
          if (!rows.length) continue;
          issues.push({
            id: `negated-${owner.primaryColumn}-${other.primaryColumn}-${fold(value)}`,
            rule: negatedRule.id,
            ruleLabel: negatedRule.label,
            category: "apparent_tension",
            severity: "medium",
            elements: [element(ctx, owner.primaryColumn!), element(ctx, other.primaryColumn!)],
            problem: `« ${owner.text} » = oui, mais « ${other.text} » = « ${value} » pour ${rows.length} répondant(s) (${rowsText(rows)}).`,
            justification: "Ce n'est pas forcément une contradiction : disposer d'une garantie (ou d'un autre élément) ne signifie pas qu'elle a été acceptée, jugée suffisante ou adaptée par le prêteur. Sans information complémentaire, le cas ne peut pas être déclaré impossible.",
            action: "Clarifier auprès des répondants ou dans les consignes de collecte ; préciser la formulation lors d'une prochaine enquête. Les réponses ne sont pas modifiées.",
            sourceRows: rows,
          });
        }
      }
    }
    return issues;
  },
};

/** Conditions de passage CONFIRMÉES : réponses hors condition, « non concernée » à tort, absences anormales. */
const skipRule: ConsistencyRule = {
  id: "condition-de-passage",
  label: "Respect des conditions de passage",
  description: "Une question conditionnelle ne devrait être renseignée que lorsque sa condition est remplie, et l'être dans ce cas.",
  run: (ctx) => {
    const issues: ConsistencyIssue[] = [];
    for (const rule of ctx.rules.filter((r) => r.status === "confirmed")) {
      const trigger = ctx.labels(rule.when.column);
      const target = ctx.labels(rule.target);
      const applies = (i: number) => !!trigger[i]?.label && rule.when.values.includes(trigger[i].label!);
      const outside: number[] = [];
      const naWhenApplies: number[] = [];
      const blankWhenApplies: number[] = [];
      target.forEach((cell, i) => {
        if (!trigger[i]?.label) return;
        if (applies(i)) {
          if (!cell.label) blankWhenApplies.push(cell.sourceRow);
          else if (isNotApplicable(cell.label)) naWhenApplies.push(cell.sourceRow);
        } else if (cell.label && !isNotApplicable(cell.label)) outside.push(cell.sourceRow);
      });
      const severity: ConsistencySeverity = rule.source === "instrument" ? "high" : "medium";
      const condition = `« ${rule.when.header} » ∈ {${rule.when.values.map((v) => `« ${v} »`).join(", ")}}`;
      const els = [element(ctx, rule.when.column), element(ctx, rule.target)];
      if (outside.length) {
        issues.push({ id: `skip-outside-${rule.id}`, rule: skipRule.id, ruleLabel: skipRule.label, category: "skip_violation", severity, elements: els, problem: `${outside.length} réponse(s) à « ${rule.targetHeader} » alors que la condition ${condition} n'est pas remplie (${rowsText(outside)}).`, justification: `Selon la règle de passage (${rule.rationale}), ces répondants n'auraient pas dû voir cette question.`, action: "Vérifier ces réponses et la règle de passage ; elles ne sont pas modifiées.", sourceRows: outside });
      }
      if (naWhenApplies.length) {
        issues.push({ id: `skip-na-${rule.id}`, rule: skipRule.id, ruleLabel: skipRule.label, category: "skip_violation", severity: "medium", elements: els, problem: `${naWhenApplies.length} réponse(s) « non concernée » à « ${rule.targetHeader} » alors que la condition ${condition} est remplie (${rowsText(naWhenApplies)}).`, justification: "La question s'appliquait à ces répondants : « non concernée » contredit la réponse à la question filtre.", action: "Vérifier la réponse à la question filtre ou à la question conditionnelle.", sourceRows: naWhenApplies });
      }
      if (blankWhenApplies.length) {
        issues.push({ id: `skip-missing-${rule.id}`, rule: skipRule.id, ruleLabel: skipRule.label, category: "abnormal_missing", severity: "medium", elements: els, problem: `${blankWhenApplies.length} absence(s) de réponse à « ${rule.targetHeader} » alors que la condition ${condition} est remplie (${rowsText(blankWhenApplies)}).`, justification: "Ces répondants étaient concernés : l'absence de réponse n'est pas structurelle, c'est une non-réponse.", action: "Laisser ces cas en non-réponse (jamais remplacés) et en tenir compte dans l'interprétation.", sourceRows: blankWhenApplies });
      }
    }
    return issues;
  },
};

/** Absence isolée dans une question presque toujours renseignée (hors questions conditionnelles). */
const isolatedMissingRule: ConsistencyRule = {
  id: "absence-isolee",
  label: "Absence isolée de réponse",
  description: "Quelques réponses manquent dans une question renseignée par tous les autres répondants.",
  run: (ctx) =>
    ctx.units
      .filter((u) => !CONDITIONAL_HEADER.test(u.text) && !ctx.rules.some((r) => r.target === u.primaryColumn))
      .flatMap((u) => {
        const labels = ctx.labels(u.primaryColumn!);
        const blank = labels.filter((l) => !l.label).map((l) => l.sourceRow);
        if (!blank.length || labels.length < 20 || blank.length > Math.max(2, labels.length * 0.05)) return [];
        return [{ id: `isolated-${u.primaryColumn}`, rule: "absence-isolee", ruleLabel: "Absence isolée de réponse", category: "abnormal_missing" as const, severity: "low" as const, elements: [element(ctx, u.primaryColumn!)], problem: `${blank.length} réponse(s) manquante(s) à « ${u.text} », renseignée par tous les autres répondants (${rowsText(blank)}).`, justification: "Une absence isolée peut être un oubli de saisie ; elle n'est jamais remplacée.", action: "Vérifier la saisie si possible ; sinon l'analyse exclut ces lignes pour cette question.", sourceRows: blank }];
      }),
};

/** Modalité choisie par une seule personne dans un échantillon important : à signaler, sans blocage. */
const rareRule: ConsistencyRule = {
  id: "modalite-rare",
  label: "Modalité très rare",
  description: "Une modalité n'est choisie que par une seule personne alors que l'échantillon est important.",
  run: (ctx) =>
    ctx.units
      .filter((u) => u.kind === "single" || u.kind === "single_with_options")
      .flatMap((u) => {
        const labels = ctx.labels(u.primaryColumn!).filter((l) => l.label);
        if (labels.length < 30) return [];
        const counts = new Map<string, number[]>();
        for (const l of labels) counts.set(l.label!, [...(counts.get(l.label!) ?? []), l.sourceRow]);
        if (counts.size < 3 || counts.size > 12) return [];
        return [...counts.entries()]
          .filter(([, rows]) => rows.length === 1)
          .map(([value, rows]) => ({ id: `rare-${u.primaryColumn}-${fold(value)}`, rule: "modalite-rare", ruleLabel: "Modalité très rare", category: "unusual" as const, severity: "low" as const, elements: [element(ctx, u.primaryColumn!)], problem: `« ${value} » n'est choisie qu'une fois pour « ${u.text} » (${rowsText(rows)}).`, justification: "Une réponse rare n'est pas une erreur ; elle peut cependant rendre un tableau croisé peu fiable (effectifs attendus faibles).", action: "Aucune correction ; envisager de regrouper cette modalité avant un test si cela a un sens.", sourceRows: rows }));
      }),
};

export const CONSISTENCY_RULES: ConsistencyRule[] = [oneHotRule, negatedRule, skipRule, isolatedMissingRule, rareRule];

export function checkConsistency(dataset: ImportedDataset, preparation: PreparationState, structure: FileStructure, rules: SkipRule[] = [], catalogue: ConsistencyRule[] = CONSISTENCY_RULES): ConsistencyIssue[] {
  const cache = new Map<number, CellLabel[]>();
  const ctx: RuleContext = {
    dataset,
    preparation,
    structure,
    units: structure.units.filter((u) => u.kind !== "technical" && u.primaryColumn !== null),
    labels: (column) => {
      if (!cache.has(column)) cache.set(column, labelsOf(dataset, preparation, column));
      return cache.get(column)!;
    },
    rules,
  };
  const order: Record<ConsistencySeverity, number> = { high: 0, medium: 1, low: 2 };
  return catalogue.flatMap((rule) => rule.run(ctx)).sort((a, b) => order[a.severity] - order[b.severity]);
}
