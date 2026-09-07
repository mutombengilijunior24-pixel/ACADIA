// ============================================================
// ACADIA — APPLICATION D'UN MAPPING SCIENTIFIQUE (Module 3, incrément 1)
//
// Applique sur UNE colonne un choix explicitement fait par le
// chercheur (accepter une suggestion, corriger, ou rejeter) —
// jamais une écriture automatique de la suggestion elle-même.
// L'appelant (frontend) doit avoir présenté la proposition et
// obtenu une action humaine avant d'appeler cette route.
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, updateDatasetColumnMapping } from "@/lib/server/research/ResearchStateService";
import { logAudit } from "@/lib/server/audit/AuditLog";

export const runtime = "nodejs";

const bodySchema = z.object({
  columnId: z.string().min(1),
  action: z.enum(["confirm", "modify", "reject"]),
  variableId: z.string().optional(),
  dimensionId: z.string().optional(),
  indicatorId: z.string().optional(),
  sourceQuestionId: z.string().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const existing = await getResearchProjectRecord(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  const { columnId, action, variableId, dimensionId, indicatorId, sourceQuestionId } = parsed.data;

  const patch =
    action === "reject"
      ? { mappingStatus: "rejected" as const, mappingSource: "user_defined" as const, mappingConfidence: undefined }
      : {
          variableId,
          dimensionId,
          indicatorId,
          sourceQuestionId,
          mappingStatus: (action === "confirm" ? "confirmed" : "user_modified") as "confirmed" | "user_modified",
          mappingSource: "user_defined" as const,
          mappingConfidence: 1,
        };

  const updated = await updateDatasetColumnMapping(user.id, id, columnId, patch);
  if (!updated) return notFound("Colonne ou dataset introuvable.");

  await logAudit({
    actorId: user.id,
    action: "DATASET_MAPPING_UPDATED",
    entityType: "ResearchProject",
    entityId: id,
    metadata: { columnId, action },
  });

  return Response.json({ dataset: updated }, { status: 200 });
}
