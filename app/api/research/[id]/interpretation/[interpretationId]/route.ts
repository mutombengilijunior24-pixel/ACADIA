// ============================================================
// ACADIA — LECTURE D'UNE INTERPRÉTATION SCIENTIFIQUE (Mission 6, incrément 1)
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord } from "@/lib/server/research/ResearchStateService";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string; interpretationId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, interpretationId } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const interpretation = (record.project.scientificInterpretations ?? []).find((i) => i.id === interpretationId);
  if (!interpretation) return notFound("Interprétation introuvable.");

  return Response.json({ interpretation }, { status: 200 });
}
