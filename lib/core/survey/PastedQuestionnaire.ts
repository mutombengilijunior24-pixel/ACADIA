// ============================================================
// ACADIA — QUESTIONNAIRE COLLÉ : reconnaissance SANS IA
//
// L'étudiant colle le texte de son questionnaire (rédigé avec ChatGPT,
// Word, un PDF, WhatsApp…). Des règles simples et déterministes en
// reconnaissent les sections, les questions, les modalités et le type de
// chaque question. Aucun appel à un service externe : instantané, gratuit,
// et utilisable même sans crédit d'IA. L'étudiant vérifie le résultat
// avant de créer son enquête, et peut tout corriger ensuite dans l'éditeur.
// Le sens d'une question n'est jamais réécrit : son texte est repris tel quel.
// ============================================================

import type { ExtractedQuestion, ExtractedQuestionType } from "@/lib/ai/openai/SurveyDocumentAI";
import { isCoherentScale } from "./SurveyQualityControl";

export interface PastedQuestionnaire {
  title: string;
  description: string;
  questions: ExtractedQuestion[];
  /** Lignes que la reconnaissance n'a rattachées à aucune question (pour que l'étudiant vérifie). */
  ignored: string[];
}

export const MAX_PASTED_LENGTH = 60_000;
const DEFAULT_SECTION = "Questionnaire";

