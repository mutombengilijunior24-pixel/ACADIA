// ============================================================
// ACADIA — SERVICE D'ENTITLEMENTS (mission Conversion + Pay-as-you-progress,
// étendu par la mission Payment Engine)
//
// Point UNIQUE de vérité pour "cet utilisateur a-t-il débloqué cette
// capacité pour ce projet ?" et pour le flux de déblocage lui-même.
// Réutilise : Prisma (modèles Entitlement/Payment via PaymentRepository),
// ProductEvents, AuditLog, PricingConfig (bascule bêta centralisée —
// jamais un `if (beta)` local ici ou ailleurs).
//
// Le flux CHECKOUT→PAYMENT→ENTITLEMENT est TOUJOURS le même, bêta ou
// non — seul le montant et la réussite immédiate changent (bêta :
// prix 0, succès instantané ; provider réel hors bêta : montant réel,
// succès asynchrone via webhook, voir lib/server/billing/payment/).
//
// grantEntitlementForPayment() est le SEUL endroit qui crée une ligne
// Entitlement — appelé ici pour le chemin bêta immédiat, et par la route
// webhook (via injection, voir PaymentService.settleFromWebhook) pour le
// chemin provider réel. Jamais dupliqué.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { Entitlement, Payment, Prisma } from "@prisma/client";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { getEffectivePriceUsd, isBetaMode, type EntitlementKey } from "./PricingConfig";
import * as PaymentRepository from "./payment/PaymentRepository";
import { initiateRealCheckout } from "./payment/PaymentService";

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
  /** Référence de transaction côté provider (ex. Mobile Money) — null tant qu'aucun provider réel n'a répondu. Jamais un secret/credential. */
  providerReference: string | null;
  /** Instructions à afficher au chercheur (ex. code USSD) — jamais un secret. */
  instructions: string | null;
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
  // crée jamais un second paiement (mission §7/§8 : "double paiement").
  // La contrainte unique Payment.idempotencyKey reste la garantie de
  // dernier recours en cas de requête concurrente (voir catch ci-dessous).
  const existingPayment = await PaymentRepository.findByIdempotencyKey(prisma, input.idempotencyKey);
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
        providerReference: null,
        instructions: null,
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
  // aucun fournisseur réel à attendre. INCHANGÉ par rapport au
  // comportement actuel — c'est le seul chemin réellement exercé tant
  // que la bêta est active.
  const willSucceedImmediately = beta || amountUsd === 0;

  if (willSucceedImmediately) {
    let payment: Payment;
    try {
      payment = await PaymentRepository.create(prisma, {
        userId: input.userId,
        projectId,
        entitlementKey: input.key,
        amountUsd,
        currency: "USD",
        status: "succeeded",
        provider: "beta_free",
        idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      // Course concurrente (mission §8/§24) : une autre requête avec la
      // MÊME idempotencyKey a créé le paiement entre notre lecture et
      // notre écriture — la contrainte unique Payment.idempotencyKey
      // l'a empêché ici. On récupère le paiement déjà créé plutôt que
      // de propager une erreur 500 au chercheur.
      const concurrent = await PaymentRepository.findByIdempotencyKey(prisma, input.idempotencyKey);
      if (!concurrent) throw error;
      const entitlement = await prisma.entitlement.findUnique({
        where: { userId_projectId_key: { userId: input.userId, projectId, key: input.key } },
      });
      return {
        payment: toPaymentRecord(concurrent),
        entitlement: entitlement ? toEntitlementRecord(entitlement) : null,
        alreadyGranted: Boolean(entitlement && entitlement.status === "active"),
      };
    }

    await trackProductEvent({
      userId: input.userId,
      projectId: projectId ?? undefined,
      eventType: "PAYMENT_SUCCEEDED",
      metadata: { entitlementKey: input.key, amountUsd, provider: payment.provider },
    });

    const entitlement = await grantEntitlementForPayment(prisma, payment);

    return {
      payment: toPaymentRecord(payment),
      entitlement: entitlement ? toEntitlementRecord(entitlement) : null,
      alreadyGranted: false,
    };
  }

  // Hors bêta, prix réel : initie un paiement via le provider
  // actuellement configuré (voir PaymentProviderFactory — mock par
  // défaut tant qu'aucun provider réel n'est câblé). Ne crée JAMAIS
  // d'entitlement ici — seul un webhook authentifié (ou une
  // vérification manuelle) peut faire progresser ce paiement vers
  // "succeeded" (voir lib/server/billing/payment/PaymentService.ts).
  const { payment, instructions } = await initiateRealCheckout({
    userId: input.userId,
    projectId,
    entitlementKey: input.key,
    amountUsd,
    currency: "USD",
    idempotencyKey: input.idempotencyKey,
  });

  return {
    payment: toPaymentRecord(payment, instructions),
    entitlement: null,
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

/**
 * SEUL endroit qui crée/active une ligne Entitlement à partir d'un
 * Payment réussi. Appelée directement ici pour le chemin bêta immédiat,
 * et injectée dans PaymentService.settleFromWebhook pour le chemin
 * webhook (voir app/api/webhooks/payments/[provider]/route.ts) — jamais
 * dupliquée entre les deux chemins.
 *
 * `db` est soit le singleton prisma (chemin bêta, non transactionnel —
 * comportement inchangé), soit un client de transaction Prisma (chemin
 * webhook — mise à jour Payment + Entitlement atomique, audit Mission 1
 * §13). `payment.status` DOIT déjà être "succeeded" au moment de l'appel.
 */
export async function grantEntitlementForPayment(
  db: Prisma.TransactionClient | typeof prisma,
  payment: Payment
): Promise<Entitlement | null> {
  if (payment.status !== "succeeded") return null;

  const key = payment.entitlementKey as EntitlementKey;
  const projectId = normalizeProjectId(payment.projectId);
  const source = payment.provider === "beta_free" ? "beta_free" : "payment";

  const entitlement = await db.entitlement.upsert({
    where: { userId_projectId_key: { userId: payment.userId, projectId, key } },
    create: {
      userId: payment.userId,
      projectId,
      key,
      status: "active",
      source,
      paymentId: payment.id,
    },
    update: {
      status: "active",
      source,
      paymentId: payment.id,
    },
  });

  await trackProductEvent({
    userId: payment.userId,
    projectId: projectId ?? undefined,
    eventType: "ENTITLEMENT_GRANTED",
    metadata: { entitlementKey: key, source: entitlement.source },
  });

  await logAudit({
    actorId: payment.userId,
    action: "ENTITLEMENT_GRANTED",
    entityType: "Entitlement",
    entityId: entitlement.id,
    metadata: { key, projectId, amountUsd: Number(payment.amountUsd.toString()), provider: payment.provider },
  });

  return entitlement;
}

function toPaymentRecord(payment: Payment, instructions: string | null = null): PaymentRecord {
  return {
    id: payment.id,
    status: payment.status,
    amountUsd: Number(payment.amountUsd.toString()),
    currency: payment.currency,
    provider: payment.provider,
    failureReason: payment.failureReason,
    providerReference: payment.providerRef,
    instructions,
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
