// ============================================================
// MNJ STAGE CONNECT — JOURNAL VOCAL : RÉDACTION DE LA JOURNÉE
//
// Rédige la journée en sections (1 à 2 pages si la matière le permet)
// à partir des paroles de l'étudiant, de ses journées précédentes et de
// son dossier. Rien n'est enregistré ici : l'étudiant relit, modifie,
// puis valide. Les termes absents de ce qu'il a dit sont rendus
// « à vérifier » (garde-fou sans IA).
// ============================================================

import { z } from "zod";

import { writeDay } from "@/lib/ai/openai/StageJournalAI";
import { joinSections, JOURNAL_LIMITS, unverifiedTerms } from "@/lib/core/stages/journal";
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
  if (!rateLimiter.check(rateLimitKey("stage-journal-write", user.id), JOURNAL_LIMITS.writesPerDay, 24 * 60 * 60 * 1000).allowed) return Response.json({ error: "Nombre de rédactions atteint pour aujourd'hui : modifiez le texte à la main." }, { status: 429 });
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
    const sections = await writeDay(day.input, user.id);
    if (!sections.length) return Response.json({ error: "ACADIA n'a rien pu rédiger à partir de vos paroles : complétez votre note." }, { status: 422 });
    const text = joinSections(sections);
    return Response.json({ sections, text, unverified: unverifiedTerms(text, day.sources) }, { status: 200 });
  } catch {
    return Response.json({ error: "La rédaction est momentanément indisponible : réessayez dans un instant." }, { status: 502 });
  }
}