// ---------- reconnaissance des lignes ----------
const QUESTION_NUM = /^(?:q(?:uestion)?\s*)?(\d{1,3})\s*(?:[.)°:]|-(?!\d)|–|—)\s*(.+)$/i;
const SECTION_WORD = /^(?:section|partie|rubrique|bloc|volet|chapitre|axe|module|thème|theme)\b\s*([0-9ivxlcA-Za-z]{0,4})\s*[:.\-–—)]?\s*(.*)$/i;
const ROMAN_HEADING = /^([IVX]{1,5})\s*[.)\-–—:]\s+(.+)$/;
const BULLET = /^(?:[-–—•*·▪◦●○■□☐❑▢✓✔►➢>+]|\[\s?[xX ]?\s?\]|\(\s?\))\s+/;
const LETTER_OPTION = /^\(?([a-hA-H])\s*[.)]\s+(.+)$/;
const ANSWER_LINE = /^[\s._…\-–—]{4,}$/;
const CHECKBOX = /[☐□❑▢]/;
const YES_NO_TAIL = /\(?\s*(?:oui\s*\/\s*non|non\s*\/\s*oui)\s*\)?\s*\.?$/i;
const MULTIPLE_HINT = /plusieurs\s+(?:réponses|choix)|cochez\s+(?:tout|toutes)|choix\s+multiples?|réponses?\s+multiples?/i;
const OPEN_HINT = /\b(?:pourquoi|expliquez|expliquer|décrivez|décrire|justifiez|précisez|suggestions?|recommandations?|commentaires?|remarques?|votre avis|selon vous,? comment)\b/i;
const NUMBER_HINT = /\b(?:combien|nombre de|montant|revenu|chiffre d'affaires|salaire|en (?:fc|cdf|usd|dollars|francs))\b/i;
const AGE_HINT = /(?:^|\s)(?:âge|age)\b/i;
const DATE_HINT = /\bdate\b/i;
const SCALE_PREFIX = /^(?:échelle|echelle)(?:\s+de\s+likert)?\s*[:\-–]?\s*/i;

type Draft = { section: string; text: string; options: string[]; multiple: boolean; yesNo: boolean; open: boolean; scale: string[] | null; closed: boolean };

/** Nettoie une ligne collée : emphase markdown, citations, espaces. */
function clean(raw: string): string {
  return raw
    .replace(/ /g, " ")
    .replace(/\*\*|__|`{1,3}/g, "")
    .replace(/^\s*>\s?/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Texte d'une modalité, sans puce, case, lettre ni pointillés de réponse. */
function optionLabel(text: string): string {
  return text
    .replace(BULLET, "")
    .replace(/^\(?[a-hA-H]\s*[.)]\s+/, "")
    .replace(/[☐□❑▢]/g, "")
    .replace(/[_…]{2,}|\.{3,}/g, "")
    .replace(/\s*[:;,]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** « Sexe : ☐ Masculin ☐ Féminin » -> texte « Sexe » et modalités. */
function splitInlineCheckboxes(text: string): { text: string; options: string[] } {
  if (!CHECKBOX.test(text)) return { text, options: [] };
  const [head, ...rest] = text.split(/[☐□❑▢]/);
  return { text: head.replace(/\s*:\s*$/, "").trim(), options: rest.map(optionLabel).filter(Boolean) };
}

/**
 * Définition d'échelle sur une ligne :
 * « 1 = Pas du tout d'accord ; 2 = Pas d'accord ; … ; 5 = Tout à fait d'accord », ou
 * « Pas du tout d'accord / Pas d'accord / Neutre / D'accord / Tout à fait d'accord ».
 */
export function parseScaleDefinition(line: string): string[] | null {
  if (line.includes("?") || line.length > 300) return null;
  const body = line.replace(SCALE_PREFIX, "").replace(/^\(|\)$/g, "");
  const numbered = [...body.matchAll(/(\d)\s*(?:=|:|→|->|–|-)\s*([^;|,\/\d]+?)(?=\s*(?:[;|,\/]|\(?\d\s*(?:=|:|→|->|–|-)|\)?$))/g)];
  if (numbered.length >= 3) {
    const labels = numbered.sort((a, b) => Number(a[1]) - Number(b[1])).map((m) => m[2].replace(/[()]/g, "").trim()).filter(Boolean);
    if (labels.length >= 3) return labels;
  }
  const parts = body.split(/\s+\/\s+|\s+[–—]\s+|\s*\|\s*|\s*;\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 4 && parts.length <= 7 && isCoherentScale(parts.map((label) => ({ label })))) return parts;
  return null;
}

function isHeading(line: string): { title: string } | null {
  if (line.includes("?")) return null;
  const md = /^#{1,6}\s+(.+)$/.exec(line);
  const inner = md ? md[1].trim() : line;
  const section = SECTION_WORD.exec(inner);
  if (section) return { title: inner.replace(/\s*[:.]\s*$/, "") };
  const roman = ROMAN_HEADING.exec(inner);
  if (roman) return { title: inner.replace(/\s*[:.]\s*$/, "") };
  if (md) return { title: inner };
  return null;
}

function inferType(d: Draft): { type: ExtractedQuestionType; options: string[] } {
  const options = [...new Set(d.options.map((o) => o.trim()).filter(Boolean))];
  const lower = options.map((o) => o.toLowerCase());
  const isYesNo = d.yesNo || (options.length === 2 && lower.includes("oui") && lower.includes("non"));
  if (isYesNo) return { type: "boolean", options: [] };
  if (options.length >= 2) {
    if (d.multiple) return { type: "multiple_choice", options };
    if (isCoherentScale(options.map((label) => ({ label })))) return { type: "scale", options };
    return { type: "single_choice", options };
  }
  // Une question ouverte (pointillés de réponse, « suggestions », « pourquoi »…) reste ouverte, même dans une section d'échelle.
  if (d.open || (OPEN_HINT.test(d.text) && d.text.trim().endsWith("?"))) return { type: "long_text", options: [] };
  if (d.scale && d.scale.length >= 2) return { type: "scale", options: d.scale };
  if (AGE_HINT.test(d.text) && !/\bâgé|age de (?:votre|l')/i.test(d.text)) return { type: "age", options: [] };
  if (NUMBER_HINT.test(d.text)) return { type: "number", options: [] };
  if (DATE_HINT.test(d.text)) return { type: "date", options: [] };
  if (OPEN_HINT.test(d.text)) return { type: "long_text", options: [] };
  return { type: "short_text", options: [] };
}

export function parsePastedQuestionnaire(input: string, fallbackTitle = ""): PastedQuestionnaire {
  const lines = input.slice(0, MAX_PASTED_LENGTH).split(/\r?\n/);
  const drafts: Draft[] = [];
  const ignored: string[] = [];
  const intro: string[] = [];
  let title = "";
  let section = DEFAULT_SECTION;
  let sectionScale: string[] | null = null;
  let current: Draft | null = null;
  let tableScale: string[] | null = null;

  const start = (text: string) => {
    const inline = splitInlineCheckboxes(text);
    let body = inline.text;
    const yesNo = YES_NO_TAIL.test(body);
    if (yesNo) body = body.replace(YES_NO_TAIL, "").trim();
    current = {
      section,
      text: body,
      options: inline.options,
      multiple: MULTIPLE_HINT.test(text),
      yesNo,
      open: false,
      scale: sectionScale,
      closed: /[?:]$/.test(body) || inline.options.length > 0,
    };
    drafts.push(current);
  };

  for (const raw of lines) {
    const line = clean(raw);
    if (!line) continue;

    // Tableau (markdown) : en-tête d'échelle, puis une affirmation par ligne.
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line.slice(1, -1).split("|").map((c) => clean(c));
      if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) continue;
      const scale = cells.slice(1).filter(Boolean);
      if (!tableScale && scale.length >= 3 && (isCoherentScale(scale.map((label) => ({ label }))) || scale.every((c) => /^\d+$/.test(c)))) {
        tableScale = scale.every((c) => /^\d+$/.test(c)) && sectionScale ? sectionScale : scale;
        current = null;
        continue;
      }
      if (tableScale && cells[0]) {
        const statement = cells[0].replace(QUESTION_NUM, "$2").trim();
        if (statement && !/^(?:affirmations?|énoncés?|items?|questions?|propositions?)$/i.test(statement)) {
          start(statement);
          current!.options = [...tableScale];
          current!.closed = true;
        }
        continue;
      }
    } else {
      tableScale = null;
    }

    if (ANSWER_LINE.test(line)) {
      if (current) {
        (current as Draft).open = true;
        (current as Draft).closed = true;
      }
      continue;
    }

    const heading = isHeading(line);
    if (heading) {
      current = null;
      // « Section 3 : Perception (1 = Pas du tout d'accord … 5 = Tout à fait d'accord) » : échelle de toute la section.
      const parenthesis = /\(([^()]*)\)\s*$/.exec(heading.title);
      sectionScale = parenthesis ? parseScaleDefinition(parenthesis[1]) : null;
      section = sectionScale ? heading.title.replace(/\s*\([^()]*\)\s*$/, "") : heading.title;
      continue;
    }

    const numbered = QUESTION_NUM.exec(line);
    // « 1 = Pas du tout d'accord ; 2 = … » ressemble à une question numérotée : c'est une échelle.
    const scale = parseScaleDefinition(line);
    if (scale && (!numbered || /^\d\s*(?:=|:|→)/.test(line))) {
      const c = current as Draft | null;
      if (c && c.options.length === 0 && !c.yesNo) {
        c.options = scale;
        c.closed = true;
      } else {
        sectionScale = scale;
        current = null;
      }
      continue;
    }

    if (numbered) {
      start(numbered[2].trim());
      continue;
    }

    const isBullet = BULLET.test(line) || LETTER_OPTION.test(line);
    if (isBullet || (CHECKBOX.test(line) && !line.includes("?"))) {
      const c = current as Draft | null;
      const parts = CHECKBOX.test(line) ? splitInlineCheckboxes(line).options : [optionLabel(line)];
      const head = CHECKBOX.test(line) ? splitInlineCheckboxes(line).text : "";
      if (c && !head) {
        c.options.push(...parts.filter(Boolean));
        c.closed = true;
      } else if (line.endsWith("?")) {
        start(optionLabel(line));
      } else if (head) {
        start(line);
      } else {
        ignored.push(line);
      }
      continue;
    }

    const c = current as Draft | null;
    // Suite d'une question écrite sur plusieurs lignes : la ligne commence par une minuscule.
    if (c && !c.closed && c.options.length === 0 && /^[a-zàâäéèêëîïôöùûüç(«"]/.test(line)) {
      c.text = `${c.text} ${line}`.trim();
      c.closed = /[?:]$/.test(line);
      continue;
    }

    // « Avez-vous un compte ? Oui / Non » : question fermée écrite sur une seule ligne.
    if (line.endsWith("?") || /\?\s*\(?\s*(?:oui\s*\/\s*non|non\s*\/\s*oui)\s*\)?\s*\.?$/i.test(line)) {
      start(line);
      continue;
    }

    if (c) {
      // Section d'échelle (Likert) : une affirmation est suivie d'une autre affirmation, pas de modalités.
      if (sectionScale && c.scale && c.options.length === 0 && !c.yesNo && !/[?:]$/.test(c.text)) {
        start(line);
        current!.closed = true;
        continue;
      }
      // Copie depuis Word : les puces disparaissent, les modalités deviennent de simples lignes courtes.
      if (line.length <= 80) {
        if (MULTIPLE_HINT.test(line) && line.length <= 50 && /^\(.*\)$/.test(line)) c.multiple = true;
        else c.options.push(optionLabel(line));
        c.closed = true;
      } else {
        ignored.push(line);
      }
      continue;
    }

    // Avant toute question : titre puis texte d'introduction (consignes, anonymat…).
    if (!title && drafts.length === 0) title = line.replace(/^#{1,6}\s+/, "");
    else if (drafts.length === 0) intro.push(line);
    // Affirmation non numérotée dans une section d'échelle (Likert).
    else if (sectionScale && line.length >= 10) {
      start(line);
      current!.closed = true;
    } else ignored.push(line);
  }

  const questions: ExtractedQuestion[] = drafts
    .filter((d) => d.text.replace(/[:\s]/g, "").length > 1)
    .map((d) => {
      const { type, options } = inferType(d);
      return { section: d.section, text: d.text.replace(/\s*:\s*$/, "").trim(), type, required: true, options: options.map((label) => ({ label })) };
    });

  // Titre générique (« QUESTIONNAIRE D'ENQUÊTE ») suivi du sujet : le sujet est le vrai titre.
  if (/^questionnaire(?:\s+d['’]enqu[eê]te)?\s*:?\s*$/i.test(title) && intro.length > 0 && intro[0].length <= 200) {
    title = intro.shift()!;
  }

  return {
    title: (title || fallbackTitle || "Questionnaire").slice(0, 200),
    description: intro.join(" ").slice(0, 2000),
    questions,
    ignored: ignored.slice(0, 50),
  };
}
