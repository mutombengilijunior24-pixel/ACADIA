// ============================================================
// ACADIA — SURVEY : SERVICE PARTAGÉ TABLEAU CROISÉ (P20-A / P20-B)
//
// Un seul calcul de tableau croisé, réutilisé à la fois par
// /api/survey/[id]/crosstab (affichage) et /api/survey/[id]/interpret
// (contexte transmis à ACADIA) — jamais deux implémentations
// séparées du même calcul.
// ============================================================

import { listSurveyResponses } from "./SurveyStore";
import { crossTabulate, resolveCompareByLabel, AGE_BUCKETS, type CompareByDimension } from "@/lib/core/survey/SurveyAnalyticsEngine";
import { prisma } from "@/lib/server/db/prisma";
import type { Survey, SurveyQuestion } from "@/lib/core/survey/SurveyTypes";

export const CROSSTAB_TYPES = new Set(["single_choice", "multiple_choice", "scale", "boolean", "category"]);
export const SMALL_SAMPLE_THRESHOLD = 5;

export interface CrosstabFilters {
  institution?: string;
  faculty?: string;
  level?: string;
  categoryId?: string;
  ageBucket?: string;
}

export interface CrosstabResult {
  rowLabels: string[];
  colLabels: string[];
  matrix: number[][];
  percents: number[][];
  colTotals: Record<string, number>;
  sampleSize: number;
  smallSampleColumns: string[];
  isMultiSelect: boolean;
  variable?: string;
  indicator?: string;
  section?: string;
  questionText: string;
}

export async function computeCrosstab(
  survey: Survey,
  question: SurveyQuestion,
  compareBy: CompareByDimension,
  filters: CrosstabFilters
): Promise<CrosstabResult> {
  const ageRange = filters.ageBucket ? AGE_BUCKETS.find((b) => b.key === filters.ageBucket) : undefined;

  const responses = await listSurveyResponses(survey.id, {
    institution: filters.institution,
    faculty: filters.faculty,
    level: filters.level,
    categoryId: filters.categoryId,
    ageMin: ageRange?.min,
    ageMax: ageRange?.max,
  });
  const responseIds = responses.map((r) => r.id);

  const rawAnswers =
    responseIds.length > 0
      ? await prisma.surveyAnswer.findMany({
          where: { questionId: question.id, responseId: { in: responseIds } },
          include: { option: true },
        })
      : [];

  const rowAnswers = rawAnswers
    .map((a) => ({ responseId: a.responseId, label: a.option?.label ?? a.valueText }))
    .filter((a): a is { responseId: string; label: string } => Boolean(a.label));

  const respondedIds = new Set(rowAnswers.map((a) => a.responseId));

  const colAnswers = responses
    .filter((r) => respondedIds.has(r.id))
    .map((r) => ({ responseId: r.id, label: resolveCompareByLabel(r, compareBy) }))
    .filter((c): c is { responseId: string; label: string } => Boolean(c.label));

  const base = {
    isMultiSelect: question.type === "multiple_choice",
    variable: question.variable,
    indicator: question.indicator,
    section: question.section,
    questionText: question.text,
  };

  if (colAnswers.length === 0) {
    return { rowLabels: [], colLabels: [], matrix: [], percents: [], colTotals: {}, sampleSize: 0, smallSampleColumns: [], ...base };
  }

  const { rowLabels, colLabels, matrix } = crossTabulate(rowAnswers, colAnswers);

  const seenPerCol = new Map<string, Set<string>>();
  for (const c of colAnswers) {
    if (!seenPerCol.has(c.label)) seenPerCol.set(c.label, new Set());
    seenPerCol.get(c.label)!.add(c.responseId);
  }
  const colTotals: Record<string, number> = {};
  for (const label of colLabels) colTotals[label] = seenPerCol.get(label)?.size ?? 0;

  const percents = matrix.map((row) => row.map((count, ci) => (colTotals[colLabels[ci]] > 0 ? Math.round((count / colTotals[colLabels[ci]]) * 1000) / 10 : 0)));
  const smallSampleColumns = colLabels.filter((label) => (colTotals[label] ?? 0) < SMALL_SAMPLE_THRESHOLD);

  return { rowLabels, colLabels, matrix, percents, colTotals, sampleSize: respondedIds.size, smallSampleColumns, ...base };
}
