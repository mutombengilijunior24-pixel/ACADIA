// ============================================================
// ACADIA — LECTURE D'UNE EXÉCUTION STATISTIQUE (Mission 5, incrément 1)
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord } from "@/lib/server/research/ResearchStateService";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string; runId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, runId } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const run = (record.project.statisticalRuns ?? []).find((r) => r.id === runId);
  if (!run) return notFound("Exécution introuvable.");

  return Response.json({ run }, { status: 200 });
}
