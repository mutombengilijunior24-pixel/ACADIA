// ============================================================
// ACADIA — TEACHER DIRECTORY SERVICE (mission Academic Assessment Core)
//
// RÈGLE FONDAMENTALE (mission §4/§20) : un enseignant n'apparaît dans
// un sélecteur de destination QUE SI receivingEnabled=true — jamais par
// défaut, jamais implicite. Ce module ne construit AUCUNE interface
// (mission §31) — seulement la requête que la future UI (mission
// suivante) pourra appeler pour peupler Institution → Faculté →
// Programme → Promotion → Cours → Enseignant.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { TeacherProfile } from "@prisma/client";

export interface TeacherDirectoryFilter {
  institutionId?: string;
  facultyId?: string;
  programId?: string;
}

/** Enseignants éligibles à recevoir des travaux — receivingEnabled=true ET status="active", uniquement (mission §4). */
export async function listReceivingTeachers(filter: TeacherDirectoryFilter = {}): Promise<TeacherProfile[]> {
  return prisma.teacherProfile.findMany({
    where: {
      receivingEnabled: true,
      status: "active",
      ...(filter.institutionId ? { institutionId: filter.institutionId } : {}),
      ...(filter.facultyId ? { facultyId: filter.facultyId } : {}),
      ...(filter.programId ? { programId: filter.programId } : {}),
    },
  });
}

/** Le cours a-t-il un enseignant réellement éligible pour recevoir des travaux ? (mission §20 : dernier maillon de la hiérarchie de sélection). */
export async function getReceivingTeacherForCourse(courseId: string): Promise<TeacherProfile | null> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { teacher: true } });
  if (!course?.teacher) return null;
  if (!course.teacher.receivingEnabled || course.teacher.status !== "active") return null;
  return course.teacher;
}

export async function getOrCreateTeacherProfile(userId: string): Promise<TeacherProfile> {
  const existing = await prisma.teacherProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.teacherProfile.create({ data: { userId } });
}

export async function setReceivingEnabled(userId: string, enabled: boolean): Promise<TeacherProfile> {
  await getOrCreateTeacherProfile(userId);
  return prisma.teacherProfile.update({ where: { userId }, data: { receivingEnabled: enabled } });
}
