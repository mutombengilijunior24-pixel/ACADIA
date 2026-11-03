// ============================================================
// ACADIA — COMPTES INSCRITS (administration, lecture seule)
//
// Liste paginée et recherche des comptes, avec leur profil étudiant et
// un résumé d'activité (projets, interprétations, candidatures de
// stage). Jamais le mot de passe (ni son empreinte), jamais les
// contenus des projets. Accès réservé aux administrateurs (route).
// ============================================================

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/db/prisma";

export const USER_ROLES = ["student", "supervisor", "admin"] as const;
export type AdminRoleFilter = (typeof USER_ROLES)[number] | "all";

export const ROLE_LABELS: Record<string, string> = { student: "Étudiant", supervisor: "Directeur", admin: "Administrateur" };

export interface AdminUserRow {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  role: string;
  status: string;
  domain: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  institution: string | null;
  faculty: string | null;
  program: string | null;
  studyLevel: string | null;
  city: string | null;
  projects: number;
  interpretations: number;
  stageApplications: number;
}

export interface AdminUsersStats {
  total: number;
  byRole: Record<string, number>;
  newLast7Days: number;
  newLast30Days: number;
  activeLast30Days: number;
}

const DAY = 86_400_000;

function whereOf(q: string, role: AdminRoleFilter): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  if (role !== "all") where.role = role;
  const term = q.trim();
  if (term) {
    where.OR = [
      { email: { contains: term, mode: "insensitive" } },
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { studentProfile: { is: { institution: { contains: term, mode: "insensitive" } } } },
    ];
  }
  return where;
}

const SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  status: true,
  domain: true,
  createdAt: true,
  lastLoginAt: true,
  studentProfile: { select: { institution: true, faculty: true, program: true, studyLevel: true, city: true } },
  _count: { select: { researchProjects: true, journeySessions: true, stageApplications: true } },
} satisfies Prisma.UserSelect;

type Selected = Prisma.UserGetPayload<{ select: typeof SELECT }>;

const toRow = (u: Selected): AdminUserRow => ({
  id: u.id,
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  role: u.role,
  status: u.status,
  domain: u.domain,
  createdAt: u.createdAt.toISOString(),
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  institution: u.studentProfile?.institution ?? null,
  faculty: u.studentProfile?.faculty ?? null,
  program: u.studentProfile?.program ?? null,
  studyLevel: u.studentProfile?.studyLevel ?? null,
  city: u.studentProfile?.city ?? null,
  projects: u._count.researchProjects,
  interpretations: u._count.journeySessions,
  stageApplications: u._count.stageApplications,
});

export async function listUsers(input: { q: string; role: AdminRoleFilter; page: number; pageSize: number }) {
  const where = whereOf(input.q, input.role);
  const [total, users] = await Promise.all([prisma.user.count({ where }), prisma.user.findMany({ where, select: SELECT, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize })]);
  return { total, users: users.map(toRow) };
}

export async function usersStats(now = new Date()): Promise<AdminUsersStats> {
  const [total, grouped, newLast7Days, newLast30Days, activeLast30Days] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * DAY) } } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY) } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: new Date(now.getTime() - 30 * DAY) } } }),
  ]);
  return { total, byRole: Object.fromEntries(grouped.map((g) => [g.role, g._count._all])), newLast7Days, newLast30Days, activeLast30Days };
}

/** Tous les comptes correspondant au filtre, pour l'export (borné). */
export async function exportUsers(q: string, role: AdminRoleFilter, max = 10_000): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({ where: whereOf(q, role), select: SELECT, orderBy: { createdAt: "desc" }, take: max });
  return users.map(toRow);
}

// ------------------------------------------------------------
// Export CSV pour Excel (séparateur « ; », BOM UTF-8). Une cellule
// commençant par = + - @ est neutralisée (injection de formule).
// ------------------------------------------------------------

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { timeZone: "Africa/Lubumbashi", dateStyle: "short", timeStyle: "short" }) : "");

export function usersCsv(rows: AdminUserRow[]): string {
  const head = ["Prénom", "Nom", "E-mail", "Rôle", "Statut", "Domaine", "Établissement", "Faculté", "Filière", "Niveau", "Ville", "Inscrit le", "Dernière connexion", "Projets", "Interprétations", "Candidatures de stage"];
  const lines = rows.map((r) => [r.firstName, r.lastName, r.email, ROLE_LABELS[r.role] ?? r.role, r.status === "active" ? "Actif" : "Désactivé", r.domain, r.institution, r.faculty, r.program, r.studyLevel, r.city, date(r.createdAt), date(r.lastLoginAt), r.projects, r.interpretations, r.stageApplications].map(csvCell).join(";"));
  return `﻿${[head.join(";"), ...lines].join("\r\n")}`;
}
