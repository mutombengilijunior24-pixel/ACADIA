// ============================================================
// ACADIA — SURVEY : LISTE / CRÉATION
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { listSurveysByOwner, createSurvey } from "@/lib/server/survey/SurveyStore";
import { generateSurveyStructure, generateSurveyDescription, slugify, type SurveyBriefInput } from "@/lib/core/survey/SurveyGenerationEngine";
import { controlQuestionnaireQuality } from "@/lib/core/survey/SurveyQualityControl";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import { classifyAIError, sanitizeMessage, AI_USER_FACING_ERROR } from "@/lib/ai/openai/errorClassification";
import type { ExtractedQuestion } from "@/lib/ai/openai/SurveyDocumentAI";

interface ImportedQuestionnaireInput {
  title: string;
  description?: string;
  categories?: string[];
  questions: ExtractedQuestion[];
}

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const surveys = await listSurveysByOwner(user.id);
  return Response.json({ surveys }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const limit = rateLimiter.check(rateLimitKey("survey-create", user.id), 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop d'enquêtes créées récemment. Réessayez plus tard." }, { status: 429 });
  }

  let body: { brief?: SurveyBriefInput; imported?: ImportedQuestionnaireInput };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  // Chemin "Importer un questionnaire" : les questions ont déjà été
  // extraites (et éventuellement restructurées) côté client — on ne
  // relance jamais la génération IA, on enregistre directement, après
  // le même contrôle qualité que la génération guidée.
  if (body.imported) {
    const imported = body.imported;
    if (!imported.title?.trim() || !Array.isArray(imported.questions) || imported.questions.length === 0) {
      return Response.json({ error: "Titre et au moins une question sont requis." }, { status: 400 });
    }

    const categories = (imported.categories ?? []).map((label, i) => ({ label, order: i }));
    const generatedQuestions = imported.questions.map((q, i) => ({
      section: q.section || "Questionnaire importé",
      order: i,
      type: q.type,
      text: q.text,
      required: q.required ?? true,
      options: q.options?.length ? q.options.map((o, oi) => ({ label: o.label, value: slugify(o.label, oi), order: oi })) : undefined,
    }));

    const qualityControl = controlQuestionnaireQuality(generatedQuestions);

    const survey = await createSurvey({
      ownerId: user.id,
      title: imported.title.trim(),
      description: imported.description,
      categories,
      questions: qualityControl.questions,
    });

    await logAudit({ actorId: user.id, action: "SURVEY_CREATED", entityType: "Survey", entityId: survey.id, metadata: { source: "import" } });

    return Response.json({ survey, warnings: qualityControl.warnings }, { status: 201 });
  }

  const brief = body.brief;
  if (!brief || !brief.title?.trim()) {
    return Response.json({ error: "Le titre de l'enquête est requis." }, { status: 400 });
  }

  // Le bloc de profil est déterministe ; le bloc de contenu est produit
  // par le moteur méthodologique IA (lib/ai/openai/SurveyQuestionnaireAI.ts).
  // Toujours modifiable ensuite avant publication. Un contrôle qualité
  // (doublons, quasi-doublons, options manquantes) est appliqué avant
  // l'enregistrement. En cas d'échec IA, on ne crée JAMAIS d'enquête
  // dégradée — l'échec est propagé pour que l'utilisateur voie une
  // erreur claire et un bouton "Réessayer", jamais un frontend figé.
  await trackProductEvent({ userId: user.id, eventType: "QUESTIONNAIRE_GENERATION_STARTED" });

  let generated;
  try {
    generated = await generateSurveyStructure(brief);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Une erreur inattendue est survenue pendant la génération.";
    console.error("ACADIA — SURVEY GENERATION ERROR:", sanitizeMessage(rawMessage));
    const classified = classifyAIError(rawMessage);
    return Response.json({ error: AI_USER_FACING_ERROR, code: classified.code }, { status: 502 });
  }

  const qualityControl = controlQuestionnaireQuality(generated.questions, { objective: brief.objective, problem: brief.problem });
  const description = generateSurveyDescription(brief);

  const survey = await createSurvey({
    ownerId: user.id,
    title: brief.title.trim(),
    description,
    objective: brief.objective,
    problem: brief.problem,
    targetAudience: brief.targetAudience,
    institution: brief.institution,
    isAnonymous: brief.isAnonymous,
    categories: generated.categories,
    questions: qualityControl.questions,
  });

  await logAudit({ actorId: user.id, action: "SURVEY_CREATED", entityType: "Survey", entityId: survey.id });

  return Response.json({ survey, warnings: qualityControl.warnings }, { status: 201 });
}
