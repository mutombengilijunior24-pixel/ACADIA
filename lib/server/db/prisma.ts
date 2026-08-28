// ============================================================
// ACADIA — CLIENT PRISMA (P17)
//
// Instance unique réutilisée entre les requêtes (évite d'épuiser
// les connexions en développement avec le rechargement à chaud de
// Next.js — patron standard recommandé par Prisma).
// ============================================================

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
