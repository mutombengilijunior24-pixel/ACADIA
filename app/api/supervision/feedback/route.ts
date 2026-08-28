// ============================================================
// ACADIA — ENVOI DU FEEDBACK STRUCTURÉ (P16)
// ============================================================

import { getSubmissionById, updateSubmissionStatus, attachFeedbackId } from "@/lib/supervision/SubmissionStore";
import { createFeedback } from "@/lib/supervision/FeedbackStore";
import { createCorrection } from "@/lib/supervision/CorrectionStore";
import { createMessage } from "@/lib/supervision/MessageStore";
import { createNotification } from "@/lib/supervision/NotificationStore";
import { sendFeedbackNotification } from "@/lib/email/EmailProvider";
import { findUserById } from "@/lib/auth/UserStore";
import { hasSupervisionCapability } from "@/lib/core/entitlements/EntitlementEngine";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { logAudit } from "@/lib/server/audit/AuditLog";
import type { FeedbackSectionEntry } from "@/lib/core/supervision/SupervisionTypes";

export const runtime = "nodejs";

function formatFeedbackText(
  studentName: string,
  researchTitle: string,
  version: number,
  globalEvaluation: string,
  sections: FeedbackSectionEntry[]
): string {
  const ok = sections.filter((s) => s.state === "ok");
  const toFix = sections.filter((s) => s.state === "a_corriger");
  const blocking = sections.filter((s) => s.state === "bloquant");

  const lines = [
    `ÉTUDIANT : ${studentName}`,
    `TRAVAIL : ${researchTitle}`,
    `VERSION : ${version}`,
    `DATE : ${new Date().toLocaleDateString("fr-FR")}`,
    "",
    "1. POINTS VALIDÉS",
    ...(ok.length ? ok.map((s) => `- ${s.label}${s.comment ? ` : ${s.comment}` : ""}`) : ["(aucun)"]),
    "",
    "2. CORRECTIONS DEMANDÉES",
    ...(toFix.length ? toFix.map((s) => `- ${s.label}${s.comment ? ` : ${s.comment}` : ""}`) : ["(aucune)"]),
    "",
    "3. POINTS BLOQUANTS",
    ...(blocking.length ? blocking.map((s) => `- ${s.label}${s.comment ? ` : ${s.comment}` : ""}`) : ["(aucun)"]),
    "",
    "4. PROCHAINE ÉTAPE",
    globalEvaluation || "(non précisée)",
  ];
  return lines.join("\n");
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!hasSupervisionCapability(user.role, "canReviewSubmission"))
    return forbidden("Réservé aux comptes directeur.", { actorId: user.id, entityType: "Feedback" });

  let body: { submissionId?: string; globalEvaluation?: string; sections?: FeedbackSectionEntry[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!body.submissionId || !body.sections) {
    return Response.json({ error: "submissionId et sections sont requis." }, { status: 400 });
  }

  const submission = await getSubmissionById(body.submissionId);
  if (!submission) return notFound();
  if (submission.supervisorId !== user.id)
    return forbidden("Vous n'êtes pas le directeur de cette soumission.", { actorId: user.id, entityType: "Submission", entityId: submission.id });

  const feedback = await createFeedback({
    submissionId: submission.id,
    supervisorId: user.id,
    globalEvaluation: body.globalEvaluation ?? "",
    sections: body.sections,
  });

  await logAudit({ actorId: user.id, action: "FEEDBACK_CREATED", entityType: "FeedbackEntry", entityId: feedback.id, metadata: { submissionId: submission.id } });

  await attachFeedbackId(submission.id, feedback.id);
  await updateSubmissionStatus(submission.id, user.id, "feedback_ready", user.id);

  // Chaque section marquée "à corriger" ou "bloquant" devient une
  // correction suivie individuellement — dérivée directement de ce
  // que le directeur a saisi, jamais inventée.
  for (const section of body.sections) {
    if (section.state === "a_corriger" || section.state === "bloquant") {
      await createCorrection({
        submissionId: submission.id,
        section: section.label,
        description: section.comment || section.label,
        severity: section.state === "bloquant" ? "bloquante" : "mineure",
      });
    }
  }

  const student = await findUserById(submission.studentId);
  const feedbackText = formatFeedbackText(
    student?.firstName ?? "Chercheur",
    submission.snapshot.project.title,
    submission.version,
    body.globalEvaluation ?? "",
    body.sections
  );

  await createMessage({
    senderId: user.id,
    recipientId: submission.studentId,
    researchId: submission.researchId,
    submissionId: submission.id,
    subject: `Correction V${submission.version} — ${submission.snapshot.project.title}`,
    body: feedbackText,
    type: "feedback",
    priority: "high",
  });

  await createNotification({
    userId: submission.studentId,
    type: "feedback_received",
    title: "Nouveau feedback de votre directeur",
    body: `Votre directeur a envoyé un feedback sur la version ${submission.version}.`,
    relatedResearchId: submission.researchId,
    relatedSubmissionId: submission.id,
  });

  const emailResult = student
    ? await sendFeedbackNotification(student.email, submission.snapshot.project.title)
    : { status: "failed" as const };

  return Response.json({ feedback, feedbackText, email: emailResult }, { status: 201 });
}
