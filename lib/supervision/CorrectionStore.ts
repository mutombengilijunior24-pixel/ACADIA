// ============================================================
// ACADIA — SUIVI DES CORRECTIONS (P16, migré vers Prisma en P17)
// ============================================================

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/server/db/prisma";
import type { Correction, CorrectionStatus } from "@/lib/core/supervision/SupervisionTypes";

function toDomain(row: {
  id: string;
  submissionId: string;
  section: string;
  description: string;
  severity: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  discussion: string;
}): Correction {
  return {
    id: row.id,
    submissionId: row.submissionId,
    section: row.section,
    description: row.description,
    severity: row.severity as Correction["severity"],
    status: row.status as CorrectionStatus,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString(),
    resolvedBy: row.resolvedBy ?? undefined,
    discussion: JSON.parse(row.discussion),
  };
}

export async function createCorrection(input: {
  submissionId: string;
  section: string;
  description: string;
  severity: Correction["severity"];
}): Promise<Correction> {
  const row = await prisma.correction.create({
    data: {
      submissionId: input.submissionId,
      section: input.section,
      description: input.description,
      severity: input.severity,
    },
  });
  return toDomain(row);
}

export async function listCorrectionsBySubmission(submissionId: string): Promise<Correction[]> {
  const rows = await prisma.correction.findMany({ where: { submissionId } });
  return rows.map(toDomain);
}

export async function getCorrectionById(id: string): Promise<Correction | undefined> {
  const row = await prisma.correction.findUnique({ where: { id } });
  return row ? toDomain(row) : undefined;
}

export async function updateCorrectionStatus(id: string, status: CorrectionStatus, resolvedBy?: string): Promise<Correction | null> {
  const found = await prisma.correction.findUnique({ where: { id } });
  if (!found) return null;
  const row = await prisma.correction.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === "resolved" ? new Date() : found.resolvedAt,
      resolvedBy: status === "resolved" ? resolvedBy : found.resolvedBy,
    },
  });
  return toDomain(row);
}

export async function addCorrectionDiscussion(id: string, authorId: string, body: string): Promise<Correction | null> {
  const found = await prisma.correction.findUnique({ where: { id } });
  if (!found) return null;
  const discussion = JSON.parse(found.discussion);
  discussion.push({ id: randomUUID(), authorId, body, createdAt: new Date().toISOString() });
  const row = await prisma.correction.update({ where: { id }, data: { discussion: JSON.stringify(discussion) } });
  return toDomain(row);
}
