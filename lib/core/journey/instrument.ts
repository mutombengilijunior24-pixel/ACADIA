/**
 * Instrument de collecte : type déclaré par l'utilisateur et, pour un questionnaire,
 * lecture des questions réellement posées et rapprochement avec les colonnes du fichier.
 * Aucun instrument n'est inventé : sans texte fourni, seuls les en-têtes du fichier servent de questions.
 */
import type { GeneratedQuestionnaire } from "@/lib/core/questionnaire/QuestionnaireTypes";
import { fold } from "@/lib/core/understanding/text";

import { corpusOf, coverage, tokensOf } from "./match";
import type { FileStructure, QuestionUnit } from "./structure";

export type InstrumentKind = "questionnaire" | "interview_guide" | "observation_grid" | "documentary" | "other";

export const INSTRUMENT_LABELS: Record<InstrumentKind, string> = {
  questionnaire: "Questionnaire d'enquête",
  interview_guide: "Guide d'entretien",
  observation_grid: "Grille d'observation",
  documentary: "Données documentaires ou comptables",
  other: "Autre instrument",
};

export interface InstrumentQuestion {
  id: string;
  number: number | null;
  text: string;
  options: string[];
  section: string | null;
  source: "pasted" | "acadia";
  /** Consignes de saut : « Non → passez à la question 8 ». */
  jumps: Array<{ option: string; to: number }>;
  /** « Si oui, … » / « Si non, … » : la question dépend de la réponse à la précédente. */
  appliesIfPrevious?: "yes" | "no";
}

const JUMP = /^(.*?)\s*(?:→|->|=>|:|\(|—|–|-)?\s*(?:passe[rz]?|aller|allez|sautez|saute[rz]?|rendez-vous)\s+(?:directement\s+)?(?:à|a|au)\s+(?:la\s+)?(?:question\s+|q\s*)?(\d+)\s*\)?\s*\.?$/i;
const IF_PREVIOUS = /^si\s+(oui|non)\b[\s,:]*/i;

const QUESTION_LINE = /^\s*(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[.)\-:°]\s*(.+)$/i;
const OPTION_LINE = /^\s*(?:[-•*·□○◯☐▢o]|\(?[a-hA-H][.)]|\d{1,2}\s*=)\s+(.+)$/;
const SECTION_LINE = /^\s*(?:(?:[IVX]{1,5}|[A-H])\s*[.)\-:]\s*)?(?:section|partie|bloc|rubrique)?\s*[A-ZÀ-Ý0-9' ,:;()-]{6,}$/;

/** Lit un questionnaire collé en texte : questions numérotées ou terminées par « ? », options en puces. */
export function parseQuestionnaire(text: string): InstrumentQuestion[] {
  const questions: InstrumentQuestion[] = [];
  let section: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const numbered = QUESTION_LINE.exec(line);
    const option = OPTION_LINE.exec(line);
    const last = questions[questions.length - 1];
    if (option && last && !numbered) {
      const jump = JUMP.exec(option[1].trim());
      if (jump && jump[1].trim()) {
        last.options.push(jump[1].trim());
        last.jumps.push({ option: jump[1].trim(), to: Number(jump[2]) });
      } else last.options.push(option[1].trim());
      continue;
    }
    if (numbered || line.endsWith("?")) {
      const text = (numbered ? numbered[2] : line).trim();
      const conditional = IF_PREVIOUS.exec(text);
      questions.push({ id: `q${questions.length + 1}`, number: numbered ? Number(numbered[1]) : null, text, options: [], section, source: "pasted", jumps: [], appliesIfPrevious: conditional ? (conditional[1].toLowerCase() === "oui" ? "yes" : "no") : undefined });
      continue;
    }
    if (SECTION_LINE.test(line) && line === line.toUpperCase()) {
      section = line;
      continue;
    }
    // Ligne de suite : complète la question précédente si elle n'a pas encore d'options.
    if (last && !last.options.length) last.text = `${last.text} ${line}`;
  }
  return questions;
}

export function questionsFromAcadia(questionnaire: GeneratedQuestionnaire): InstrumentQuestion[] {
  return questionnaire.sections.flatMap((section) =>
    section.questions.map((q) => ({ id: q.id, number: q.number, text: q.text, options: (q.options ?? q.scale ?? []).map((o) => o.label), section: section.title, source: "acadia" as const, jumps: [] })),
  );
}

export interface QuestionLink {
  questionId: string;
  unitId: string | null;
  score: number;
  confidence: "high" | "medium" | "low" | "none";
  reason: string;
  alternatives: Array<{ unitId: string; score: number }>;
}

/** Rapproche chaque question de l'instrument d'une unité de question du fichier (texte + modalités). */
export function linkQuestions(questions: InstrumentQuestion[], structure: FileStructure): QuestionLink[] {
  const units = structure.units.filter((u) => u.kind !== "technical");
  const corpus = corpusOf(units.map((u) => u.text));
  const used = new Set<string>();
  const scored = questions.map((question) => {
    const qTokens = tokensOf(question.text);
    const ranked = units
      .map((unit) => {
        const text = coverage(qTokens, tokensOf(unit.text), corpus).score;
        const reverse = coverage(tokensOf(unit.text), qTokens, corpus).score;
        const options = question.options.length && unit.options.length ? question.options.filter((o) => unit.options.some((v) => fold(v).replace(/^[^a-z0-9]+/, "") === fold(o).replace(/^[^a-z0-9]+/, ""))).length / question.options.length : 0;
        return { unitId: unit.id, score: Math.min(1, 0.6 * text + 0.25 * reverse + 0.15 * options + (question.number !== null && new RegExp(`^\\s*(?:q\\s*)?0*${question.number}\\b`, "i").test(unit.text) ? 0.15 : 0)) };
      })
      .sort((a, b) => b.score - a.score);
    return { question, ranked };
  });
  // Attribution gloutonne par score décroissant : une unité n'est proposée qu'une fois.
  const order = [...scored].sort((a, b) => (b.ranked[0]?.score ?? 0) - (a.ranked[0]?.score ?? 0));
  const links = new Map<string, QuestionLink>();
  for (const { question, ranked } of order) {
    const best = ranked.find((r) => !used.has(r.unitId) && r.score >= 0.45);
    if (best) used.add(best.unitId);
    const score = best?.score ?? 0;
    links.set(question.id, {
      questionId: question.id,
      unitId: best?.unitId ?? null,
      score,
      confidence: !best ? "none" : score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low",
      reason: best ? `${Math.round(score * 100)} % de correspondance entre le texte de la question (et ses modalités) et l'en-tête de la colonne.` : "Aucune colonne ne correspond suffisamment à cette question.",
      alternatives: ranked.filter((r) => r.unitId !== best?.unitId && r.score >= 0.3).slice(0, 3),
    });
  }
  return questions.map((q) => links.get(q.id)!);
}

export function unitById(structure: FileStructure, id: string | null | undefined): QuestionUnit | undefined {
  return id ? structure.units.find((u) => u.id === id) : undefined;
}
