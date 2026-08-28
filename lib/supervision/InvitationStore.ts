// ============================================================
// ACADIA — INVITATIONS DE SUPERVISION (P16, migré vers Prisma en P17)
// ============================================================

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/server/db/prisma";
import type { SupervisorInvitation } from "@/lib/core/supervision/SupervisionTypes";

const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 jours

function toDomain(row: {
  id: string;
  code: string;
  supervisorId: string;
  studentEmail: string | null;
  researchId: string | null;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  studentId: string | null;
}): SupervisorInvitation {
  return {
    id: row.id,
    code: row.code,
    supervisorId: row.supervisorId,
    studentEmail: row.studentEmail ?? undefined,
    researchId: row.researchId ?? undefined,
    status: row.status as SupervisorInvitation["status"],
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    usedAt: row.usedAt?.toISOString(),
    studentId: row.studentId ?? undefined,
  };
}

export async function createInvitation(input: { supervisorId: string; studentEmail?: string; researchId?: string }): Promise<SupervisorInvitation> {
  const row = await prisma.supervisorInvitation.create({
    data: {
      code: randomBytes(6).toString("hex"),
      supervisorId: input.supervisorId,
      studentEmail: input.studentEmail,
      researchId: input.researchId,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });
  return toDomain(row);
}

export async function listInvitationsBySupervisor(supervisorId: string): Promise<SupervisorInvitation[]> {
  const rows = await prisma.supervisorInvitation.findMany({ where: { supervisorId }, orderBy: { createdAt: "desc" } });
  return rows.map(toDomain);
}

export async function findInvitationByCode(code: string): Promise<SupervisorInvitation | undefined> {
  const row = await prisma.supervisorInvitation.findUnique({ where: { code } });
  return row ? toDomain(row) : undefined;
}

export async function markInvitationAccepted(code: string, studentId: string): Promise<SupervisorInvitation | null> {
  const found = await prisma.supervisorInvitation.findUnique({ where: { code } });
  if (!found || found.status !== "pending") return null;
  if (found.expiresAt.getTime() < Date.now()) return null;

  const row = await prisma.supervisorInvitation.update({
    where: { code },
    data: { status: "accepted", usedAt: new Date(), studentId },
  });
  return toDomain(row);
}

export async function revokeInvitation(id: string, supervisorId: string): Promise<boolean> {
  const found = await prisma.supervisorInvitation.findFirst({ where: { id, supervisorId } });
  if (!found) return false;
  await prisma.supervisorInvitation.update({ where: { id }, data: { status: "revoked" } });
  return true;
}
