// ============================================================
// ACADIA — SOUMISSIONS (P16)
// ============================================================

import { listAssignmentsByStudent } from "@/lib/supervision/AssignmentStore";
import { createSubmission, listSubmissionsByStudent, listSubmissionsBySupervisor } from "@/lib/supervision/SubmissionStore";
import { createNotification } from "@/lib/supervision/NotificationStore";
import { createMessage } from "@/lib/supervision/MessageStore";
import { sendSubmissionNotification } from "@/lib/email/EmailProvider";
import { findUserById } from "@/lib/auth/UserStore";
import { getSessionUser, unauthorized, forbidden } from "@/lib/supervision/apiAuth";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { InstrumentRecord } from "@/contexts/ResearchContext";
import type { TheoreticalFrameworkEntry } from "@/lib/core/research/TheoreticalFrameworkTypes";
import type { Submission } from "@/lib/core/supervision/SupervisionTypes";

export const runtime = "nodejs";

function stripSnapshot(submission: Submission) {
  return {
    id: submission.id,
    researchId: submission.researchId,
    studentId: submission.studentId,
    supervisorId: submission.supervisorId,
    version: submission.version,
    submittedAt: submission.submittedAt,
    status: submission.status,
    studentMessage: submission.studentMessage,
    reviewedAt: submission.reviewedAt,
    feedbackId: submission.feedbackId,
    previousSubmissionId: submission.previousSubmissionId,
    researchTitle: submission.snapshot.project.title,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const submissions =
    user.role === "supervisor" ? await listSubmissionsBySupervisor(user.id) : await listSubmissionsByStudent(user.id);

  return Response.json({ submissions: submissions.map(stripSnapshot) }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "student")
    return forbidden("Seul un compte étudiant peut soumettre une version.", { actorId: user.id, entityType: "Submission" });

  const limit = rateLimiter.check(rateLimitKey("submissions", user.id), 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de soumissions envoyées récemment. Réessayez dans quelques minutes." }, { status: 429 });
  }

  let body: {
    researchId?: string;
    project?: ResearchProject;
    instrument?: InstrumentRecord;
    theoreticalFramework?: TheoreticalFrameworkEntry[];
    studentMessage?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!body.researchId || !body.project) {
    return Response.json({ error: "researchId et project sont requis." }, { status: 400 });
  }

  // Le directeur n'est JAMAIS pris depuis le corps de la requête :
  // uniquement depuis une affectation active réelle (Partie 19).
  const assignments = await listAssignmentsByStudent(user.id);
  if (assignments.length === 0) {
    return Response.json({ error: "Aucun directeur associé à votre compte pour le moment." }, { status: 409 });
  }
  const supervisorId = assignments[0].supervisorId;

  const submission = await createSubmission({
    researchId: body.researchId,
    studentId: user.id,
    supervisorId,
    snapshot: {
      project: body.project,
      instrument: body.instrument,
      theoreticalFramework: body.theoreticalFramework ?? [],
    },
    studentMessage: body.studentMessage,
  });

  await logAudit({
    actorId: user.id,
    action: "SUBMISSION_CREATED",
    entityType: "Submission",
    entityId: submission.id,
    metadata: { researchId: submission.researchId, version: submission.version },
  });

  await createNotification({
    userId: supervisorId,
    type: "new_submission",
    title: "Nouvelle soumission reçue",
    body: `${user.firstName} a soumis la version ${submission.version} de « ${body.project.title} ».`,
    relatedResearchId: submission.researchId,
    relatedSubmissionId: submission.id,
  });

  await createMessage({
    senderId: user.id,
    recipientId: supervisorId,
    researchId: submission.researchId,
    submissionId: submission.id,
    subject: `Nouvelle soumission — Version ${submission.version}`,
    body: body.studentMessage || `${user.firstName} a soumis la version ${submission.version} de « ${body.project.title} ».`,
    type: "notification",
    priority: "normal",
  });

  const supervisor = await findUserById(supervisorId);
  const emailResult = supervisor
    ? await sendSubmissionNotification(supervisor.email, user.firstName, body.project.title)
    : { status: "failed" as const };

  return Response.json({ submission: stripSnapshot(submission), email: emailResult }, { status: 201 });
}
