// ============================================================
// ACADIA — LECTURE DU PLAN D'ANALYSE (Module 4, incrément 1)
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord } from "@/lib/server/research/ResearchStateService";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  if (!record.project.analysisPlan) {
    return Response.json({ error: "Aucun plan d'analyse généré pour ce projet." }, { status: 404 });
  }

  return Response.json({ plan: record.project.analysisPlan }, { status: 200 });
}
