// ============================================================
// ACADIA — SURVEY : CALCUL PARTAGÉ DES STATISTIQUES (P22)
//
// Extrait, sans changement de comportement, le calcul déjà utilisé
// par /api/survey/[id]/stats — pour que les exports (P21) et le
// rapport d'enquête (P22) partagent EXACTEMENT le même calcul,
// jamais une seconde implémentation. Architecture demandée :
// BASE → ANALYTICS ENGINE → RESULTS → REPORT BUILDER, une seule
// source de vérité — ce module EST cette source pour tout ce qui
// suit le calcul des réponses filtrées.
// ============================================================

import { listSurveyResponses, type SurveyResponseFilters } from "./SurveyStore";
import {
  computeQuestionFrequencies,
  computeSurveyStats,
  computeBreakdown,
  computeTimeline,
  computeCompletionRate,
  bucketAge,
} from "@/lib/core/survey/SurveyAnalyticsEngine";
import { prisma } from "@/lib/server/db/prisma";
import type { Survey, SurveyQuestionFrequency, SurveyStats, SurveyResponseSummary } from "@/lib/core/survey/SurveyTypes";

export interface FrequencyWithMeta extends SurveyQuestionFrequency {
  variable?: string;
  indicator?: string;
  section?: string;
}

export interface Breakdown {
  label: string;
  count: number;
  percent: number;
}

export interface SurveyStatsBundle {
  responses: SurveyResponseSummary[];
  stats: SurveyStats;
  frequencies: FrequencyWithMeta[];
  breakdowns: {
    institution: Breakdown[];
    faculty: Breakdown[];
    level: Breakdown[];
    category: Breakdown[];
    ageBucket: Breakdown[];
  };
  timeline: { date: string; count: number }[];
}

export async function computeSurveyStatsBundle(
  survey: Survey,
  filters: SurveyResponseFilters,
  timelineDays = 30
): Promise<SurveyStatsBundle> {
  const responses = await listSurveyResponses(survey.id, filters);
  const responseIds = responses.map((r) => r.id);
  const rawAnswers =
    responseIds.length > 0
      ? await prisma.surveyAnswer.findMany({
          where: { questionId: { in: survey.questions.map((q) => q.id) }, responseId: { in: responseIds } },
          include: { option: true },
        })
      : [];

  const stats = computeSurveyStats({ responses, targetResponses: survey.targetResponses });
  const lastResponseAt = responses[0]?.startedAt; // listSurveyResponses trie déjà par startedAt desc

  const frequencies: FrequencyWithMeta[] = survey.questions.map((q) => ({
    ...computeQuestionFrequencies(
      q,
      rawAnswers
        .filter((a) => a.questionId === q.id)
        .map((a) => ({
          responseId: a.responseId,
          questionId: a.questionId,
          optionId: a.optionId,
          optionLabel: a.option?.label,
          valueText: a.valueText,
        }))
    ),
    variable: q.variable,
    indicator: q.indicator,
    section: q.section,
  }));

  const answeredResponseIdsByQuestion = new Map<string, Set<string>>();
  for (const a of rawAnswers) {
    if (!answeredResponseIdsByQuestion.has(a.questionId)) answeredResponseIdsByQuestion.set(a.questionId, new Set());
    answeredResponseIdsByQuestion.get(a.questionId)!.add(a.responseId);
  }
  const requiredQuestions = survey.questions.filter((q) => q.required).map((q) => ({ id: q.id, visibleForCategoryIds: q.visibleForCategoryIds }));
  const completionRate = computeCompletionRate(requiredQuestions, answeredResponseIdsByQuestion, responses);

  const breakdowns = {
    institution: computeBreakdown(responses.map((r) => r.institution)),
    faculty: computeBreakdown(responses.map((r) => r.faculty)),
    level: computeBreakdown(responses.map((r) => r.level)),
    category: computeBreakdown(responses.map((r) => r.categoryLabel)),
    ageBucket: computeBreakdown(responses.map((r) => (r.age !== undefined ? bucketAge(r.age) : undefined))),
  };

  const timeline = computeTimeline(
    responses.map((r) => new Date(r.startedAt)),
    timelineDays
  );

  return { responses, stats: { ...stats, lastResponseAt, completionRate }, frequencies, breakdowns, timeline };
}
