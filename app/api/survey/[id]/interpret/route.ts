// ============================================================
// ACADIA — SURVEY : « INTERPRÉTER AVEC ACADIA » (P20-B)
//
// Prépare un contexte structuré (statistiques déjà calculées côté
// serveur, jamais les réponses individuelles brutes sauf verbatims
// plafonnés pour les questions ouvertes) puis appelle le moteur
// d'interprétation IA (lib/ai/openai/SurveyInterpretationAI.ts, même
// client/modèle OpenAI que la génération et l'import — jamais un
// second système). Recalcule TOUJOURS les statistiques côté serveur à
// partir des filtres reçus — ne fait jamais confiance à un chiffre
// envoyé par le client.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById, listSurveyResponses } from "@/lib/server/survey/SurveyStore";
import { computeCrosstab, CROSSTAB_TYPES, type CrosstabFilters } from "@/lib/server/survey/SurveyCrosstabService";
import { computeQuestionFrequencies, AGE_BUCKETS, type CompareByDimension } from "@/lib/core/survey/SurveyAnalyticsEngine";
import { interpretSurveyResults, type InterpretationContext } from "@/lib/ai/openai/SurveyInterpretationAI";
import { classifyAIError, sanitizeMessage, AI_USER_FACING_ERROR } from "@/lib/ai/openai/errorClassification";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { prisma } from "@/lib/server/db/prisma";

export const runtime = "nodejs";

const COMPARE_BY_VALUES: CompareByDimension[] = ["institution", "faculty", "level", "ageBucket", "category"];
const COMPARE_BY_LABELS: Record<CompareByDimension, string> = {
  institution: "Institution",
  faculty: "Faculté / École",
  level: "Niveau d'étude",
  ageBucket: "Tranche d'âge",
  category: "Catégorie",
};
const OPEN_TYPES = new Set(["short_text", "long_text"]);
const MAX_VERBATIMS_PER_QUESTION = 30;
const SMALL_SURVEY_THRESHOLD = 10;

interface InterpretBody {
  questionId?: string;
  compareBy?: CompareByDimension;
  filters?: CrosstabFilters;
}

