// ============================================================
// ACADIA — AFFECTATION ÉTUDIANT ↔ DIRECTEUR (P16, migré vers Prisma en P17)
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { SupervisionAssignment } from "@/lib/core/supervision/SupervisionTypes";

function toDomain(row: {
  id: string;
  studentId: string;
  supervisorId: string;
  researchId: string | null;
  status: string;
  createdAt: Date;
  endedAt: Date | null;
}): SupervisionAssignment {
  return {
    id: row.id,
    studentId: row.studentId,
    supervisorId: row.supervisorId,
    researchId: row.researchId ?? undefined,
    status: row.status as SupervisionAssignment["status"],
    createdAt: row.createdAt.toISOString(),
    endedAt: row.endedAt?.toISOString(),
  };
}

export async function createAssignment(input: { studentId: string; supervisorId: string; researchId?: string }): Promise<SupervisionAssignment> {
  const existing = await prisma.supervisionAssignment.findFirst({
    where: { studentId: input.studentId, supervisorId: input.supervisorId, status: "active" },
  });
  if (existing) return toDomain(existing);

  const row = await prisma.supervisionAssignment.create({
    data: { studentId: input.studentId, supervisorId: input.supervisorId, researchId: input.researchId },
  });
  return toDomain(row);
}

export async function listAssignmentsBySupervisor(supervisorId: string): Promise<SupervisionAssignment[]> {
  const rows = await prisma.supervisionAssignment.findMany({ where: { supervisorId, status: "active" } });
  return rows.map(toDomain);
}

export async function listAssignmentsByStudent(studentId: string): Promise<SupervisionAssignment[]> {
  const rows = await prisma.supervisionAssignment.findMany({ where: { studentId, status: "active" } });
  return rows.map(toDomain);
}

export async function isStudentOfSupervisor(studentId: string, supervisorId: string): Promise<boolean> {
  const count = await prisma.supervisionAssignment.count({ where: { studentId, supervisorId, status: "active" } });
  return count > 0;
}

export async function endAssignment(id: string, supervisorId: string): Promise<boolean> {
  const found = await prisma.supervisionAssignment.findFirst({ where: { id, supervisorId } });
  if (!found) return false;
  await prisma.supervisionAssignment.update({ where: { id }, data: { status: "ended", endedAt: new Date() } });
  return true;
}
