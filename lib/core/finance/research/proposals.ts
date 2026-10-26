/**
 * Propositions d'ACADIA pour un sujet de gestion financière : questions, objectifs et hypothèses
 * formulés à partir des concepts repérés dans le sujet. Ce sont des PROPOSITIONS, ajoutées au
 * formulaire seulement si l'étudiant le décide.
 */
import { fold } from "@/lib/core/understanding/text";

import { conceptsOf, type FinanceConcept } from "./concepts";

export interface ResearchProposal {
  kind: "question" | "objective" | "hypothesis";
  text: string;
  /** Concepts à l'origine de la proposition. */
  from: string[];
}

interface Context {
  /** Nom de l'entreprise (sans la mention « entreprise fictive »). */
  company: string;
  /** Première et dernière années analysées. */
  from: string;
  to: string;
}

type Rule = { cause: string[]; effect: string[]; question: string; objective: string; hypothesis: string };

/** Paires (variable explicative → variable expliquée) usuelles en gestion financière. */
const PAIRS: Rule[] = [
  { cause: ["endettement", "effet_levier", "credit_bancaire"], effect: ["rentabilite_financiere", "rentabilite", "performance_financiere"], question: "L'endettement de {e} a-t-il amélioré sa rentabilité financière entre {a} et {b} ?", objective: "Analyser l'effet de l'endettement sur la rentabilité financière de {e} entre {a} et {b}.", hypothesis: "L'endettement améliore la rentabilité financière de {e} (effet de levier positif)." },
  { cause: ["endettement", "credit_bancaire"], effect: ["solvabilite", "risque_faillite"], question: "La hausse de l'endettement a-t-elle fragilisé la solvabilité de {e} entre {a} et {b} ?", objective: "Évaluer l'incidence de l'endettement sur la solvabilité de {e}.", hypothesis: "La hausse de l'endettement fragilise la solvabilité de {e}." },
  { cause: ["credit_clients"], effect: ["tresorerie", "liquidite"], question: "L'allongement du délai de recouvrement des créances clients a-t-il dégradé la trésorerie de {e} ?", objective: "Analyser l'incidence du crédit accordé aux clients sur la trésorerie de {e}.", hypothesis: "L'allongement du délai de recouvrement des créances clients dégrade la trésorerie de {e}." },
  { cause: ["stocks"], effect: ["tresorerie", "liquidite"], question: "La gestion des stocks pèse-t-elle sur la trésorerie de {e} ?", objective: "Analyser l'incidence de la gestion des stocks sur la trésorerie de {e}.", hypothesis: "L'alourdissement des stocks dégrade la trésorerie de {e}." },
  { cause: ["bfr"], effect: ["tresorerie", "liquidite"], question: "L'évolution du besoin de financement d'exploitation explique-t-elle celle de la trésorerie de {e} ?", objective: "Analyser le lien entre le besoin de financement d'exploitation et la trésorerie de {e}.", hypothesis: "La croissance du besoin de financement d'exploitation dégrade la trésorerie de {e}." },
  { cause: ["autofinancement"], effect: ["investissement"], question: "La capacité d'autofinancement de {e} suffit-elle à financer ses investissements ?", objective: "Évaluer la capacité de {e} à financer ses investissements par ses ressources internes.", hypothesis: "La capacité d'autofinancement de {e} suffit à financer ses investissements." },
  { cause: ["investissement"], effect: ["rentabilite", "rentabilite_economique", "performance_financiere"], question: "Les investissements de {e} ont-ils amélioré sa rentabilité entre {a} et {b} ?", objective: "Analyser le lien entre les investissements et la rentabilité de {e}.", hypothesis: "Les investissements réalisés améliorent la rentabilité économique de {e}." },
  { cause: ["frais_financiers"], effect: ["rentabilite", "rentabilite_financiere", "marge_nette"], question: "Le coût de l'endettement réduit-il la rentabilité de {e} ?", objective: "Évaluer le poids des frais financiers dans la rentabilité de {e}.", hypothesis: "Le coût de l'endettement réduit la rentabilité de {e}." },
  { cause: ["dividendes"], effect: ["autofinancement"], question: "La politique de dividendes limite-t-elle l'autofinancement de {e} ?", objective: "Analyser l'effet de la distribution des bénéfices sur l'autofinancement de {e}.", hypothesis: "La politique de dividendes limite l'autofinancement de {e}." },
  { cause: ["croissance"], effect: ["tresorerie", "bfr"], question: "La croissance du chiffre d'affaires de {e} s'accompagne-t-elle d'une dégradation de sa trésorerie (effet ciseaux) ?", objective: "Analyser l'effet de la croissance de l'activité sur la trésorerie de {e}.", hypothesis: "La croissance de l'activité de {e} dégrade sa trésorerie par la hausse du besoin de financement d'exploitation." },
];

