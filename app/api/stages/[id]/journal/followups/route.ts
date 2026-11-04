// ============================================================
// MNJ STAGE CONNECT — JOURNAL VOCAL : RELANCES GUIDÉES
//
// 2 ou 3 questions courtes sur ce qui manque au compte rendu (outils,
// résultat, difficulté, apprentissage), d'après les paroles du jour.
// Rien n'est enregistré : l'étudiant y répond par une note vocale.
// ============================================================

import { z } from "zod";

import { followUpQuestions } from "@/lib/ai/openai/StageJournalAI";
import { JOURNAL_LIMITS } from "@/lib/core/stages/journal";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { journalDayInput, stageErrorResponse } from "@/lib/server/stages/StageService";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!rateLimiter.check(rateLimitKey("stage-journal-followups", user.id), JOURNAL_LIMITS.writesPerDay * 2, 24 * 60 * 60 * 1000).allowed) return Response.json({ error: "Nombre de relances atteint pour aujourd'hui." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  const { id } = await context.params;
  let day: Awaited<ReturnType<typeof journalDayInput>>;
  try {
    day = await journalDayInput(user.id, id, parsed.data.day);
  } catch (error) {
    return stageErrorResponse(error);
  }
  try {
    return Response.json({ questions: await followUpQuestions(day.input, user.id) }, { status: 200 });
  } catch {
    return Response.json({ error: "Les questions d'ACADIA sont momentanément indisponibles : vous pouvez passer directement à la rédaction." }, { status: 502 });
  }
}
