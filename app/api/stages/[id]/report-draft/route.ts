// ============================================================
// MNJ STAGE CONNECT — RAPPORT : PARTIES RÉDIGÉES
//
// POST : ACADIA rédige remerciements, introduction, bilan et
//        conclusion à partir du dossier et des journées validées, puis
//        les enregistre (l'étudiant les relit et les modifie).
// PUT  : parties modifiées par l'étudiant.
// ============================================================

import { writeReportParts } from "@/lib/ai/openai/StageJournalAI";
import { JOURNAL_LIMITS, reportDraftSchema } from "@/lib/core/stages/journal";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { reportInputOf, saveReportDraft, stageErrorResponse } from "@/lib/server/stages/StageService";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!rateLimiter.check(rateLimitKey("stage-report-draft", user.id), JOURNAL_LIMITS.reportsPerDay, 24 * 60 * 60 * 1000).allowed) return Response.json({ error: "Nombre de générations atteint pour aujourd'hui : modifiez le texte à la main." }, { status: 429 });
  const { id } = await context.params;
  let input: Awaited<ReturnType<typeof reportInputOf>>;
  try {
    input = await reportInputOf(user.id, id);
  } catch (error) {
    return stageErrorResponse(error);
  }
  let parts: Awaited<ReturnType<typeof writeReportParts>>;
  try {
    parts = await writeReportParts(input, user.id);
  } catch {
    return Response.json({ error: "La rédaction du rapport est momentanément indisponible : réessayez dans un instant." }, { status: 502 });
  }
  try {
    return Response.json({ application: await saveReportDraft(user.id, id, parts, true) }, { status: 200 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!rateLimiter.check(rateLimitKey("stage-report-save", user.id), 120, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop de tentatives : réessayez dans quelques minutes." }, { status: 429 });
  const parsed = reportDraftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  const { id } = await context.params;
  try {
    return Response.json({ application: await saveReportDraft(user.id, id, parsed.data, false) }, { status: 200 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
