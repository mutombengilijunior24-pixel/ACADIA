// ============================================================
// ACADIA — GARDE-FOUS DE VÉRIFICATION (Mission 6, incrément 3 ; généralisé Mission 7, bloc 2)
//
// Vérifie a posteriori une prose IA. Ne corrige et ne supprime jamais
// silencieusement un texte — c'est à l'appelant de décider quoi faire
// des violations retournées (Mission 6 : bascule "needs_review" sans
// bloquer ; Mission 7 : rejet strict, voir ScientificConclusionValidator.ts).
//
// Portée assumée, heuristique et non une garantie absolue :
//
// - CausalityGuard : ne bloque que "cause"/"entraîne"/"provoque"
//   (et leurs conjugaisons), volontairement PAS "explique" — en
//   français statistique, "variance expliquée" est un terme légitime
//   et non causal (pouvoir explicatif ≠ causalité) ; un blocage
//   naïf sur ce verbe produirait un faux positif systématique sur du
//   vocabulaire correct. Un disclaimer explicite dans la même phrase
//   ("ne permet pas d'établir de lien causal", etc.) neutralise le
//   signalement — c'est le vocabulaire de prudence exigé par le
//   prompt lui-même, pas une violation.
// - NumericConsistencyGuard : compare chaque nombre décimal ou ≥ 13
//   cité dans le texte à l'ensemble des valeurs réellement transmises
//   à l'IA (tolérance relative 1%). Ignore volontairement les petits
//   entiers (≤ 12) — trop souvent des tournures de style ("deux
//   variables") plutôt que des statistiques citées. Une petite p-value
//   en notation scientifique (ex. "2,53963 × 10^-10") est comparée à
//   sa mantisse, pas seulement à sa valeur brute.
// - ContradictionGuard : signale un vocabulaire de preuve absolue
//   ("prouve"/"démontre" — une hypothèse statistique n'est jamais
//   "PROVED", voir HypothesisAssessmentDecision) et une contradiction
//   directe entre le vocabulaire employé (soutenue/non soutenue) et
//   la décision SUPPORTED/NOT_SUPPORTED déjà tranchée. Ne vérifie pas
//   PARTIALLY_SUPPORTED : les deux vocabulaires y sont légitimement
//   présents à la fois.
//
// Généralisation Mission 7 : les trois fonctions de vérification
// (checkCausality/checkNumericConsistency/checkContradiction)
// opèrent sur des formes génériques ({field,text}[], number[],
// Map<hypothesisId, {decision}>) — jamais couplées à la forme exacte
// de ScientificInterpretationContent. `runInterpretationGuards` reste
// le point d'entrée historique de Mission 6, inchangé en
// comportement ; ScientificConclusionValidator.ts (Mission 7)
// réutilise les mêmes fonctions génériques directement.
// ============================================================

import type { ScientificInterpretationContent, GuardViolation } from "./ScientificInterpretationTypes";
import type { ScientificInterpretationContext } from "@/lib/ai/openai/ScientificInterpretationAI";

export interface TextField {
  field: string;
  text: string;
}

