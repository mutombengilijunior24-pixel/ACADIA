// ============================================================
// ACADIA — CANEVAS DE SUPERVISION (P16, migré vers Prisma en P17)
//
// Versionné par année académique : créer le canevas 2026-2027 ne
// détruit jamais celui de 2025-2026 (Partie 4 du sprint P16). Un
// seul canevas `isActive: true` par directeur à la fois.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { SupervisionCanevas, CanevasStep } from "@/lib/core/supervision/SupervisionTypes";

function toDomain(row: {
  id: string;
  supervisorId: string;
  academicYear: string;
  faculty: string | null;
  department: string | null;
  workTypes: string;
  steps: string;
  hypothesisRules: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SupervisionCanevas {
  return {
    id: row.id,
    supervisorId: row.supervisorId,
    academicYear: row.academicYear,
    faculty: row.faculty ?? undefined,
    department: row.department ?? undefined,
    workTypes: JSON.parse(row.workTypes),
    steps: JSON.parse(row.steps),
    hypothesisRules: row.hypothesisRules ? JSON.parse(row.hypothesisRules) : undefined,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCanevasBySupervisor(supervisorId: string): Promise<SupervisionCanevas[]> {
  const rows = await prisma.supervisionCanevas.findMany({
    where: { supervisorId },
    orderBy: { academicYear: "desc" },
  });
  return rows.map(toDomain);
}

export async function getCanevasById(id: string): Promise<SupervisionCanevas | undefined> {
  const row = await prisma.supervisionCanevas.findUnique({ where: { id } });
  return row ? toDomain(row) : undefined;
}

export async function getActiveCanevas(supervisorId: string): Promise<SupervisionCanevas | undefined> {
  const row = await prisma.supervisionCanevas.findFirst({ where: { supervisorId, isActive: true } });
  return row ? toDomain(row) : undefined;
}

export async function createCanevas(input: {
  supervisorId: string;
  academicYear: string;
  faculty?: string;
  department?: string;
  workTypes: SupervisionCanevas["workTypes"];
  steps: Omit<CanevasStep, "id" | "status">[];
  hypothesisRules?: SupervisionCanevas["hypothesisRules"];
  activate?: boolean;
}): Promise<SupervisionCanevas> {
  const activate = input.activate ?? true;

  if (activate) {
    await prisma.supervisionCanevas.updateMany({
      where: { supervisorId: input.supervisorId, isActive: true },
      data: { isActive: false },
    });
  }

  const steps: CanevasStep[] = input.steps.map((s, i) => ({
    ...s,
    id: `step-${Date.now()}-${i}`,
    status: "non_commence",
  }));

  const row = await prisma.supervisionCanevas.create({
    data: {
      supervisorId: input.supervisorId,
      academicYear: input.academicYear,
      faculty: input.faculty,
      department: input.department,
      workTypes: JSON.stringify(input.workTypes),
      steps: JSON.stringify(steps),
      hypothesisRules: input.hypothesisRules ? JSON.stringify(input.hypothesisRules) : null,
      isActive: activate,
    },
  });

  return toDomain(row);
}

export async function updateCanevas(
  id: string,
  supervisorId: string,
  patch: Partial<Pick<SupervisionCanevas, "steps" | "faculty" | "department" | "workTypes" | "hypothesisRules" | "isActive">>
): Promise<SupervisionCanevas | null> {
  const existing = await prisma.supervisionCanevas.findFirst({ where: { id, supervisorId } });
  if (!existing) return null;

  if (patch.isActive) {
    await prisma.supervisionCanevas.updateMany({
      where: { supervisorId, isActive: true, NOT: { id } },
      data: { isActive: false },
    });
  }

  const row = await prisma.supervisionCanevas.update({
    where: { id },
    data: {
      ...(patch.steps ? { steps: JSON.stringify(patch.steps) } : {}),
      ...(patch.faculty !== undefined ? { faculty: patch.faculty } : {}),
      ...(patch.department !== undefined ? { department: patch.department } : {}),
      ...(patch.workTypes ? { workTypes: JSON.stringify(patch.workTypes) } : {}),
      ...(patch.hypothesisRules !== undefined ? { hypothesisRules: patch.hypothesisRules ? JSON.stringify(patch.hypothesisRules) : null } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    },
  });

  return toDomain(row);
}
