// ============================================================
// ACADIA — SERVICE D'ENTITLEMENTS (mission Conversion + Pay-as-you-progress)
//
// Point UNIQUE de vérité pour "cet utilisateur a-t-il débloqué cette
// capacité pour ce projet ?" et pour le flux de déblocage lui-même.
// Réutilise : Prisma (modèles Entitlement/Payment), ProductEvents
// (nouveaux types dédiés), AuditLog (traçabilité), PricingConfig
// (bascule bêta centralisée — jamais un `if (beta)` local ici ou
// ailleurs).
//
// Le flux CHECKOUT→PAYMENT→ENTITLEMENT est TOUJOURS le même, bêta ou
// non — seul le montant et la réussite immédiate changent (bêta :
// prix 0, succès instantané ; futur fournisseur réel : montant réel,
// succès asynchrone via webhook). Rien à réécrire dans les appelants
// quand un vrai moyen de paiement sera branché.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { Entitlement, Payment } from "@prisma/client";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { getEffectivePriceUsd, isBetaMode, type EntitlementKey } from "./PricingConfig";

export interface EntitlementRecord {
  id: string;
  userId: string;
  projectId: string | null;
  key: EntitlementKey;
  status: string;
  source: string;
  grantedAt: Date;
}

export interface PaymentRecord {
  id: string;
  status: string;
  amountUsd: number;
  currency: string;
  provider: string;
  failureReason: string | null;
}

// Prisma ne permet pas de cibler une contrainte @@unique composite
// contenant un champ nullable via findUnique en lui passant réellement
// `null` (le type généré exige une string) — sentinelle stable plutôt
// que de perdre la garantie d'unicité en repli sur findFirst/findMany.
// La colonne projectId reste nullable en base (aucune contrainte
// perdue pour un usage direct hors de ce service).
const ACCOUNT_SCOPE = "__account__";

function normalizeProjectId(projectId?: string | null): string {
  return projectId ?? ACCOUNT_SCOPE;
}

/** true si l'entitlement est actif pour (userId, projectId, key). */
export async function hasEntitlement(
  userId: string,
  projectId: string | null | undefined,
  key: EntitlementKey
): Promise<boolean> {
  const entitlement = await prisma.entitlement.findUnique({
    where: {
      userId_projectId_key: {
        userId,
        projectId: normalizeProjectId(projectId),
        key,
      },
    },
  });
  return Boolean(entitlement && entitlement.status === "active");
}

export async function listEntitlements(
  userId: string,
  projectId: string | null | undefined
): Promise<EntitlementRecord[]> {
  const rows = await prisma.entitlement.findMany({
    where: { userId, projectId: normalizeProjectId(projectId) },
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    projectId: r.projectId,
    key: r.key as EntitlementKey,
    status: r.status,
    source: r.source,
    grantedAt: r.grantedAt,
  }));
}

export interface CheckoutInput {
  userId: string;
  projectId?: string | null;
  key: EntitlementKey;
  /** Empêche un double clic/double soumission de créer deux transactions distinctes. */
  idempotencyKey: string;
}

export interface CheckoutResult {
  payment: PaymentRecord;
  entitlement: EntitlementRecord | null;
  /** true si l'entitlement était déjà actif avant cet appel — aucun nouveau paiement créé. */
  alreadyGranted: boolean;
}

/**
 * Exécute le flux complet CHECKOUT → PAIEMENT → ENTITLEMENT. Toujours
 * appelé depuis une route qui a déjà vérifié l'authentification —
 * ce service ne vérifie pas la session, seulement l'idempotence et
 * l'état déjà acquis.
 */