/** Hypothèses de niveau (descriptives) pour un concept jugé seul. */
const LEVELS: Record<string, { question: string; objective: string; hypothesis: string }> = {
  liquidite: { question: "Quel est le niveau de liquidité de {e} entre {a} et {b} ?", objective: "Évaluer la liquidité de {e} de {a} à {b}.", hypothesis: "La liquidité de {e} est satisfaisante sur la période {a}-{b}." },
  solvabilite: { question: "{e} est-elle solvable sur la période {a}-{b} ?", objective: "Évaluer la solvabilité de {e} de {a} à {b}.", hypothesis: "{e} est solvable sur la période {a}-{b}." },
  rentabilite: { question: "{e} est-elle rentable sur la période {a}-{b} ?", objective: "Évaluer la rentabilité de {e} de {a} à {b}.", hypothesis: "{e} est rentable sur la période {a}-{b}." },
  rentabilite_financiere: { question: "Quelle est la rentabilité financière de {e} entre {a} et {b} ?", objective: "Mesurer la rentabilité financière de {e} de {a} à {b}.", hypothesis: "La rentabilité financière de {e} est satisfaisante sur la période {a}-{b}." },
  tresorerie: { question: "Comment la trésorerie de {e} a-t-elle évolué entre {a} et {b} ?", objective: "Analyser l'évolution de la trésorerie de {e} de {a} à {b}.", hypothesis: "La trésorerie de {e} s'est dégradée entre {a} et {b}." },
  equilibre_financier: { question: "{e} respecte-t-elle l'équilibre financier entre {a} et {b} ?", objective: "Apprécier l'équilibre financier de {e} de {a} à {b}.", hypothesis: "{e} respecte la règle de l'équilibre financier sur la période {a}-{b}." },
  endettement: { question: "Quel est le niveau d'endettement de {e} entre {a} et {b} ?", objective: "Mesurer l'endettement de {e} de {a} à {b}.", hypothesis: "L'endettement de {e} reste soutenable sur la période {a}-{b}." },
  situation_financiere: { question: "Quelle est la situation financière de {e} entre {a} et {b} ?", objective: "Établir le diagnostic financier de {e} de {a} à {b}.", hypothesis: "La situation financière de {e} est saine sur la période {a}-{b}." },
  autofinancement: { question: "Quelle est la capacité d'autofinancement de {e} entre {a} et {b} ?", objective: "Évaluer la capacité d'autofinancement de {e}.", hypothesis: "{e} dégage une capacité d'autofinancement suffisante sur la période {a}-{b}." },
  croissance: { question: "Comment l'activité de {e} a-t-elle évolué entre {a} et {b} ?", objective: "Analyser l'évolution de l'activité de {e} de {a} à {b}.", hypothesis: "L'activité de {e} progresse sur la période {a}-{b}." },
};

const fill = (template: string, ctx: Context) => template.replaceAll("{e}", ctx.company).replaceAll("{a}", ctx.from).replaceAll("{b}", ctx.to);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Propositions absentes du texte actuel (aucune proposition déjà formulée par l'étudiant). */
export function financeProposals(text: { subject: string; existing: string }, ctx: Context): ResearchProposal[] {
  const concepts = conceptsOf(text.subject);
  const ids = new Set(concepts.map((c) => c.id));
  const out: ResearchProposal[] = [];
  const used = new Set<string>();
  for (const rule of PAIRS) {
    const cause = rule.cause.find((c) => ids.has(c));
    const effect = rule.effect.find((c) => ids.has(c));
    if (!cause || !effect || cause === effect) continue;
    const from = [cause, effect];
    out.push({ kind: "question", text: capitalize(fill(rule.question, ctx)), from }, { kind: "objective", text: capitalize(fill(rule.objective, ctx)), from }, { kind: "hypothesis", text: capitalize(fill(rule.hypothesis, ctx)), from });
    used.add(cause);
    used.add(effect);
  }
  for (const concept of concepts) {
    const level = LEVELS[concept.id];
    if (!level || used.has(concept.id)) continue;
    const from = [concept.id];
    out.push({ kind: "question", text: capitalize(fill(level.question, ctx)), from }, { kind: "objective", text: capitalize(fill(level.objective, ctx)), from }, { kind: "hypothesis", text: capitalize(fill(level.hypothesis, ctx)), from });
  }
  // Rien de ce que l'étudiant a déjà écrit.
  const existing = fold(text.existing);
  return out.filter((p) => !existing.includes(fold(p.text).slice(0, 60)));
}

/** Nom d'entreprise utilisable dans une phrase. */
export const companyLabel = (name: string) => name.replace(/\s*\((entreprise )?fictive\)\s*$/i, "").trim() || "l'entreprise";

export type { FinanceConcept };
