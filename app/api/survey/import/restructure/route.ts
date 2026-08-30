// ============================================================
// ACADIA — SURVEY : RESTRUCTURATION D'UN QUESTIONNAIRE IMPORTÉ
//
// Ne modifie jamais silencieusement le sens d'une question : renvoie
// systématiquement la paire (originale, proposée) pour que le client
// affiche "Question originale -> Proposition ACADIA" avec Accepter/
// Conserver l'originale — rien n'est appliqué côté serveur ici, aucune
// écriture en base tant que l'enquête n'est pas explicitement créée.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { restructureQuestionnaireWithAI, type ExtractedQuestion } from "@/lib/ai/openai/SurveyDocumentAI";
import { classifyAIError, sanitizeMessage, AI_USER_FACING_ERROR } from "@/lib/ai/openai/errorClassification";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const limit = rateLimiter.check(rateLimitKey("survey-restructure", user.id), 15, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de tentatives récentes. Réessayez plus tard." }, { status: 429 });
  }

  let body: { questions?: ExtractedQuestion[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    return Response.json({ error: "Liste de questions requise." }, { status: 400 });
  }

  try {
    const proposed = await restructureQuestionnaireWithAI(body.questions);
    const pairs = body.questions.map((original, i) => ({
      original,
      proposed: proposed[i] ?? original,
      changed: JSON.stringify(original) !== JSON.stringify(proposed[i] ?? original),
    }));
    return Response.json({ pairs }, { status: 200 });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Une erreur inattendue est survenue pendant la restructuration.";
    console.error("ACADIA — SURVEY RESTRUCTURE ERROR:", sanitizeMessage(rawMessage));
    const classified = classifyAIError(rawMessage);
    return Response.json({ error: AI_USER_FACING_ERROR, code: classified.code }, { status: 502 });
  }
}