export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  const projectId = normalizeProjectId(input.projectId);

  // Idempotence forte : une requête déjà traitée avec cette clé ne
  // crée jamais un second paiement (mission §7 : "double paiement").
  const existingPayment = await prisma.payment.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existingPayment) {
    const entitlement = await prisma.entitlement.findUnique({
      where: { userId_projectId_key: { userId: input.userId, projectId, key: input.key } },
    });
    return {
      payment: toPaymentRecord(existingPayment),
      entitlement: entitlement ? toEntitlementRecord(entitlement) : null,
      alreadyGranted: Boolean(entitlement && entitlement.status === "active"),
    };
  }

  // Déjà débloqué (ex. re-clic après succès, ou octroi antérieur) :
  // ne relance jamais un paiement pour rien.
  const existingEntitlement = await prisma.entitlement.findUnique({
    where: { userId_projectId_key: { userId: input.userId, projectId, key: input.key } },
  });
  if (existingEntitlement && existingEntitlement.status === "active") {
    return {
      payment: {
        id: "already-granted",
        status: "succeeded",
        amountUsd: 0,
        currency: "USD",
        provider: "n/a",
        failureReason: null,
      },
      entitlement: toEntitlementRecord(existingEntitlement),
      alreadyGranted: true,
    };
  }

  await trackProductEvent({
    userId: input.userId,
    projectId: projectId ?? undefined,
    eventType: "CHECKOUT_STARTED",
    metadata: { entitlementKey: input.key },
  });

  const amountUsd = getEffectivePriceUsd(input.key);
  const beta = isBetaMode();

  // Bêta (ou tout prix à 0) : succès immédiat, provider "beta_free" —
  // aucun fournisseur réel à attendre. Hors bêta avec un prix réel :
  // aucun fournisseur n'est encore branché dans ce projet (voir
  // rapport, "limites") — la transaction reste "pending" plutôt que
  // de fabriquer un faux succès.
  const willSucceedImmediately = beta || amountUsd === 0;

  const payment = await prisma.payment.create({
    data: {
      userId: input.userId,
      projectId,
      entitlementKey: input.key,
      amountUsd,
      currency: "USD",
      status: willSucceedImmediately ? "succeeded" : "pending",
      provider: willSucceedImmediately ? "beta_free" : "manual_pending",
      idempotencyKey: input.idempotencyKey,
    },
  });

  if (!willSucceedImmediately) {
    // Pas de fournisseur réel branché — transaction en attente,
    // jamais d'entitlement accordé sans paiement effectivement réussi.
    return { payment: toPaymentRecord(payment), entitlement: null, alreadyGranted: false };
  }

  await trackProductEvent({
    userId: input.userId,
    projectId: projectId ?? undefined,
    eventType: "PAYMENT_SUCCEEDED",
    metadata: { entitlementKey: input.key, amountUsd, provider: payment.provider },
  });

  const entitlement = await prisma.entitlement.upsert({
    where: { userId_projectId_key: { userId: input.userId, projectId, key: input.key } },
    create: {
      userId: input.userId,
      projectId,
      key: input.key,
      status: "active",
      source: beta ? "beta_free" : "payment",
      paymentId: payment.id,
    },
    update: {
      status: "active",
      source: beta ? "beta_free" : "payment",
      paymentId: payment.id,
    },
  });

  await trackProductEvent({
    userId: input.userId,
    projectId: projectId ?? undefined,
    eventType: "ENTITLEMENT_GRANTED",
    metadata: { entitlementKey: input.key, source: entitlement.source },
  });

  await logAudit({
    actorId: input.userId,
    action: "ENTITLEMENT_GRANTED",
    entityType: "Entitlement",
    entityId: entitlement.id,
    metadata: { key: input.key, projectId, amountUsd, provider: payment.provider },
  });

  return {
    payment: toPaymentRecord(payment),
    entitlement: toEntitlementRecord(entitlement),
    alreadyGranted: false,
  };
}

/**
 * Erreur levée par ensureEntitlement quand aucun déblocage n'existe
 * et qu'aucun octroi automatique n'est possible (hors bêta, prix
 * réel) — la route appelante la traduit en réponse 402.
 */
export class EntitlementRequiredError extends Error {
  constructor(public readonly key: EntitlementKey) {
    super(`Entitlement requis : ${key}`);
  }
}

/**
 * Garde à poser en tête d'une route protégée. Pendant la bêta (prix
 * effectif 0), débloque automatiquement au premier usage — jamais un
 * `if (beta)` dispersé dans chaque route, cette fonction est le SEUL
 * endroit qui encode cette règle. Hors bêta, lève EntitlementRequiredError
 * si rien n'est débloqué : la route doit alors répondre 402, jamais
 * accorder silencieusement l'accès.
 */
export async function ensureEntitlement(
  userId: string,
  projectId: string | null | undefined,
  key: EntitlementKey
): Promise<EntitlementRecord> {
  const granted = await hasEntitlement(userId, projectId, key);
  if (granted) {
    const entitlement = await prisma.entitlement.findUnique({
      where: { userId_projectId_key: { userId, projectId: normalizeProjectId(projectId), key } },
    });
    return toEntitlementRecord(entitlement!);
  }

  if (!isBetaMode() && getEffectivePriceUsd(key) > 0) {
    throw new EntitlementRequiredError(key);
  }

  const result = await checkout({
    userId,
    projectId,
    key,
    // Déterministe par (utilisateur, projet, clé) : un octroi
    // automatique ne doit jamais produire deux paiements distincts
    // pour la même capacité, même si ensureEntitlement est appelée
    // plusieurs fois en parallèle.
    idempotencyKey: `auto:${userId}:${normalizeProjectId(projectId) ?? "account"}:${key}`,
  });

  if (!result.entitlement) {
    throw new EntitlementRequiredError(key);
  }

  return result.entitlement;
}

function toPaymentRecord(payment: Payment): PaymentRecord {
  return {
    id: payment.id,
    status: payment.status,
    amountUsd: Number(payment.amountUsd.toString()),
    currency: payment.currency,
    provider: payment.provider,
    failureReason: payment.failureReason,
  };
}

function toEntitlementRecord(entitlement: Entitlement): EntitlementRecord {
  return {
    id: entitlement.id,
    userId: entitlement.userId,
    // Dé-normalise la sentinelle "aucun projet" (voir ACCOUNT_SCOPE) —
    // l'implémentation interne ne doit jamais fuiter vers l'appelant.
    projectId: entitlement.projectId === ACCOUNT_SCOPE ? null : entitlement.projectId,
    key: entitlement.key as EntitlementKey,
    status: entitlement.status,
    source: entitlement.source,
    grantedAt: entitlement.grantedAt,
  };
}
