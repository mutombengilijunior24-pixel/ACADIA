// ============================================================
// ACADIA — FEEDBACK STRUCTURÉ DU DIRECTEUR (P16, migré vers Prisma en P17)
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { FeedbackEntry } from "@/lib/core/supervision/SupervisionTypes";

function toDomain(row: {
  id: string;
  submissionId: string;
  supervisorId: string;
  globalEvaluation: string;
  sections: string;
  createdAt: Date;
  sentAt: Date | null;
}): FeedbackEntry {
  return {
    id: row.id,
    submissionId: row.submissionId,
    supervisorId: row.supervisorId,
    globalEvaluation: row.globalEvaluation,
    sections: JSON.parse(row.sections),
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString(),
  };
}

export async function createFeedback(input: {
  submissionId: string;
  supervisorId: string;
  globalEvaluation: string;
  sections: FeedbackEntry["sections"];
}): Promise<FeedbackEntry> {
  const row = await prisma.feedbackEntry.create({
    data: {
      submissionId: input.submissionId,
      supervisorId: input.supervisorId,
      globalEvaluation: input.globalEvaluation,
      sections: JSON.stringify(input.sections),
      sentAt: new Date(),
    },
  });
  return toDomain(row);
}

export async function getFeedbackById(id: string): Promise<FeedbackEntry | undefined> {
  const row = await prisma.feedbackEntry.findUnique({ where: { id } });
  return row ? toDomain(row) : undefined;
}

export async function getFeedbackBySubmission(submissionId: string): Promise<FeedbackEntry[]> {
  const rows = await prisma.feedbackEntry.findMany({ where: { submissionId }, orderBy: { createdAt: "desc" } });
  return rows.map(toDomain);
}
