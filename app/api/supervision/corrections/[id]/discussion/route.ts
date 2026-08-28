// ============================================================
// ACADIA — DISCUSSION SUR UNE CORRECTION (P16)
// ============================================================

import { getCorrectionById, addCorrectionDiscussion } from "@/lib/supervision/CorrectionStore";
import { getSubmissionById } from "@/lib/supervision/SubmissionStore";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const correction = await getCorrectionById(id);
  if (!correction) return notFound();

  const submission = await getSubmissionById(correction.submissionId);
  if (!submission) return notFound();
  if (submission.studentId !== user.id && submission.supervisorId !== user.id) {
    return forbidden("Vous n'avez pas accès à cette correction.", { actorId: user.id, entityType: "Correction", entityId: id });
  }

  let body: { body?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  if (!body.body?.trim()) return Response.json({ error: "Message vide." }, { status: 400 });

  const updated = await addCorrectionDiscussion(id, user.id, body.body.trim());
  return Response.json({ correction: updated }, { status: 200 });
}
