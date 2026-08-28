// ============================================================
// ACADIA — CORRECTIONS : MISE À JOUR DE STATUT (P16)
// ============================================================

import { getCorrectionById, updateCorrectionStatus } from "@/lib/supervision/CorrectionStore";
import { getSubmissionById } from "@/lib/supervision/SubmissionStore";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { logAudit } from "@/lib/server/audit/AuditLog";
import type { CorrectionStatus } from "@/lib/core/supervision/SupervisionTypes";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "supervisor")
    return forbidden("Seul le directeur peut mettre à jour le statut d'une correction.", { actorId: user.id, entityType: "Correction" });

  const { id } = await context.params;
  const correction = await getCorrectionById(id);
  if (!correction) return notFound();

  const submission = await getSubmissionById(correction.submissionId);
  if (!submission || submission.supervisorId !== user.id) {
    return forbidden("Vous n'êtes pas le directeur de cette soumission.", { actorId: user.id, entityType: "Correction", entityId: id });
  }

  let body: { status?: CorrectionStatus };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  if (!body.status) return Response.json({ error: "status requis." }, { status: 400 });

  const updated = await updateCorrectionStatus(id, body.status, user.id);

  await logAudit({
    actorId: user.id,
    action: "CORRECTION_UPDATED",
    entityType: "Correction",
    entityId: id,
    metadata: { submissionId: correction.submissionId, status: body.status },
  });

  return Response.json({ correction: updated }, { status: 200 });
}
