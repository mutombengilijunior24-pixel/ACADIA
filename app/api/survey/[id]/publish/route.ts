// ============================================================
// ACADIA — SURVEY : PUBLICATION
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById, publishSurvey } from "@/lib/server/survey/SurveyStore";
import { logAudit } from "@/lib/server/audit/AuditLog";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const existing = await getSurveyById(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  if (existing.questions.length === 0) {
    return Response.json({ error: "Impossible de publier une enquête sans questions." }, { status: 400 });
  }

  const survey = await publishSurvey(id);
  await logAudit({ actorId: user.id, action: "SURVEY_PUBLISHED", entityType: "Survey", entityId: id });

  return Response.json({ survey }, { status: 200 });
}
