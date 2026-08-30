// ============================================================
// ACADIA — MODULE SURVEY : MOTEUR STATISTIQUE (déterministe)
//
// Calcule des fréquences/moyennes/médianes à partir des réponses
// réellement collectées — jamais une valeur inventée. Distinct de
// toute interprétation : ce moteur produit des DONNÉES/ANALYSES,
// jamais un texte de lecture (voir SurveyInterpretationBridge.ts
// pour la frontière explicite entre analyse et interprétation).
// ============================================================

import type { SurveyQuestion, SurveyQuestionFrequency, SurveyStats } from "./SurveyTypes";

export interface RawAnswer {
  responseId: string;
  questionId: string;
  optionId?: string | null;
  optionLabel?: string | null;
  valueText?: string | null;
}

const NUMERIC_TYPES = new Set(["number", "age", "scale"]);

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function computeQuestionFrequencies(question: SurveyQuestion, answers: RawAnswer[]): SurveyQuestionFrequency {
  const forThisQuestion = answers.filter((a) => a.questionId === question.id);
  const counts = new Map<string, number>();

  for (const a of forThisQuestion) {
    const label = a.optionLabel ?? a.valueText;
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  // Le dénominateur est le nombre de RÉPONDANTS distincts ayant répondu
  // à cette question, jamais le nombre total de lignes de réponse — pour
  // une question à choix multiple, une même personne peut avoir plusieurs
  // lignes (une par option cochée) ; utiliser le total de lignes comme
  // dénominateur donnerait des pourcentages qui ne somment pas au nombre
  // réel de répondants et laisserait croire à une question à choix unique.
  const respondentCount = new Set(forThisQuestion.map((a) => a.responseId)).size;
  const distribution = [...counts.entries()]
    .map(([label, count]) => ({ label, count, percent: respondentCount > 0 ? Math.round((count / respondentCount) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count);

  const result: SurveyQuestionFrequency = {
    questionId: question.id,
    questionText: question.text,
    type: question.type,
    respondentCount,
    distribution,
  };

  if (NUMERIC_TYPES.has(question.type)) {
    const numericValues = forThisQuestion
      .map((a) => (a.valueText ? Number(a.valueText) : a.optionLabel ? Number(a.optionLabel) : null))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    result.average = mean(numericValues) !== undefined ? Math.round(mean(numericValues)! * 100) / 100 : undefined;
    result.median = median(numericValues);
  }

  return result;
}

export function computeSurveyStats(input: {
  responses: { status: string; startedAt: string }[];
  targetResponses?: number;
}): SurveyStats {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const totalResponses = input.responses.length;
  const completedResponses = input.responses.filter((r) => r.status === "completed").length;
  const todayResponses = input.responses.filter((r) => new Date(r.startedAt) >= startOfToday).length;
  const last24hResponses = input.responses.filter((r) => new Date(r.startedAt) >= last24h).length;

  return {
    totalResponses,
    completedResponses,
    todayResponses,
    last24hResponses,
    targetResponses: input.targetResponses,
    percentOfTarget:
      input.targetResponses && input.targetResponses > 0
        ? Math.round((completedResponses / input.targetResponses) * 1000) / 10
        : undefined,
  };
}

export const AGE_BUCKETS: { key: string; label: string; min: number; max?: number }[] = [
  { key: "18-20", label: "18–20", min: 18, max: 20 },
  { key: "21-24", label: "21–24", min: 21, max: 24 },
  { key: "25-29", label: "25–29", min: 25, max: 29 },
  { key: "30+", label: "30+", min: 30 },
];

/**
 * Tranche d'âge — jamais un âge exact affiché dans une vue agrégée.
 * Renvoie le libellé d'affichage ("18–20"), pas la clé de filtre
 * ("18-20") : cette fonction alimente exclusivement les répartitions
 * affichées, jamais la résolution d'un filtre (voir AGE_BUCKETS.key
 * pour la correspondance avec le paramètre `ageBucket` de l'API).
 */
export function bucketAge(age: number): string | undefined {
  for (const b of AGE_BUCKETS) {
    if (age >= b.min && (b.max === undefined || age <= b.max)) return b.label;
  }
  return undefined;
}

/** Regroupement générique label -> {count, percent} — réutilisé pour institution/faculté/niveau/catégorie/tranche d'âge. */
export function computeBreakdown(labels: (string | null | undefined)[]): { label: string; count: number; percent: number }[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const l of labels) {
    if (!l) continue;
    counts.set(l, (counts.get(l) ?? 0) + 1);
    total++;
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count);
}

/** Évolution du nombre de réponses par jour sur une fenêtre glissante — toujours des jours réellement présents dans la plage, jamais interpolés. */
export function computeTimeline(dates: Date[], days: number): { date: string; count: number }[] {
  const now = new Date();
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const d of dates) {
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

/**
 * Taux de complétion, défini honnêtement : moyenne, sur les questions
 * actuellement obligatoires, de la part des réponses enregistrées qui
 * comportent réellement une réponse à chaque question. Toute réponse
 * enregistrée a déjà passé la validation obligatoire au moment de sa
 * soumission (voir /api/s/[publicId]/responses) — ce taux vaut donc
 * naturellement 100 % sauf lorsqu'une question a été ajoutée après coup
 * à une enquête déjà en cours de collecte (les réponses précédentes ne
 * la couvrent alors pas). Jamais une valeur inventée ; undefined si
 * aucune question obligatoire ou aucune réponse.
 *
 * Le dénominateur de chaque question obligatoire n'est jamais le nombre
 * total de réponses, mais le nombre de réponses pour lesquelles cette
 * question était réellement VISIBLE (logique conditionnelle par
 * catégorie) — sinon une question obligatoire réservée à une seule
 * catégorie de répondants ferait artificiellement chuter le taux, alors
 * même que 100 % des répondants concernés y ont répondu.
 */
export function computeCompletionRate(
  requiredQuestions: { id: string; visibleForCategoryIds?: string[] }[],
  answeredResponseIdsByQuestion: Map<string, Set<string>>,
  responses: { id: string; categoryId?: string }[]
): number | undefined {
  if (requiredQuestions.length === 0 || responses.length === 0) return undefined;
  const ratios = requiredQuestions.map((q) => {
    const visibleForAll = !q.visibleForCategoryIds || q.visibleForCategoryIds.length === 0;
    const eligible = visibleForAll ? responses : responses.filter((r) => r.categoryId && q.visibleForCategoryIds!.includes(r.categoryId));
    if (eligible.length === 0) return undefined;
    const answered = answeredResponseIdsByQuestion.get(q.id)?.size ?? 0;
    return Math.min(1, answered / eligible.length);
  });
  const valid = ratios.filter((r): r is number => r !== undefined);
  if (valid.length === 0) return undefined;
  const avg = valid.reduce((s, r) => s + r, 0) / valid.length;
  return Math.round(avg * 1000) / 10;
}

export type CompareByDimension = "institution" | "faculty" | "level" | "ageBucket" | "category";

/** Résout la valeur d'une réponse pour une dimension de comparaison (P20-A) — jamais une autre question, uniquement les champs de profil déjà collectés. */
export function resolveCompareByLabel(
  response: { institution?: string; faculty?: string; level?: string; age?: number; categoryLabel?: string },
  compareBy: CompareByDimension
): string | undefined {
  switch (compareBy) {
    case "institution":
      return response.institution;
    case "faculty":
      return response.faculty;
    case "level":
      return response.level;
    case "ageBucket":
      return response.age !== undefined ? bucketAge(response.age) : undefined;
    case "category":
      return response.categoryLabel;
    default:
      return undefined;
  }
}

/**
 * Croisement Variable A × Variable B (section 20 — "Comparer").
 * A et B sont deux jeux de réponses déjà résolus en label texte pour
 * la même liste de réponses (responseId aligné) — le tableau croisé
 * ne fait que compter les combinaisons réellement observées.
 */
export function crossTabulate(
  a: { responseId: string; label: string }[],
  b: { responseId: string; label: string }[]
): { rowLabels: string[]; colLabels: string[]; matrix: number[][] } {
  const bByResponse = new Map(b.map((x) => [x.responseId, x.label]));
  const rowLabels = [...new Set(a.map((x) => x.label))].sort();
  const colLabels = [...new Set(b.map((x) => x.label))].sort();

  const matrix = rowLabels.map(() => colLabels.map(() => 0));
  for (const rowEntry of a) {
    const colLabel = bByResponse.get(rowEntry.responseId);
    if (!colLabel) continue;
    const ri = rowLabels.indexOf(rowEntry.label);
    const ci = colLabels.indexOf(colLabel);
    if (ri >= 0 && ci >= 0) matrix[ri][ci] += 1;
  }

  return { rowLabels, colLabels, matrix };
}
