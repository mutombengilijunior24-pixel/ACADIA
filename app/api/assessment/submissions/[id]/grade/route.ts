// ============================================================
// ACADIA — DÉCLENCHEMENT D'UNE CORRECTION IA (mission AI Grading Engine)
//
// Corrige UNE soumission à la fois (jamais un lot inter-classe) —
// réservé à l'enseignant propriétaire de l'assignment (vérifié par
// AIGradingService.gradeSubmission). Chaque réponse est traitée
// indépendamment : une réponse en échec (IA) ne bloque jamais la
// correction des autres réponses de la même copie.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { gradeSubmission } from "@/lib/server/assessment/AIGradingService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// Un déclenchement de correction peut appeler l'IA plusieurs fois (une
// par réponse non déterministe) — limite par enseignant pour éviter
// un coût incontrôlé en cas de boucle/retry cassé côté client, tout en
// restant largement au-dessus d'un usage légitime (corriger plusieurs
// copies d'affilée pendant une session de correction).
const GRADE_RATE_LIMIT = 30;
const GRADE_RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const limit = rateLimiter.check(rateLimitKey("ai-grading", user.id), GRADE_RATE_LIMIT, GRADE_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de corrections déclenchées récemment. Réessayez plus tard." }, { status: 429 });
  }

  const { id } = await context.params;

  let force = false;
  try {
    const body = await request.json();
    force = body?.force === true;
  } catch {
    // Corps vide accepté — force reste false par défaut.
  }

  try {
    const results = await gradeSubmission(user.id, id, { userId: user.id }, { force });
    return Response.json({ results }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
