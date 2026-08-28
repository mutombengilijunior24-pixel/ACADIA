// ============================================================
// ACADIA — PROFIL ACADÉMIQUE DU DIRECTEUR (P16, migré vers Prisma en P17)
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { SupervisorProfile } from "@/lib/core/supervision/SupervisionTypes";

function toDomain(row: {
  userId: string;
  fullName: string;
  academicTitle: string | null;
  institution: string | null;
  faculty: string | null;
  department: string | null;
  domain: string | null;
  specialties: string | null;
  activeAcademicYear: string | null;
  isActive: boolean;
  professionalEmail: string | null;
  signature: string | null;
  activeCanevasId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SupervisorProfile & { verificationStatus?: string } {
  return {
    userId: row.userId,
    fullName: row.fullName,
    academicTitle: row.academicTitle ?? undefined,
    institution: row.institution ?? undefined,
    faculty: row.faculty ?? undefined,
    department: row.department ?? undefined,
    domain: row.domain ?? undefined,
    specialties: row.specialties ? row.specialties.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    activeAcademicYear: row.activeAcademicYear ?? undefined,
    isActive: row.isActive,
    professionalEmail: row.professionalEmail ?? undefined,
    signature: row.signature ?? undefined,
    activeCanevasId: row.activeCanevasId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getSupervisorProfile(userId: string): Promise<SupervisorProfile | undefined> {
  const row = await prisma.supervisorProfile.findUnique({ where: { userId } });
  return row ? toDomain(row) : undefined;
}

export async function upsertSupervisorProfile(
  userId: string,
  input: Partial<Omit<SupervisorProfile, "userId" | "createdAt" | "updatedAt">>
): Promise<SupervisorProfile> {
  const specialties = Array.isArray(input.specialties) ? input.specialties.join(",") : undefined;

  const row = await prisma.supervisorProfile.upsert({
    where: { userId },
    create: {
      userId,
      fullName: input.fullName ?? "",
      academicTitle: input.academicTitle,
      institution: input.institution,
      faculty: input.faculty,
      department: input.department,
      domain: input.domain,
      specialties,
      activeAcademicYear: input.activeAcademicYear,
      isActive: input.isActive ?? true,
      professionalEmail: input.professionalEmail,
      signature: input.signature,
      activeCanevasId: input.activeCanevasId,
    },
    update: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.academicTitle !== undefined ? { academicTitle: input.academicTitle } : {}),
      ...(input.institution !== undefined ? { institution: input.institution } : {}),
      ...(input.faculty !== undefined ? { faculty: input.faculty } : {}),
      ...(input.department !== undefined ? { department: input.department } : {}),
      ...(input.domain !== undefined ? { domain: input.domain } : {}),
      ...(specialties !== undefined ? { specialties } : {}),
      ...(input.activeAcademicYear !== undefined ? { activeAcademicYear: input.activeAcademicYear } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.professionalEmail !== undefined ? { professionalEmail: input.professionalEmail } : {}),
      ...(input.signature !== undefined ? { signature: input.signature } : {}),
      ...(input.activeCanevasId !== undefined ? { activeCanevasId: input.activeCanevasId } : {}),
    },
  });

  return toDomain(row);
}
