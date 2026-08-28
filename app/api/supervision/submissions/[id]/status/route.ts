// ============================================================
// ACADIA — VALIDATION / DEMANDE DE RÉVISION (P16)
// ============================================================

import { getSubmissionById, updateSubmissionStatus } from "@/lib/supervision/SubmissionStore";
import { createNotification } from "@/lib/supervision/NotificationStore";
import { createMessage } from "@/lib/supervision/MessageStore";
import { hasSupervisionCapability } from "@/lib/core/entitlements/EntitlementEngine";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import type { SubmissionStatus } from "@/lib/core/supervision/SupervisionTypes";

export const runtime = "nodejs";

const ALLOWED: SubmissionStatus[] = ["accepted", "revision_required", "under_review"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!hasSupervisionCapability(user.role, "canReviewSubmission"))
    return forbidden("Réservé aux comptes directeur.", { actorId: user.id, entityType: "Submission" });

  const { id } = await context.params;
  const submission = await getSubmissionById(id);
  if (!submission) return notFound();
  if (submission.supervisorId !== user.id)
    return forbidden("Vous n'êtes pas le directeur de cette soumission.", { actorId: user.id, entityType: "Submission", entityId: id });

  let body: { status?: SubmissionStatus };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!body.status || !ALLOWED.includes(body.status)) {
    return Response.json({ error: "Statut invalide." }, { status: 400 });
  }

  const updated = await updateSubmissionStatus(id, user.id, body.status, user.id);
  if (!updated) return notFound();

  if (body.status === "accepted") {
    await createNotification({
      userId: submission.studentId,
      type: "correction_resolved",
      title: "Version validée par votre directeur",
      body: `Votre directeur a validé la version ${submission.version} de « ${submission.snapshot.project.title} ».`,
      relatedResearchId: submission.researchId,
      relatedSubmissionId: submission.id,
    });
    await createMessage({
      senderId: user.id,
      recipientId: submission.studentId,
      researchId: submission.researchId,
      submissionId: submission.id,
      subject: "Version validée",
      body: `Votre directeur a validé la version ${submission.version}.`,
      type: "validation",
      priority: "high",
    });
  } else if (body.status === "revision_required") {
    await createNotification({
      userId: submission.studentId,
      type: "correction_requested",
      title: "Nouvelle correction demandée",
      body: `Votre directeur demande une nouvelle version de « ${submission.snapshot.project.title} ».`,
      relatedResearchId: submission.researchId,
      relatedSubmissionId: submission.id,
    });
  }

  return Response.json({ submission: updated }, { status: 200 });
}
