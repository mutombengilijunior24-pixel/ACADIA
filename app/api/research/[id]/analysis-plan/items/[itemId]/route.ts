// ============================================================
// ACADIA — DÉCISION SUR UN ITEM DU PLAN D'ANALYSE (Module 4, incrément 1)
//
// Applique un choix explicite du chercheur (accepter/modifier/
// refuser) sur UN item — jamais une exécution de l'analyse
// elle-même (voir mission Module 4 §30 : Analysis Plan ≠ Analysis
// Execution).
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, updateAnalysisPlanItemRecord } from "@/lib/server/research/ResearchStateService";
import { logAudit } from "@/lib/server/audit/AuditLog";

export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum(["accept", "modify", "reject"]),
  priority: z.enum(["essential", "recommended", "optional", "not_recommended"]).optional(),
  userNote: z.string().max(2000).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string; itemId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, itemId } = await context.params;
  const existing = await getResearchProjectRecord(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  const { action, priority, userNote } = parsed.data;

  const statusByAction = { accept: "accepted", modify: "modified", reject: "rejected" } as const;

  const updatedPlan = await updateAnalysisPlanItemRecord(user.id, id, itemId, {
    status: statusByAction[action],
    ...(priority ? { priority } : {}),
    ...(userNote !== undefined ? { userNote } : {}),
  });
  if (!updatedPlan) return notFound("Item introuvable.");

  await logAudit({
    actorId: user.id,
    action: "ANALYSIS_PLAN_ITEM_UPDATED",
    entityType: "ResearchProject",
    entityId: id,
    metadata: { itemId, action },
  });

  return Response.json({ plan: updatedPlan }, { status: 200 });
}
