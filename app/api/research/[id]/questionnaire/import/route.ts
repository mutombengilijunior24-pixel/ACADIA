// ============================================================
// ACADIA — IMPORT D'UN QUESTIONNAIRE EXISTANT (Bloc D, 11/09/2026)
//
// Même pattern de sécurité que app/api/survey/import/route.ts
// (signature de fichier réelle, taille max, extraction mammoth) —
// réutilise extractQuestionnaireFromText/restructureQuestionnaireWithAI
// (lib/ai/openai/SurveyDocumentAI.ts, non modifiés) puis convertit
// le résultat (vocabulaire Survey) vers GeneratedQuestionnaire
// (vocabulaire recherche) via QuestionnaireSurveyMapping.ts.
//
// Un questionnaire importé n'a, par construction, aucun lien vers
// une variable/dimension/indicateur du ResearchProject (il vient
// d'un document externe, pas de l'opérationnalisation A1/A2) —
// variableId/dimensionId/indicatorId restent volontairement absents,
// jamais inventés.
//
// Ne persiste rien : retourne la structure détectée pour validation/
// édition humaine (même écran d'édition que le questionnaire généré
// par IA), comme pour l'import Survey.
// ============================================================

import mammoth from "mammoth";
import { getSessionUser, unauthorized, notFound, forbidden } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord } from "@/lib/server/research/ResearchStateService";
import { extractQuestionnaireFromText, restructureQuestionnaireWithAI, type ExtractedQuestion } from "@/lib/ai/openai/SurveyDocumentAI";
import { classifyAIError, sanitizeMessage, AI_USER_FACING_ERROR } from "@/lib/ai/openai/errorClassification";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { isZipArchive } from "@/lib/server/files/detectFileType";
import { surveyTypeToResearchType } from "@/lib/core/questionnaire/QuestionnaireSurveyMapping";
import type { GeneratedQuestionnaire } from "@/lib/core/questionnaire/QuestionnaireTypes";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 Mo
const MAX_TEXT_LENGTH = 20000;

type RouteContext = { params: Promise<{ id: string }> };

function toGeneratedQuestionnaire(projectTitle: string, questions: ExtractedQuestion[]): GeneratedQuestionnaire {
  const now = new Date().toISOString();
  return {
    id: `instrument-import-${Date.now()}`,
    title: `Instrument de collecte — ${projectTitle}`,
    description: "Questionnaire importé par le chercheur — non issu de l'opérationnalisation A1/A2.",
    researchType: "quantitative",
    variables: [],
    sections: [
      {
        id: "section-imported",
        title: "Questions importées",
        description: "Questions importées depuis un document ou un texte collé, revues et reformulées par ACADIA.",
        type: "complementary",
        questions: questions.map((q, i) => ({
          id: `Q${i + 1}`,
          number: i + 1,
          sectionId: "section-imported",
          type: surveyTypeToResearchType(q.type),
          text: q.text,
          required: q.required,
          status: "needs_review" as const,
          options: q.options.length > 0 ? q.options.map((o) => ({ label: o.label, value: o.label })) : undefined,
        })),
      },
    ],
    totalQuestions: questions.length,
    estimatedDuration: Math.max(5, Math.ceil(questions.length * 0.4)),
    methodologyNotes: [
      `${questions.length} question(s) importée(s) — aucun lien avec l'opérationnalisation A1/A2 (variable/dimension/indicateur), jamais inventé.`,
    ],
    generatedAt: now,
  };
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const limit = rateLimiter.check(rateLimitKey("questionnaire-import", user.id), 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop d'imports récents. Réessayez plus tard." }, { status: 429 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let rawText: string;

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Aucun fichier reçu." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return Response.json({ error: "Format non pris en charge. Seul le format DOCX est accepté pour le moment." }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return Response.json({ error: "Fichier trop volumineux (8 Mo maximum)." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isZipArchive(buffer)) {
      return Response.json({ error: "Ce fichier n'est pas un document DOCX valide." }, { status: 400 });
    }

    try {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value.trim();
    } catch {
      return Response.json({ error: "Impossible de lire ce document. Vérifiez qu'il s'agit bien d'un fichier DOCX valide." }, { status: 400 });
    }
  } else {
    const body = await request.json().catch(() => ({}));
    rawText = typeof body.text === "string" ? body.text.trim() : "";
    if (rawText.length > MAX_TEXT_LENGTH) {
      return Response.json({ error: `Texte trop long (${MAX_TEXT_LENGTH} caractères maximum).` }, { status: 400 });
    }
  }

  if (!rawText) {
    return Response.json({ error: "Aucun texte n'a pu être extrait." }, { status: 400 });
  }

  try {
    const extracted = await extractQuestionnaireFromText(rawText);
    const restructured = await restructureQuestionnaireWithAI(extracted.questions);
    const questionnaire = toGeneratedQuestionnaire(record.project.title || extracted.title, restructured);
    return Response.json({ questionnaire }, { status: 200 });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Une erreur inattendue est survenue pendant l'analyse du questionnaire.";
    console.error("[ACADIA] Erreur import questionnaire recherche :", sanitizeMessage(rawMessage));
    const classified = classifyAIError(rawMessage);
    return Response.json({ error: AI_USER_FACING_ERROR, code: classified.code }, { status: 502 });
  }
}
