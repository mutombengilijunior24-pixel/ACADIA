// ============================================================
// ACADIA — SURVEY : RAPPORT PDF (P21 export rapide + P22 rapport complet)
//
// Un seul générateur (SurveyReportPDF.ts, @react-pdf/renderer déjà
// utilisé par Research) sert les deux besoins de la mission :
// mode "export" = export PDF rapide des résultats (P21.12),
// mode "report" = rapport d'enquête complet (P22.15, avec
// méthodologie et conclusion). Jamais deux générateurs PDF.
//
// L'interprétation ACADIA (P20-B) n'est pas persistée en base — si le
// client en a déjà généré une pour l'analyse en cours (bouton
// "Interpréter avec ACADIA"), il la transmet dans le corps de la
// requête ; ce endpoint ne la recalcule ni ne l'invente jamais. Sans
// interprétation transmise, le rapport reste strictement factuel.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById } from "@/lib/server/survey/SurveyStore";
import { computeSurveyStatsBundle } from "@/lib/server/survey/SurveyStatsService";
import { exportFileBaseName } from "@/lib/server/survey/SurveyExport";
import { renderSurveyReportPdfBuffer, type SurveyReportInput } from "@/lib/server/survey/SurveyReportPDF";
import { computeCrosstab, CROSSTAB_TYPES, type CrosstabFilters } from "@/lib/server/survey/SurveyCrosstabService";
import { documentStorageProvider } from "@/lib/server/documents/DocumentStorageProvider";
import { prisma } from "@/lib/server/db/prisma";
import type { InterpretationResult } from "@/lib/ai/openai/SurveyInterpretationAI";
import { AGE_BUCKETS, type CompareByDimension } from "@/lib/core/survey/SurveyAnalyticsEngine";

export const runtime = "nodejs";

const OPEN_TYPES = new Set(["short_text", "long_text"]);
const MAX_OPEN_SAMPLES = 5;
const COMPARE_BY_VALUES: CompareByDimension[] = ["institution", "faculty", "level", "ageBucket", "category"];
const COMPARE_BY_LABELS: Record<CompareByDimension, string> = {
  institution: "Institution",
  faculty: "Faculté / École",
  level: "Niveau d'étude",
  ageBucket: "Tranche d'âge",
  category: "Catégorie",
};

interface ReportBody {
  mode?: "export" | "report";
  filters?: {
    institution?: string;
    faculty?: string;
    level?: string;
    categoryId?: string;
    ageBucket?: string;
  };
  questionId?: string;
  compareBy?: CompareByDimension;
  interpretation?: InterpretationResult;
  interpretationContextLabel?: string;
}

function describeFiltersFromBody(filters: ReportBody["filters"], categories: { id: string; label: string }[]): string {
  const parts: string[] = [];
  if (filters?.institution) parts.push(filters.institution);
  if (filters?.faculty) parts.push(filters.faculty);
  if (filters?.level) parts.push(filters.level);
  if (filters?.categoryId) parts.push(categories.find((c) => c.id === filters.categoryId)?.label ?? "Catégorie");
  if (filters?.ageBucket) parts.push(AGE_BUCKETS.find((b) => b.key === filters.ageBucket)?.label ?? filters.ageBucket);
  return parts.length > 0 ? parts.join(", ") : "Ensemble des réponses";
}

async function fetchLogoDataUri(surveyId: string): Promise<string | undefined> {
  const row = await prisma.survey.findUnique({ where: { id: surveyId }, select: { institutionLogoDocumentId: true } });
  if (!row?.institutionLogoDocumentId) return undefined;
  const meta = await documentStorageProvider.getMetadata(row.institutionLogoDocumentId);
  if (!meta || !meta.contentType.startsWith("image/")) return undefined;
  const data = await documentStorageProvider.download(row.institutionLogoDocumentId);
  if (!data) return undefined;
  return `data:${meta.contentType};base64,${Buffer.from(data).toString("base64")}`;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const survey = await getSurveyById(id);
  if (!survey) return notFound();
  if (survey.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  let body: ReportBody;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const mode: "export" | "report" = body.mode === "report" ? "report" : "export";
  const ageRange = body.filters?.ageBucket ? AGE_BUCKETS.find((b) => b.key === body.filters!.ageBucket) : undefined;
  const filtersDescription = describeFiltersFromBody(body.filters, survey.categories);

  const [bundle, logoDataUri] = await Promise.all([
    computeSurveyStatsBundle(survey, {
      institution: body.filters?.institution,
      faculty: body.filters?.faculty,
      level: body.filters?.level,
      categoryId: body.filters?.categoryId,
      ageMin: ageRange?.min,
      ageMax: ageRange?.max,
    }),
    fetchLogoDataUri(survey.id),
  ]);

  // Échantillon plafonné de réponses ouvertes — jamais des centaines de
  // verbatims imprimés, jamais une statistique inventée sur ce contenu.
  const openQuestions = survey.questions.filter((q) => OPEN_TYPES.has(q.type));
  const openQuestionSamples = [] as SurveyReportInput["openQuestionSamples"];
  if (openQuestions.length > 0) {
    const responseIds = bundle.responses.map((r) => r.id);
    const rawOpenAnswers =
      responseIds.length > 0
        ? await prisma.surveyAnswer.findMany({ where: { questionId: { in: openQuestions.map((q) => q.id) }, responseId: { in: responseIds } } })
        : [];
    for (const q of openQuestions) {
      const answers = rawOpenAnswers.filter((a) => a.questionId === q.id && a.valueText?.trim());
      if (answers.length === 0) continue;
      openQuestionSamples.push({ questionText: q.text, totalAnswers: answers.length, samples: answers.slice(0, MAX_OPEN_SAMPLES).map((a) => a.valueText!.trim()) });
    }
  }

  // Croisement inclus uniquement si réellement demandé par l'appelant
  // (le tableau croisé actuellement affiché sur le tableau de bord) —
  // jamais un croisement inventé ou choisi arbitrairement (P21.3/P22.1.5).
  let crosstab: SurveyReportInput["crosstab"];
  if (body.questionId && body.compareBy && COMPARE_BY_VALUES.includes(body.compareBy)) {
    const question = survey.questions.find((q) => q.id === body.questionId);
    if (question && CROSSTAB_TYPES.has(question.type)) {
      const crosstabFilters: CrosstabFilters = {
        institution: body.filters?.institution,
        faculty: body.filters?.faculty,
        level: body.filters?.level,
        categoryId: body.filters?.categoryId,
        ageBucket: body.filters?.ageBucket,
      };
      const result = await computeCrosstab(survey, question, body.compareBy, crosstabFilters);
      crosstab = { ...result, compareByLabel: COMPARE_BY_LABELS[body.compareBy] };
    }
  }

  const pdfInput: SurveyReportInput = {
    survey,
    bundle,
    filtersDescription,
    mode,
    logoDataUri,
    interpretation: body.interpretation,
    interpretationContextLabel: body.interpretationContextLabel,
    crosstab,
    openQuestionSamples,
  };

  const buffer = await renderSurveyReportPdfBuffer(pdfInput);

  await prisma.surveyEvent.create({ data: { surveyId: survey.id, type: "exported", metadata: JSON.stringify({ format: "pdf", mode }) } });

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${exportFileBaseName(survey.title)}-${mode === "report" ? "rapport" : "export"}.pdf"`,
    },
  });
}
