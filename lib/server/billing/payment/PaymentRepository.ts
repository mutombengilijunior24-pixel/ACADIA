// ============================================================
// ACADIA — PAYMENT REPOSITORY (mission Payment Engine)
//
// Centralise l'accès à prisma.payment.* (audit Mission 1 §D/§6) —
// EntitlementService et PaymentService passent par ce module plutôt
// que d'appeler prisma.payment.* directement. Réutilise le modèle
// Payment existant tel quel (aucune migration de champ, voir
// PaymentStatus.ts) — jamais de modèle parallèle.
//
// Chaque fonction accepte un client Prisma explicite (`db`) — soit le
// singleton `prisma` pour un usage isolé, soit un client de transaction
// (`tx` fourni par prisma.$transaction) pour les mises à jour qui
// doivent rester atomiques avec un octroi d'entitlement (mission §12/§13).
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { Payment, Prisma } from "@prisma/client";
import type { PaymentStatus } from "./PaymentStatus";

/** Client Prisma générique — le singleton `prisma` ou un client de transaction, structurellement compatibles pour les opérations utilisées ici. */
export type PrismaLike = typeof prisma | Prisma.TransactionClient;

export interface CreatePaymentInput {
  userId: string;
  projectId: string;
  entitlementKey: string;
  amountUsd: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerRef?: string | null;
  idempotencyKey: string;
}

export async function findByIdempotencyKey(db: PrismaLike, idempotencyKey: string): Promise<Payment | null> {
  return db.payment.findUnique({ where: { idempotencyKey } });
}

export async function findById(db: PrismaLike, id: string): Promise<Payment | null> {
  return db.payment.findUnique({ where: { id } });
}

/** providerRef n'est pas unique en base (deux providers pourraient théoriquement générer la même chaîne) — on filtre aussi par provider pour éviter toute ambiguïté de corrélation webhook. */
export async function findByProviderRef(db: PrismaLike, provider: string, providerRef: string): Promise<Payment | null> {
  return db.payment.findFirst({ where: { provider, providerRef } });
}

export async function create(db: PrismaLike, input: CreatePaymentInput): Promise<Payment> {
  return db.payment.create({
    data: {
      userId: input.userId,
      projectId: input.projectId,
      entitlementKey: input.entitlementKey,
      amountUsd: input.amountUsd,
      currency: input.currency,
      status: input.status,
      provider: input.provider,
      providerRef: input.providerRef ?? null,
      idempotencyKey: input.idempotencyKey,
    },
  });
}

export interface UpdateStatusInput {
  status: PaymentStatus;
  providerRef?: string | null;
  failureReason?: string | null;
}

export async function updateStatus(db: PrismaLike, id: string, input: UpdateStatusInput): Promise<Payment> {
  return db.payment.update({
    where: { id },
    data: {
      status: input.status,
      ...(input.providerRef !== undefined ? { providerRef: input.providerRef } : {}),
      ...(input.failureReason !== undefined ? { failureReason: input.failureReason } : {}),
    },
  });
}
