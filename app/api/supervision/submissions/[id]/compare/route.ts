// ============================================================
// ACADIA — COMPARAISON DE VERSIONS (P16)
// ============================================================

import { getSubmissionById } from "@/lib/supervision/SubmissionStore";
import { listCorrectionsBySubmission } from "@/lib/supervision/CorrectionStore";
import { compareSubmissions, applyCorrectionsToComparison } from "@/lib/core/supervision/RevisionComparisonEngine";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const submission = await getSubmissionById(id);
  if (!submission) return notFound();
  if (submission.studentId !== user.id && submission.supervisorId !== user.id) {
    return forbidden("Vous n'avez pas accès à cette soumission.", { actorId: user.id, entityType: "Submission", entityId: id });
  }

  if (!submission.previousSubmissionId) {
    return Response.json({ comparison: null, reason: "Aucune version précédente à comparer." }, { status: 200 });
  }

  const previous = await getSubmissionById(submission.previousSubmissionId);
  if (!previous) {
    return Response.json({ comparison: null, reason: "Version précédente introuvable." }, { status: 200 });
  }

  const allCorrections = await listCorrectionsBySubmission(previous.id);
  const openCorrections = allCorrections.filter((c) => c.status === "open");
  const { comparison: rawComparison, touchedSectionKeys } = compareSubmissions(previous, submission);
  const comparison = applyCorrectionsToComparison(rawComparison, openCorrections, touchedSectionKeys);

  return Response.json({ comparison }, { status: 200 });
}