function describeFilters(filters: CrosstabFilters, ageLabel?: string, categoryLabel?: string): string {
  const parts: string[] = [];
  if (filters.institution) parts.push(`Institution = ${filters.institution}`);
  if (filters.faculty) parts.push(`Faculté = ${filters.faculty}`);
  if (filters.level) parts.push(`Niveau = ${filters.level}`);
  if (ageLabel) parts.push(`Tranche d'âge = ${ageLabel}`);
  if (categoryLabel) parts.push(`Catégorie = ${categoryLabel}`);
  return parts.length > 0 ? parts.join(", ") : "Aucun filtre — analyse basée sur l'ensemble des réponses.";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const survey = await getSurveyById(id);
  if (!survey) return notFound();
  if (survey.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  const limit = rateLimiter.check(rateLimitKey("survey-interpret", user.id), 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop d'analyses demandées récemment. Réessayez plus tard." }, { status: 429 });
  }

  let body: InterpretBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const filters: CrosstabFilters = body.filters ?? {};
  const ageLabel = filters.ageBucket ? AGE_BUCKETS.find((b) => b.key === filters.ageBucket)?.label : undefined;
  const categoryLabel = filters.categoryId ? survey.categories.find((c) => c.id === filters.categoryId)?.label : undefined;
  const filtersDescription = describeFilters(filters, ageLabel, categoryLabel);

  const surveyContext = {
    title: survey.title,
    description: survey.description,
    objective: survey.objective,
    targetAudience: survey.targetAudience,
  };

  let analysis: InterpretationContext["analysis"];

  if (body.questionId && body.compareBy && COMPARE_BY_VALUES.includes(body.compareBy)) {
    // Mode tableau croisé : une variable précise × une dimension de comparaison.
    const question = survey.questions.find((q) => q.id === body.questionId);
    if (!question) return notFound();
    if (!CROSSTAB_TYPES.has(question.type)) {
      return Response.json({ error: "Cette question ne permet pas d'analyse croisée." }, { status: 400 });
    }

    const crosstab = await computeCrosstab(survey, question, body.compareBy, filters);
    if (crosstab.sampleSize === 0) {
      return Response.json(
        { error: "Votre enquête ne contient pas encore suffisamment de réponses pour produire une interprétation." },
        { status: 400 }
      );
    }

    analysis = {
      mode: "crosstab",
      variable: question.variable || question.text,
      indicator: question.indicator,
      section: question.section,
      compareByLabel: COMPARE_BY_LABELS[body.compareBy],
      filtersDescription,
      sampleSize: crosstab.sampleSize,
      isMultiSelect: crosstab.isMultiSelect,
      smallSampleColumns: crosstab.smallSampleColumns,
      crosstab: {
        questionText: crosstab.questionText,
        rowLabels: crosstab.rowLabels,
        colLabels: crosstab.colLabels,
        percents: crosstab.percents,
        colTotals: crosstab.colTotals,
      },
    };
  } else {
    // Mode vue d'ensemble : toutes les questions, population filtrée.
    const ageRange = filters.ageBucket ? AGE_BUCKETS.find((b) => b.key === filters.ageBucket) : undefined;
    const responses = await listSurveyResponses(id, {
      institution: filters.institution,
      faculty: filters.faculty,
      level: filters.level,
      categoryId: filters.categoryId,
      ageMin: ageRange?.min,
      ageMax: ageRange?.max,
    });

    if (responses.length === 0) {
      return Response.json(
        { error: "Votre enquête ne contient pas encore suffisamment de réponses pour produire une interprétation." },
        { status: 400 }
      );
    }

    const responseIds = responses.map((r) => r.id);
    const rawAnswers = await prisma.surveyAnswer.findMany({
      where: { questionId: { in: survey.questions.map((q) => q.id) }, responseId: { in: responseIds } },
      include: { option: true },
    });

    const frequencies = survey.questions
      .filter((q) => !OPEN_TYPES.has(q.type))
      .map((q) => {
        const freq = computeQuestionFrequencies(
          q,
          rawAnswers.filter((a) => a.questionId === q.id).map((a) => ({ responseId: a.responseId, questionId: a.questionId, optionId: a.optionId, optionLabel: a.option?.label, valueText: a.valueText }))
        );
        return { questionText: q.text, variable: q.variable, indicator: q.indicator, section: q.section, type: q.type, distribution: freq.distribution, average: freq.average, median: freq.median };
      })
      .filter((f) => f.distribution.length > 0);

    // Questions ouvertes : verbatims plafonnés, jamais toutes les réponses individuelles envoyées sans limite.
    const openQuestions = survey.questions
      .filter((q) => OPEN_TYPES.has(q.type))
      .map((q) => {
        const answers = rawAnswers.filter((a) => a.questionId === q.id && a.valueText?.trim());
        return {
          questionText: q.text,
          totalAnswers: answers.length,
          sampleAnswers: answers.slice(0, MAX_VERBATIMS_PER_QUESTION).map((a) => a.valueText!.trim()),
        };
      })
      .filter((q) => q.totalAnswers > 0);

    analysis = {
      mode: "overview",
      filtersDescription,
      sampleSize: responses.length,
      frequencies,
      openQuestions,
    };
  }

  const promptContext: InterpretationContext = { survey: surveyContext, analysis };

  try {
    const interpretation = await interpretSurveyResults(promptContext);
    return Response.json({ interpretation, sampleSize: analysis.sampleSize, filtersDescription, smallSample: analysis.sampleSize < SMALL_SURVEY_THRESHOLD }, { status: 200 });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Une erreur inattendue est survenue pendant l'analyse.";
    console.error("ACADIA — SURVEY INTERPRET ERROR:", sanitizeMessage(rawMessage));
    const classified = classifyAIError(rawMessage);
    return Response.json({ error: AI_USER_FACING_ERROR, code: classified.code }, { status: 502 });
  }
}
