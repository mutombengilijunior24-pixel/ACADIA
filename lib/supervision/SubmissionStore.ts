// ============================================================
// ACADIA — SOUMISSIONS DE VERSIONS (P16, migré vers Prisma en P17)
//
// Une nouvelle soumission n'écrase jamais l'ancienne : chaque
// version reste accessible, chaînée via `previousSubmissionId`.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { Submission, SubmissionStatus, SubmissionSnapshot } from "@/lib/core/supervision/SupervisionTypes";

function toDomain(row: {
  id: string;
  researchId: string;
  studentId: string;
  supervisorId: string;
  version: number;
  snapshot: string;
  submittedAt: Date;
  status: string;
  studentMessage: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  feedbackId: string | null;
  previousSubmissionId: string | null;
}): Submission {
  return {
    id: row.id,
    researchId: row.researchId,
    studentId: row.studentId,
    supervisorId: row.supervisorId,
    version: row.version,
    snapshot: JSON.parse(row.snapshot) as SubmissionSnapshot,
    submittedAt: row.submittedAt.toISOString(),
    status: row.status as SubmissionStatus,
    studentMessage: row.studentMessage ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    reviewedBy: row.reviewedBy ?? undefined,
    feedbackId: row.feedbackId ?? undefined,
    previousSubmissionId: row.previousSubmissionId ?? undefined,
  };
}

export async function listSubmissionsByStudent(studentId: string): Promise<Submission[]> {
  const rows = await prisma.submission.findMany({ where: { studentId }, orderBy: { submittedAt: "desc" } });
  return rows.map(toDomain);
}

export async function listSubmissionsBySupervisor(supervisorId: string): Promise<Submission[]> {
  const rows = await prisma.submission.findMany({ where: { supervisorId }, orderBy: { submittedAt: "desc" } });
  return rows.map(toDomain);
}

export async function getSubmissionById(id: string): Promise<Submission | undefined> {
  const row = await prisma.submission.findUnique({ where: { id } });
  return row ? toDomain(row) : undefined;
}

export async function listSubmissionsForResearch(researchId: string, studentId: string): Promise<Submission[]> {
  const rows = await prisma.submission.findMany({
    where: { researchId, studentId },
    orderBy: { version: "asc" },
  });
  return rows.map(toDomain);
}

// Une contrainte unique en base (researchId, studentId, version) empêche deux
// soumissions concurrentes du même étudiant de partager le même numéro de version
// (lecture-puis-écriture non atomique) — la seconde échoue avec P2002 et relit
// immédiatement le numéro à jour avant de retenter, plutôt que de silencieusement
// dupliquer une version (bug de concurrence réel identifié et corrigé en P18).
const MAX_VERSION_CONFLICT_RETRIES = 5;

export async function createSubmission(input: {
  researchId: string;
  studentId: string;
  supervisorId: string;
  snapshot: SubmissionSnapshot;
  studentMessage?: string;
}): Promise<Submission> {
  for (let attempt = 0; attempt < MAX_VERSION_CONFLICT_RETRIES; attempt++) {
    const previous = await prisma.submission.findFirst({
      where: { researchId: input.researchId, studentId: input.studentId },
      orderBy: { version: "desc" },
    });

    try {
      const row = await prisma.submission.create({
        data: {
          researchId: input.researchId,
          studentId: input.studentId,
          supervisorId: input.supervisorId,
          version: (previous?.version ?? 0) + 1,
          snapshot: JSON.stringify(input.snapshot),
          status: previous ? "resubmitted" : "submitted",
          studentMessage: input.studentMessage,
          previousSubmissionId: previous?.id,
        },
      });
      return toDomain(row);
    } catch (error) {
      const isVersionConflict =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      if (!isVersionConflict || attempt === MAX_VERSION_CONFLICT_RETRIES - 1) throw error;
    }
  }
  throw new Error("Impossible de créer la soumission après plusieurs tentatives (conflit de version).");
}

export async function updateSubmissionStatus(
  id: string,
  supervisorId: string,
  status: SubmissionStatus,
  reviewedBy?: string
): Promise<Submission | null> {
  const existing = await prisma.submission.findFirst({ where: { id, supervisorId } });
  if (!existing) return null;

  const row = await prisma.submission.update({
    where: { id },
    data: { status, reviewedAt: new Date(), reviewedBy },
  });
  return toDomain(row);
}

export async function attachFeedbackId(id: string, feedbackId: string): Promise<void> {
  await prisma.submission.update({ where: { id }, data: { feedbackId } });
}
