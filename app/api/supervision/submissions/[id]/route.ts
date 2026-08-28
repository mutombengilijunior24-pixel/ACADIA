// ============================================================
// ACADIA — DÉTAIL D'UNE SOUMISSION (P16)
// ============================================================

import { getSubmissionById } from "@/lib/supervision/SubmissionStore";
import { listCorrectionsBySubmission } from "@/lib/supervision/CorrectionStore";
import { getFeedbackBySubmission } from "@/lib/supervision/FeedbackStore";
import { findUserById } from "@/lib/auth/UserStore";
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

  const corrections = await listCorrectionsBySubmission(id);
  const feedback = await getFeedbackBySubmission(id);
  const student = await findUserById(submission.studentId);

  return Response.json(
    {
      submission,
      corrections,
      feedback,
      student: student ? { firstName: student.firstName, lastName: student.lastName ?? "", email: student.email } : null,
    },
    { status: 200 }
  );
}