function collectTextFields(content: ScientificInterpretationContent): TextField[] {
  const fields: TextField[] = [{ field: "summary", text: content.summary }];
  content.findings.forEach((f, i) => fields.push({ field: `findings[${i}].statement`, text: f.statement }));
  content.recommendations.forEach((r, i) => fields.push({ field: `recommendations[${i}]`, text: r }));
  content.limitations.forEach((l, i) => fields.push({ field: `limitations[${i}]`, text: l }));
  return fields;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

// ------------------------------------------------------------
// CAUSALITY GUARD
// ------------------------------------------------------------

const CAUSAL_VERB_PATTERN =
  /\b(caus(?:e|es|ent|é|ée|és|ées|ant|er)|entra[iî]n(?:e|es|ent|é|ée|és|ées|ant|er)|provoqu(?:e|es|ent|é|ée|és|ées|ant|er))\b/giu;

const DISCLAIMER_PATTERN =
  /(ne\s+\w+\s+pas|sans\s+établir|sans\s+démontrer|n['’]établit\s+pas|n['’]implique\s+pas|ne\s+démontre\s+pas|ne\s+permet\s+pas|ne\s+prouve\s+pas|aucune\s+causalité|aucun\s+lien\s+causal|pas\s+de\s+causalité|pas\s+de\s+lien\s+causal|ne\s+peut\s+(?:pas\s+)?établir)/giu;

export function checkCausality(fields: TextField[]): GuardViolation[] {
  const violations: GuardViolation[] = [];
  for (const { field, text } of fields) {
    for (const sentence of splitSentences(text)) {
      CAUSAL_VERB_PATTERN.lastIndex = 0;
      const match = CAUSAL_VERB_PATTERN.exec(sentence);
      if (!match) continue;
      DISCLAIMER_PATTERN.lastIndex = 0;
      if (DISCLAIMER_PATTERN.test(sentence)) continue;
      violations.push({
        guard: "causality",
        field,
        snippet: sentence.trim(),
        reason: `Vocabulaire causal ("${match[0]}") employé sans disclaimer explicite dans la même phrase — une association statistique ne doit jamais être présentée comme une cause.`,
      });
    }
  }
  return violations;
}

// ------------------------------------------------------------
// NUMERIC CONSISTENCY GUARD
// ------------------------------------------------------------

const IGNORED_ABS_MAX = 12;
const RELATIVE_TOLERANCE = 0.01;

export function collectKnownNumbers(context: ScientificInterpretationContext): number[] {
  const nums: number[] = [context.sampleSize, context.alpha, context.alpha * 100];
  const push = (v: number | null | undefined) => {
    if (v !== null && v !== undefined) nums.push(v);
  };

  for (const r of context.results) {
    nums.push(r.n);
    r.descriptive?.frequencyTable?.forEach((f) => nums.push(f.count, f.percentage, f.validPercentage));
    const s = r.descriptive?.numericalStatistics;
    if (s) [s.min, s.max, s.mean, s.median, s.standardDeviation].forEach(push);
    push(r.bivariate?.chiSquare?.pValue);
    push(r.bivariate?.chiSquare?.cramersV);
    push(r.bivariate?.pearson?.coefficient);
    push(r.bivariate?.pearson?.pValue);
    push(r.bivariate?.spearman?.coefficient);
    push(r.bivariate?.spearman?.pValue);
  }

  // Notation scientifique ("2,53963 × 10^-10") : la mantisse citée en
  // prose ne matche pas la valeur brute — on l'ajoute comme connue.
  const withMantissas = [...nums];
  for (const n of nums) {
    if (n !== 0 && Math.abs(n) < 0.001) {
      const mantissa = parseFloat(n.toExponential(6).split("e")[0]);
      withMantissas.push(mantissa, Math.abs(mantissa));
    }
  }
  return withMantissas;
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  return matches.map((m) => parseFloat(m.replace(",", "."))).filter((n) => Number.isFinite(n));
}

function isKnown(n: number, known: number[]): boolean {
  return known.some((k) => Math.abs(k - n) <= Math.max(0.005, Math.abs(k) * RELATIVE_TOLERANCE));
}

export function checkNumericConsistency(fields: TextField[], knownNumbers: number[]): GuardViolation[] {
  const violations: GuardViolation[] = [];
  for (const { field, text } of fields) {
    for (const n of extractNumbers(text)) {
      if (Math.abs(n) <= IGNORED_ABS_MAX) continue;
      if (!isKnown(n, knownNumbers)) {
        violations.push({
          guard: "numeric_consistency",
          field,
          snippet: String(n),
          reason: `Le nombre ${n} cité dans ce texte ne correspond (à 1 % près) à aucune valeur transmise à l'IA (résultats statistiques, effectifs, seuil α) — possible invention.`,
        });
      }
    }
  }
  return violations;
}

// ------------------------------------------------------------
// CONTRADICTION GUARD
// ------------------------------------------------------------

const OVERCLAIM_PATTERN = /\b(prouv\w*|démontr\w*)\b/giu;

/** Racine partagée par SUPPORT_PATTERN et la négation — évite d'énumérer chaque combinaison "non/pas X". */
const SUPPORT_STEM = "(?:soutenu|confirmé|corroboré|validé|vérifié|appuyé)\\w*";
const SUPPORT_PATTERN = new RegExp(`\\b${SUPPORT_STEM}\\b`, "giu");
/** "non soutenue", "pas confirmé", "n'est pas vérifiée", etc. — toute négation directement suivie d'un mot de soutien. */
const NEGATED_SUPPORT_PATTERN = new RegExp(`\\b(?:non|pas)\\s+${SUPPORT_STEM}\\b`, "giu");
/** Mots de rejet qui n'ont pas besoin d'une négation explicite pour signifier un non-soutien. */
const STANDALONE_NOT_SUPPORT_PATTERN = /\b(infirmé\w*|réfuté\w*|rejeté\w*|invalidé\w*)\b/giu;

export interface ContradictionCheckItem {
  field: string;
  text: string;
  /** Absent si ce texte ne se rattache à aucune hypothèse précise — seul l'OVERCLAIM_PATTERN s'applique alors. */
  hypothesisId?: string;
}

export function checkContradiction(
  items: ContradictionCheckItem[],
  decisionByHypothesisId: Map<string, { decision: string }>
): GuardViolation[] {
  const violations: GuardViolation[] = [];

  for (const { field, text, hypothesisId } of items) {
    OVERCLAIM_PATTERN.lastIndex = 0;
    const overclaim = OVERCLAIM_PATTERN.exec(text);
    if (overclaim) {
      violations.push({
        guard: "contradiction",
        field,
        snippet: text,
        reason: `Vocabulaire de preuve absolue ("${overclaim[0]}") — une hypothèse statistique n'est jamais "prouvée", seulement soutenue ou non par les données disponibles.`,
      });
    }

    if (!hypothesisId) continue;
    const hyp = decisionByHypothesisId.get(hypothesisId);
    if (!hyp) continue;

    NEGATED_SUPPORT_PATTERN.lastIndex = 0;
    STANDALONE_NOT_SUPPORT_PATTERN.lastIndex = 0;
    const hasNotSupport = NEGATED_SUPPORT_PATTERN.test(text) || STANDALONE_NOT_SUPPORT_PATTERN.test(text);
    SUPPORT_PATTERN.lastIndex = 0;
    const hasSupport = !hasNotSupport && SUPPORT_PATTERN.test(text);

    if (hyp.decision === "SUPPORTED" && hasNotSupport) {
      violations.push({
        guard: "contradiction",
        field,
        snippet: text,
        reason: "Le texte suggère un rejet de l'hypothèse alors que la décision déjà tranchée est SUPPORTED.",
      });
    }
    if (hyp.decision === "NOT_SUPPORTED" && hasSupport) {
      violations.push({
        guard: "contradiction",
        field,
        snippet: text,
        reason: "Le texte suggère une confirmation de l'hypothèse alors que la décision déjà tranchée est NOT_SUPPORTED.",
      });
    }
    if (hyp.decision === "INCONCLUSIVE" && (hasSupport || hasNotSupport)) {
      violations.push({
        guard: "contradiction",
        field,
        snippet: text,
        reason:
          "Le texte affirme un résultat tranché (soutenue/non soutenue) alors que la décision déjà tranchée est INCONCLUSIVE — preuve insuffisante.",
      });
    }
  }

  return violations;
}

// ------------------------------------------------------------
// POINT D'ENTRÉE — MISSION 6 (comportement inchangé)
// ------------------------------------------------------------

export function runInterpretationGuards(
  content: ScientificInterpretationContent,
  context: ScientificInterpretationContext
): GuardViolation[] {
  const fields = collectTextFields(content);
  const knownNumbers = collectKnownNumbers(context);
  const contradictionItems: ContradictionCheckItem[] = content.findings.map((f, i) => ({
    field: `findings[${i}].statement`,
    text: f.statement,
    hypothesisId: f.relatedHypothesisId,
  }));
  const decisionByHypothesisId = new Map(context.hypotheses.map((h) => [h.hypothesisId, h]));

  return [
    ...checkCausality(fields),
    ...checkNumericConsistency(fields, knownNumbers),
    ...checkContradiction(contradictionItems, decisionByHypothesisId),
  ];
}
