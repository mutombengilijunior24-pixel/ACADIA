// ============================================================
// ACADIA — MOTEUR DE MAPPING SCIENTIFIQUE (Module 3, incrément 1)
//
// Rapproche chaque colonne d'un Dataset importé (Module 2) des
// questions du questionnaire déjà généré pour ce projet (P4 —
// InstrumentRecord.questionnaire), lorsqu'il existe. Réutilise la
// traçabilité déjà présente sur QuestionnaireQuestion
// (variableId/dimensionId/indicatorId) plutôt que d'en inventer
// une nouvelle : ce moteur ne fait que retrouver QUELLE question
// correspond à quelle colonne, jamais quelle variable/indicateur
// une question représente (déjà su depuis P4).
//
// 100% déterministe — aucun appel IA ici (priorité mission :
// le déterministe passe toujours avant l'IA, voir §52 de la
// mission Module 3). Aucun calcul statistique.
//
// Toute proposition reste une PROPOSITION : ce fichier ne modifie
// jamais un Dataset lui-même — il retourne des suggestions que
// l'appelant (route API) applique uniquement sur confirmation
// explicite de l'utilisateur, colonne par colonne.
// ============================================================

import type { Dataset, DatasetColumn, DatasetMappingSource } from "@/lib/core/dataset/DatasetTypes";
import type { GeneratedQuestionnaire, QuestionnaireQuestion } from "@/lib/core/questionnaire/QuestionnaireTypes";

const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "a", "au", "aux",
  "vous", "votre", "vos", "quel", "quelle", "quels", "quelles", "quelle", "est",
  "sont", "ce", "cette", "ces", "dans", "sur", "pour", "avec", "par", "en", "que",
  "qui", "ne", "pas", "plus", "il", "elle", "ils", "elles", "d", "l", "qu",
]);

function normalizeText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(raw: string): Set<string> {
  return new Set(
    normalizeText(raw)
      .split(" ")
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface MappingCandidate {
  questionId: string;
  questionText: string;
  variableId?: string;
  dimensionId?: string;
  indicatorId?: string;
  confidence: number;
  reasons: string[];
}

export interface DatasetMappingSuggestion {
  columnId: string;
  columnLabel: string;
  best: MappingCandidate | null;
  alternatives: MappingCandidate[];
}

const CONFIDENCE_THRESHOLD = 0.5;

function scoreQuestionForColumn(column: DatasetColumn, question: QuestionnaireQuestion): MappingCandidate {
  const reasons: string[] = [];
  let score = 0;

  const labelTokens = tokenSet(column.label);
  const questionTokens = tokenSet(question.text);
  const textSimilarity = jaccard(labelTokens, questionTokens);
  if (textSimilarity > 0) {
    score += textSimilarity * 0.6;
    if (textSimilarity >= 0.7) reasons.push("le libellé de la colonne correspond fortement au texte de la question");
    else if (textSimilarity >= 0.3) reasons.push("le libellé de la colonne partage des mots-clés avec la question");
  }

  // Correspondance des modalités (colonne catégorielle vs options/échelle de la question).
  const columnOptionValues = new Set((column.options ?? []).map((o) => normalizeText(o.label || o.value)));
  const questionOptionValues = new Set(
    [...(question.options ?? []), ...(question.scale ?? [])].map((o) => normalizeText(o.label || o.value))
  );
  if (columnOptionValues.size > 0 && questionOptionValues.size > 0) {
    const modalityOverlap = jaccard(columnOptionValues, questionOptionValues);
    if (modalityOverlap > 0) {
      score += modalityOverlap * 0.25;
      if (modalityOverlap >= 0.5) reasons.push("les modalités de réponse correspondent");
    }
  }

  // Compatibilité de forme (catégoriel vs catégoriel, numérique vs numérique...).
  const columnIsCategorical = ["single_choice", "multiple_choice", "likert", "boolean"].includes(column.dataType);
  const questionIsCategorical = ["single_choice", "multiple_choice", "likert", "yes_no", "frequency", "importance"].includes(
    question.type
  );
  const columnIsNumeric = ["integer", "decimal"].includes(column.dataType);
  const questionIsNumeric = ["number", "percentage"].includes(question.type);
  if ((columnIsCategorical && questionIsCategorical) || (columnIsNumeric && questionIsNumeric)) {
    score += 0.15;
    reasons.push("le type de réponse est compatible");
  }

  return {
    questionId: question.id,
    questionText: question.text,
    variableId: question.variableId,
    dimensionId: question.dimensionId,
    indicatorId: question.indicatorId,
    confidence: Math.min(1, Math.round(score * 100) / 100),
    reasons,
  };
}

/**
 * Aucune tentative si la colonne a déjà un mapping confirmé/rejeté
 * par l'utilisateur — on ne propose jamais d'écraser un choix
 * humain (voir mission §26/§37 : rejet = décision durable, pas
 * juste "pas encore mappé").
 */
function isEligibleForSuggestion(column: DatasetColumn): boolean {
  return column.mappingStatus !== "confirmed" && column.mappingStatus !== "user_modified" && column.mappingStatus !== "rejected";
}

export function suggestMappingsForDataset(
  dataset: Dataset,
  questionnaire: GeneratedQuestionnaire | undefined
): DatasetMappingSuggestion[] {
  const questions: QuestionnaireQuestion[] = questionnaire ? questionnaire.sections.flatMap((s) => s.questions) : [];

  return dataset.columns
    .filter(isEligibleForSuggestion)
    .map((column) => {
      const candidates = questions
        .map((q) => scoreQuestionForColumn(column, q))
        .filter((c) => c.confidence > 0)
        .sort((a, b) => b.confidence - a.confidence);

      const best = candidates[0] && candidates[0].confidence >= CONFIDENCE_THRESHOLD ? candidates[0] : null;
      const alternatives = candidates.slice(best ? 1 : 0, 3);

      return { columnId: column.id, columnLabel: column.label, best, alternatives };
    })
    .filter((s) => s.best || s.alternatives.length > 0);
}

export const MAPPING_SOURCE_TEXT_SIMILARITY: DatasetMappingSource = "question_text_similarity";
