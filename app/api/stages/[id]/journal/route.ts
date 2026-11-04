// ============================================================
// MNJ STAGE CONNECT — JOURNAL DE LA JOURNÉE
//
// PUT  : paroles transcrites corrigées par l'étudiant.
// POST : version rédigée relue et VALIDÉE par l'étudiant ; elle devient
//        le compte rendu de la journée (journal, faculté, rapport).
// Le jour même ou le lendemain seulement.
// ============================================================

import { z } from "zod";

import { JOURNAL_LIMITS } from "@/lib/core/stages/journal";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { saveJournalTranscript, stageErrorResponse, validateJournal } from "@/lib/server/stages/StageService";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const transcriptSchema = z.object({ day, transcript: z.string().max(JOURNAL_LIMITS.transcriptMax) });
const validateSchema = z.object({ day, activities: z.string().max(JOURNAL_LIMITS.activitiesMax) });

async function guard(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return { response: unauthorized() };
  if (!rateLimiter.check(rateLimitKey("stage-journal", user.id), 120, 60 * 60 * 1000).allowed) return { response: Response.json({ error: "Trop de tentatives : réessayez dans quelques minutes." }, { status: 429 }) };
  return { user, id: (await context.params).id, body: await request.json().catch(() => null) };
}

export async function PUT(request: Request, context: RouteContext) {
  const g = await guard(request, context);
  if ("response" in g) return g.response;
  const parsed = transcriptSchema.safeParse(g.body);
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  try {
    return Response.json({ application: await saveJournalTranscript(g.user.id, g.id, parsed.data.day, parsed.data.transcript) }, { status: 200 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const g = await guard(request, context);
  if ("response" in g) return g.response;
  const parsed = validateSchema.safeParse(g.body);
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  try {
    return Response.json({ application: await validateJournal(g.user.id, g.id, parsed.data.day, parsed.data.activities) }, { status: 200 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
