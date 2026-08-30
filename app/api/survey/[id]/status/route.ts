// ============================================================
// ACADIA — SURVEY : CHANGEMENT DE STATUT (suspendre/clôturer/réactiver)
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById, setSurveyStatus } from "@/lib/server/survey/SurveyStore";
import { logAudit } from "@/lib/server/audit/AuditLog";

export const runtime = "nodejs";

const ALLOWED = ["active", "suspended", "closed", "draft"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const existing = await getSurveyById(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!body.status || !ALLOWED.includes(body.status as (typeof ALLOWED)[number])) {
    return Response.json({ error: "Statut invalide." }, { status: 400 });
  }

  const survey = await setSurveyStatus(id, body.status as (typeof ALLOWED)[number]);
  await logAudit({ actorId: user.id, action: "SURVEY_STATUS_CHANGED", entityType: "Survey", entityId: id, metadata: { status: body.status } });

  return Response.json({ survey }, { status: 200 });
}
