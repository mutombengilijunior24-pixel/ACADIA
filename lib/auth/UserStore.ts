// ============================================================
// ACADIA — MAGASIN UTILISATEURS (P13, migré vers Prisma en P17)
//
// Stockage relationnel réel (SQLite en développement, PostgreSQL
// documenté comme cible de production — voir
// ACADIA_P17_PRODUCTION_ARCHITECTURE.md). Remplace le fichier JSON
// P13 (data/users.json) : mêmes responsabilités, mais désormais
// transactionnel et contraint (email unique au niveau base).
//
// CHANGEMENT DE CONTRAT (P17) : toutes les fonctions deviennent
// asynchrones (Prisma est intrinsèquement asynchrone) — chaque
// appelant a été mis à jour pour `await` ces appels.
// ============================================================

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/server/db/prisma";
import type { PasswordResetToken, StoredUser, UserRole } from "./AuthTypes";

function toStoredUser(row: {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  firstName: string;
  lastName: string | null;
  domain: string | null;
  createdAt: Date;
}): StoredUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role as UserRole,
    firstName: row.firstName,
    lastName: row.lastName ?? undefined,
    domain: row.domain ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

// ------------------------------------------------------------
// UTILISATEURS
// ------------------------------------------------------------

export async function getAllUsers(): Promise<StoredUser[]> {
  const rows = await prisma.user.findMany();
  return rows.map(toStoredUser);
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const normalized = email.trim().toLowerCase();
  const row = await prisma.user.findUnique({ where: { email: normalized } });
  return row ? toStoredUser(row) : undefined;
}

export async function findUserById(id: string): Promise<StoredUser | undefined> {
  const row = await prisma.user.findUnique({ where: { id } });
  return row ? toStoredUser(row) : undefined;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName?: string;
  domain?: string;
  role?: UserRole;
  studentProfile?: { studyLevel?: string; program?: string; institution?: string; faculty?: string; department?: string };
  supervisorProfile?: {
    academicTitle?: string;
    institution?: string;
    faculty?: string;
    department?: string;
    domain?: string;
    specialties?: string;
    activeAcademicYear?: string;
    professionalEmail?: string;
  };
}

export async function createUser(input: CreateUserInput): Promise<StoredUser> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("EMAIL_ALREADY_USED");
  }

  const role: UserRole = input.role ?? "student";

  const row = await prisma.user.create({
    data: {
      email,
      passwordHash: input.passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() || undefined,
      domain: input.domain?.trim() || undefined,
      role,
      ...(role === "student"
        ? {
            studentProfile: {
              create: {
                studyLevel: input.studentProfile?.studyLevel,
                program: input.studentProfile?.program,
                institution: input.studentProfile?.institution,
                faculty: input.studentProfile?.faculty,
                department: input.studentProfile?.department,
              },
            },
          }
        : {}),
      ...(role === "supervisor"
        ? {
            supervisorProfile: {
              create: {
                fullName: `${input.firstName.trim()} ${input.lastName?.trim() ?? ""}`.trim(),
                academicTitle: input.supervisorProfile?.academicTitle,
                institution: input.supervisorProfile?.institution,
                faculty: input.supervisorProfile?.faculty,
                department: input.supervisorProfile?.department,
                domain: input.supervisorProfile?.domain,
                specialties: input.supervisorProfile?.specialties,
                activeAcademicYear: input.supervisorProfile?.activeAcademicYear,
                professionalEmail: input.supervisorProfile?.professionalEmail || email,
                verificationStatus: "pending",
              },
            },
          }
        : {}),
    },
  });

  return toStoredUser(row);
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

// ------------------------------------------------------------
// RÔLE — auto-déclaration, aucune vérification institutionnelle.
// Voir ACADIA_P16_ARCHITECTURE.md §5 / ACADIA_P17 §7.
// ------------------------------------------------------------

export async function setUserRole(userId: string, role: UserRole): Promise<StoredUser | null> {
  try {
    const row = await prisma.user.update({ where: { id: userId }, data: { role } });
    if (role === "supervisor") {
      await prisma.supervisorProfile.upsert({
        where: { userId },
        create: { userId, fullName: `${row.firstName} ${row.lastName ?? ""}`.trim(), verificationStatus: "pending" },
        update: {},
      });
    }
    return toStoredUser(row);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// RÉINITIALISATION DE MOT DE PASSE
//
// Aucun service d'email n'est branché (voir
// ACADIA_P16_EMAIL_ARCHITECTURE.md) : le jeton est renvoyé
// directement à l'appelant, jamais un faux message « email envoyé ».
// ------------------------------------------------------------

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure

export async function createPasswordResetToken(userId: string): Promise<PasswordResetToken> {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  const row = await prisma.passwordResetToken.create({
    data: {
      token: randomBytes(24).toString("hex"),
      userId,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  return { token: row.token, userId: row.userId, expiresAt: row.expiresAt.toISOString(), usedAt: row.usedAt?.toISOString() };
}

export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const found = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!found || found.usedAt) return null;
  if (found.expiresAt.getTime() < Date.now()) return null;

  await prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } });
  return found.userId;
}
