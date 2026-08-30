// ============================================================
// ACADIA — SURVEY : IMPORTATION D'UN QUESTIONNAIRE (DOCX)
//
// Extraction réelle (mammoth) puis reconnaissance structurée (moteur
// méthodologique IA, même client OpenAI que la génération guidée) —
// ne crée PAS d'enquête ici, retourne uniquement la structure détectée
// pour validation humaine avant tout enregistrement (voir POST
// /api/survey avec `questions` fourni directement).
// ============================================================

import mammoth from "mammoth";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { extractQuestionnaireFromText } from "@/lib/ai/openai/SurveyDocumentAI";
import { classifyAIError, sanitizeMessage, AI_USER_FACING_ERROR } from "@/lib/ai/openai/errorClassification";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 Mo
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const limit = rateLimiter.check(rateLimitKey("survey-import", user.id), 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop d'imports récents. Réessayez plus tard." }, { status: 429 });
  }

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
  if (file.type !== DOCX_MIME && !file.name.toLowerCase().endsWith(".docx")) {
    return Response.json({ error: "Format non pris en charge. Seul le format DOCX est accepté pour le moment." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "Fichier trop volumineux (8 Mo maximum)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawText: string;
  try {
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value.trim();
  } catch {
    return Response.json({ error: "Impossible de lire ce document. Vérifiez qu'il s'agit bien d'un fichier DOCX valide." }, { status: 400 });
  }

  if (!rawText) {
    return Response.json({ error: "Aucun texte n'a pu être extrait de ce document." }, { status: 400 });
  }

  try {
    const questionnaire = await extractQuestionnaireFromText(rawText);
    return Response.json({ questionnaire }, { status: 200 });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Une erreur inattendue est survenue pendant l'analyse du document.";
    console.error("ACADIA — SURVEY IMPORT ERROR:", sanitizeMessage(rawMessage));
    const classified = classifyAIError(rawMessage);
    return Response.json({ error: AI_USER_FACING_ERROR, code: classified.code }, { status: 502 });
  }
}
