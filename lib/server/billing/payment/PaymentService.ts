// ============================================================
// ACADIA — PAYMENT SERVICE (mission Payment Engine)
//
// Orchestre le cycle de vie d'un paiement RÉEL (hors bêta) :
// PaymentProvider.initiate() → Payment PENDING/PROCESSING → (webhook ou
// vérification manuelle) → SUCCEEDED/FAILED/CANCELLED/EXPIRED.
//
// Ne connaît PAS EntitlementService — l'octroi d'entitlement reste
// entièrement la responsabilité d'EntitlementService (audit Mission 1 :
// "EntitlementService reste la source métier"). settleFromWebhook reçoit
// la fonction d'octroi en paramètre (injection) plutôt que d'importer
// EntitlementService directement, pour ne jamais créer de dépendance
// circulaire entre les deux services — c'est la route webhook (qui
// importe déjà les deux) qui les relie.
//
// RÈGLE ABSOLUE (audit Mission 1 §13) : aucun appel provider n'a jamais
// lieu à l'intérieur d'une transaction Prisma ouverte. initiateRealCheckout
// crée la ligne Payment AVANT d'appeler le provider (nécessaire pour lui
// fournir un paymentId de corrélation), puis la met à jour APRÈS —
// deux écritures séparées, jamais une transaction qui engloberait
// l'appel réseau. settleFromWebhook, lui, ne fait AUCUN appel provider :
// il applique un résultat déjà obtenu (webhook déjà reçu et vérifié).
// ============================================================

import type { Payment, Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db/prisma";
import * as PaymentRepository from "./PaymentRepository";
import { getPaymentProvider } from "./PaymentProviderFactory";
import type { PaymentProvider } from "./PaymentProvider";
import type { PaymentStatus } from "./PaymentStatus";
import { isTerminalPaymentStatus } from "./PaymentStatus";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export interface InitiateRealCheckoutInput {
  userId: string;
  /** Déjà normalisé (sentinelle ACCOUNT_SCOPE gérée par l'appelant — EntitlementService) */
  projectId: string;
  entitlementKey: string;
  amountUsd: number;
  currency: string;
  idempotencyKey: string;
}

export interface InitiateRealCheckoutResult {
  payment: Payment;
  instructions: string | null;
}

/**
 * Initie un paiement réel (hors bêta, montant > 0). Ne crée JAMAIS
 * d'entitlement — voir EntitlementService.checkout, qui reste le seul
 * appelant et ne traite le retour que comme "en attente".
 */
export async function initiateRealCheckout(input: InitiateRealCheckoutInput): Promise<InitiateRealCheckoutResult> {
  const provider = getPaymentProvider();

  // Créé AVANT l'appel provider : fournit un paymentId de corrélation
  // stable, et garantit qu'un Payment existe même si l'appel provider
  // échoue ensuite (traçabilité — jamais une tentative silencieusement
  // perdue).
  //
  // Course concurrente (mission §8/§24, même garde que le chemin bêta
  // dans EntitlementService.checkout) : si une autre requête avec la
  // MÊME idempotencyKey a déjà créé la ligne entre la vérification
  // faite par l'appelant et cet appel, la contrainte unique
  // Payment.idempotencyKey lève une erreur ici — on récupère alors la
  // ligne déjà créée au lieu de propager une erreur 500, et on n'appelle
  // JAMAIS le provider une seconde fois pour la même intention de paiement.
  let payment: Payment;
  try {
    payment = await PaymentRepository.create(prisma, {
      userId: input.userId,
      projectId: input.projectId,
      entitlementKey: input.entitlementKey,
      amountUsd: input.amountUsd,
      currency: input.currency,
      status: "pending",
      provider: provider.name,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    const concurrent = await PaymentRepository.findByIdempotencyKey(prisma, input.idempotencyKey);
    if (!concurrent) throw error;
    return { payment: concurrent, instructions: null };
  }

  try {
    const result = await provider.initiate({
      paymentId: payment.id,
      amountUsd: input.amountUsd,
      currency: input.currency,
      entitlementKey: input.entitlementKey,
      userId: input.userId,
    });

    const updated = await PaymentRepository.updateStatus(prisma, payment.id, {
      status: result.status,
      providerRef: result.providerRef,
    });

    return { payment: updated, instructions: result.instructions ?? null };
  } catch (error) {
    // L'appel provider a échoué (provider non configuré, réseau, etc.) —
    // le Payment reste tracé en "failed" plutôt que de rester "pending"
    // indéfiniment sans explication.
    const failureReason = error instanceof Error ? error.message.slice(0, 300) : "Erreur d'initiation inconnue";
    const updated = await PaymentRepository.updateStatus(prisma, payment.id, {
      status: "failed",
      failureReason,
    });
    await trackProductEvent({
      userId: input.userId,
      projectId: input.projectId,
      eventType: "PAYMENT_FAILED",
      metadata: { entitlementKey: input.entitlementKey, provider: provider.name, reason: failureReason },
    });
    return { payment: updated, instructions: null };
  }
}

export type GrantEntitlementForPayment = (
  db: Prisma.TransactionClient,
  payment: Payment
) => Promise<{ id: string } | null>;

export interface SettleFromWebhookResult {
  payment: Payment;
  entitlementGranted: boolean;
}

/**
 * Applique un résultat DÉJÀ vérifié (webhook authentifié) à un Payment.
 * Toujours appelée à l'intérieur d'un prisma.$transaction (voir la route
 * webhook) — `db` doit être le client de transaction, jamais le
 * singleton `prisma`, pour garantir l'atomicité mise à jour Payment +
 * octroi Entitlement (audit Mission 1 §13).
 */
export async function settleFromWebhook(
  db: Prisma.TransactionClient,
  payment: Payment,
  verified: { status: PaymentStatus; providerRef: string | null },
  grantEntitlement: GrantEntitlementForPayment
): Promise<SettleFromWebhookResult> {
  // Un paiement déjà dans un état terminal ne doit plus jamais être
  // réécrit par un événement tardif/rejoué (ex. webhook dupliqué après
  // qu'un autre ait déjà réglé ce paiement) — l'idempotence WebhookEvent
  // couvre le cas "même événement répété", ceci couvre le cas "deux
  // événements différents pour le même paiement".
  if (isTerminalPaymentStatus(payment.status as PaymentStatus)) {
    return { payment, entitlementGranted: false };
  }

  const updated = await PaymentRepository.updateStatus(db, payment.id, {
    status: verified.status,
    providerRef: verified.providerRef ?? payment.providerRef,
  });

  if (verified.status !== "succeeded") {
    return { payment: updated, entitlementGranted: false };
  }

  const entitlement = await grantEntitlement(db, updated);
  return { payment: updated, entitlementGranted: Boolean(entitlement) };
}

/**
 * Vérification active (polling) — chemin de secours si aucun webhook
 * n'arrive jamais (audit Mission 1 §26). N'accorde jamais d'entitlement
 * elle-même : retourne le statut à jour, l'appelant (route API) décide
 * de la suite via EntitlementService, avec la même discipline que le
 * webhook (jamais un octroi hors du contrôle serveur).
 */
export async function verifyPendingPayment(paymentId: string, provider: PaymentProvider): Promise<Payment | null> {
  const payment = await PaymentRepository.findById(prisma, paymentId);
  if (!payment || !payment.providerRef) return payment;
  if (isTerminalPaymentStatus(payment.status as PaymentStatus)) return payment;

  const result = await provider.verify(payment.providerRef);
  return PaymentRepository.updateStatus(prisma, payment.id, { status: result.status });
}
