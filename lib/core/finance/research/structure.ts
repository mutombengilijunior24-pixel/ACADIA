/**
 * Structure financière du sujet : pour chaque lien de la chaîne (question → objectif → hypothèse),
 * les concepts mesurés (variable explicative, variable expliquée, ou concept décrit) et les indicateurs
 * proposés pour chacun. L'étudiant valide ou modifie le choix des indicateurs.
 */
import { hashKey } from "@/lib/core/understanding/text";
import type { ResearchChain } from "@/lib/core/chain";

import { INDICATOR_BY_ID } from "../indicators/catalogue";
import { conceptsOf, FINANCE_CONCEPT_BY_ID, type FinanceConcept } from "./concepts";

export interface LinkStructure {
  rowId: string;
  index: number;
  /** Énoncé qui porte la vérification (hypothèse, sinon objectif, sinon question). */
  statement: string;
  statementKind: "hypothesis" | "objective" | "question";
  question: string | null;
  objective: string | null;
  hypothesis: string | null;
  /** Variable explicative (VI) et variable expliquée (VD), ou concept décrit (objectif descriptif). */
  independent: FinanceConcept | null;
  dependent: FinanceConcept | null;
  described: FinanceConcept[];
}

export interface IndicatorTarget {
  /** « concept:<id> » : un même concept garde les mêmes indicateurs dans toute l'étude. */
  key: string;
  concept: FinanceConcept;
  proposed: string[];
}

export type IndicatorChoices = Record<string, string[]>;

/** Orientation usuelle (cause → effet) de deux concepts, pour lire « A dépend de B » dans le bon sens. */
const CAUSES = new Set(["endettement", "effet_levier", "credit_bancaire", "credit_clients", "stocks", "bfr", "autofinancement", "investissement", "frais_financiers", "dividendes", "croissance", "credit_fournisseurs", "charges_personnel", "fiscalite"]);
const EFFECTS = new Set(["rentabilite_financiere", "rentabilite", "rentabilite_economique", "performance_financiere", "tresorerie", "liquidite", "solvabilite", "risque_faillite", "marge_nette", "situation_financiere", "equilibre_financier"]);

const statementText = (chain: ResearchChain, id: string | null) => (id ? (chain.statements.find((s) => s.id === id)?.text ?? null) : null);

export function linkStructures(chain: ResearchChain, fallbackSubject: string): LinkStructure[] {
  const variableName = (key: string) => chain.variables.find((v) => v.key === key)?.name ?? "";
  const links: LinkStructure[] = chain.rows.map((row, index) => {
    const question = statementText(chain, row.questionId);
    const objective = statementText(chain, row.objectiveId);
    const hypothesis = statementText(chain, row.hypothesisId);
    const statement = hypothesis ?? objective ?? question ?? "";
    const statementKind = hypothesis ? "hypothesis" : objective ? "objective" : "question";
    // 1. Les concepts financiers de l'énoncé lui-même, orientés cause → effet.
    const concepts = conceptsOf(statement);
    let independent: FinanceConcept | null = null;
    let dependent: FinanceConcept | null = null;
    if (concepts.length >= 2) {
      const [a, b] = concepts;
      const reversed = EFFECTS.has(a.id) && CAUSES.has(b.id) && !(CAUSES.has(a.id) && EFFECTS.has(b.id));
      independent = reversed ? b : a;
      dependent = reversed ? a : b;
    } else {
      // 2. À défaut, les variables reconnues par la chaîne, si elles correspondent à des concepts financiers.
      const vi = row.independent.map(variableName).flatMap(conceptsOf)[0] ?? null;
      const vd = row.dependent.map(variableName).flatMap(conceptsOf)[0] ?? null;
      if (vi && vd && vi.id !== vd.id && concepts.some((c) => c.id === vi.id || c.id === vd.id)) {
        independent = vi;
        dependent = vd;
      }
    }
    const descriptive = !independent || !dependent;
    const described = descriptive ? (concepts.length ? concepts : conceptsOf(`${objective ?? ""} ${question ?? ""}`)) : [];
    return { rowId: row.id, index, statement, statementKind, question, objective, hypothesis, independent: descriptive ? null : independent, dependent: descriptive ? null : dependent, described };
  });
  if (!links.length && fallbackSubject.trim()) {
    links.push({ rowId: "sujet", index: 0, statement: fallbackSubject, statementKind: "question", question: fallbackSubject, objective: null, hypothesis: null, independent: null, dependent: null, described: conceptsOf(fallbackSubject) });
  }
  return links;
}

export function indicatorTargets(links: LinkStructure[]): IndicatorTarget[] {
  const concepts = new Map<string, FinanceConcept>();
  for (const link of links) for (const c of [link.independent, link.dependent, ...link.described]) if (c) concepts.set(c.id, c);
  return [...concepts.values()].map((concept) => ({ key: `concept:${concept.id}`, concept, proposed: concept.indicators.filter((id) => INDICATOR_BY_ID[id]).slice(0, 4) }));
}

/** Indicateurs retenus : choix de l'étudiant, sinon proposition d'ACADIA. */
export const chosenIndicators = (target: IndicatorTarget, choices: IndicatorChoices) => (choices[target.key] ?? target.proposed).filter((id) => INDICATOR_BY_ID[id]);

export const indicatorsKey = (targets: IndicatorTarget[], choices: IndicatorChoices) => hashKey(targets.map((t) => [t.key, chosenIndicators(t, choices)]));

export const conceptById = (id: string) => FINANCE_CONCEPT_BY_ID[id];
