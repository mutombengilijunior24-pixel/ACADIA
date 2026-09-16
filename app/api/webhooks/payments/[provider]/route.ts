// ============================================================
// ACADIA — WEBHOOK PAIEMENT (mission Payment Engine)
//
// AUCUNE session utilisateur ici (audit Mission 1 §11) — l'authenticité
// vient exclusivement de provider.verifyWebhookSignature(), propre à
// chaque fournisseur (jamais getSessionUser). Un provider non configuré
// (Orange/Airtel/CinetPay tant qu'aucune spécification officielle n'est
// fournie) lève ProviderNotConfiguredError → rejeté explicitement,
// jamais un succès silencieux.
//
// Idempotence : la contrainte unique WebhookEvent(provider,
// providerEventId) est LE mécanisme — un même événement reçu 1, 2 ou
// 10 fois ne peut créer qu'une seule ligne, donc ne peut déclencher
// qu'un seul octroi d'entitlement (mission §9/§24).
//
// Transaction courte (mission §13) : aucun appel provider n'a lieu ici
// (le résultat est déjà dans le payload déjà authentifié) — seule la
// mise à jour Payment + octroi Entitlement est transactionnelle.
// ============================================================

import { createHash } from "node:crypto";
import { prisma } from "@/lib/server/db/prisma";
import {
  getPaymentProviderByName,
  isKnownPaymentProviderName,
} from "@/lib/server/billing/payment/PaymentProviderFactory";
import * as PaymentRepository from "@/lib/server/billing/payment/PaymentRepository";
import { settleFromWebhook } from "@/lib/server/billing/payment/PaymentService";
import { grantEntitlementForPayment } from "@/lib/server/billing/EntitlementService";
import { trackProductEvent, type ProductEventType } from "@/lib/server/analytics/ProductEvents";
import { logAudit } from "@/lib/server/audit/AuditLog";
import type { PaymentStatus } from "@/lib/server/billing/payment/PaymentStatus";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ provider: string }> };

const STATUS_TO_PRODUCT_EVENT: Partial<Record<PaymentStatus, ProductEventType>> = {
  succeeded: "PAYMENT_SUCCEEDED",
  failed: "PAYMENT_FAILED",
  cancelled: "PAYMENT_CANCELLED",
  expired: "PAYMENT_EXPIRED",
  processing: "PAYMENT_PROCESSING",
};

async function rejectWebhook(reason: string, provider: string, status: number, extra?: Record<string, string>) {
  await logAudit({
    action: "WEBHOOK_REJECTED",
    entityType: "WebhookEvent",
    metadata: { reason, provider, ...extra },
  });
  return Response.json({ error: "Requête rejetée." }, { status });
}

export async function POST(request: Request, context: RouteContext) {
  const { provider: providerParam } = await context.params;

  if (!isKnownPaymentProviderName(providerParam)) {
    return rejectWebhook("unknown_provider", providerParam, 404);
  }

  const provider = getPaymentProviderByName(providerParam);

  // Corps BRUT lu AVANT tout parsing — nécessaire pour toute
  // vérification de signature (HMAC sur les octets exacts reçus).
  const rawBody = await request.text();

  let signatureValid: boolean;
  try {
    signatureValid = await provider.verifyWebhookSignature(rawBody, request.headers);
  } catch (error) {
    // ProviderNotConfiguredError (Orange/Airtel/CinetPay tant que non
    // branchés) ou toute autre erreur de vérification — jamais un
    // succès silencieux.
    return rejectWebhook("verification_error", providerParam, 401, {
      message: error instanceof Error ? error.message.slice(0, 200) : "erreur inconnue",
    });
  }

  if (!signatureValid) {
    return rejectWebhook("invalid_signature", providerParam, 401);
  }

  let parsed;
  try {
    parsed = await provider.parseWebhookPayload(rawBody);
  } catch {
    return rejectWebhook("unparseable_payload", providerParam, 400);
  }

  const rawPayloadHash = createHash("sha256").update(rawBody).digest("hex");

  type Outcome =
    | { kind: "payment_not_found" }
    | { kind: "settled"; status: PaymentStatus; userId: string; projectId: string | null; entitlementKey: string };

  // L'idempotence est établie ICI, EN DEHORS de toute transaction plus
  // large : la contrainte unique (provider, providerEventId) sur une
  // création ISOLÉE — une violation reste une simple erreur de requête
  // ponctuelle, jamais l'échec d'une transaction Postgres plus large
  // (un statement en échec avorte le reste de la transaction qui le
  // contient ; l'isoler ici évite qu'un doublon légitime ne fasse
  // échouer le COMMIT d'une transaction par ailleurs valide — bug
  // constaté et corrigé pendant les tests de cette mission, voir TEST 9).
  let webhookEventId: string;
  try {
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        provider: providerParam,
        providerEventId: parsed.providerEventId,
        rawPayloadHash,
        status: "received",
      },
    });
    webhookEventId = webhookEvent.id;
  } catch {
    return Response.json({ received: true, alreadyProcessed: true }, { status: 200 });
  }

  let outcome: Outcome;
  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        const payment = parsed.providerRef
          ? await PaymentRepository.findByProviderRef(tx, providerParam, parsed.providerRef)
          : null;

        if (!payment) {
          await tx.webhookEvent.update({
            where: { id: webhookEventId },
            data: { status: "failed", processedAt: new Date() },
          });
          return { kind: "payment_not_found" };
        }

        const settled = await settleFromWebhook(
          tx,
          payment,
          { status: parsed.status, providerRef: parsed.providerRef },
          grantEntitlementForPayment
        );

        await tx.webhookEvent.update({
          where: { id: webhookEventId },
          data: { status: "processed", processedAt: new Date(), paymentId: payment.id },
        });

        return {
          kind: "settled",
          status: settled.payment.status as PaymentStatus,
          userId: settled.payment.userId,
          projectId: settled.payment.projectId,
          entitlementKey: settled.payment.entitlementKey,
        };
      },
      // Deux allers-retours DB séquentiels (Payment puis Entitlement) —
      // le défaut Prisma (5s) peut être trop court selon la latence
      // réseau vers la base (voir rapport, limitations).
      { timeout: 10000 }
    );
  } catch (error) {
    console.error("[ACADIA] Erreur traitement webhook paiement :", error);
    await prisma.webhookEvent
      .update({ where: { id: webhookEventId }, data: { status: "failed", processedAt: new Date() } })
      .catch(() => {});
    return Response.json({ error: "Erreur de traitement." }, { status: 500 });
  }

  // Un webhook déjà traité (ou une référence introuvable, cas anormal
  // qui ne se résoudra pas par un retry) reçoit toujours 200 — répondre
  // une erreur inciterait le provider à renvoyer indéfiniment le même
  // événement (mission §9 : "aucun deuxième octroi", pas "réessayer").
  if (outcome.kind !== "settled") {
    return Response.json({ received: true }, { status: 200 });
  }

  // Événements produit/audit — hors transaction, best-effort, jamais
  // bloquant (même discipline que trackProductEvent/logAudit partout
  // ailleurs dans le projet).
  const eventType = STATUS_TO_PRODUCT_EVENT[outcome.status];
  if (eventType) {
    await trackProductEvent({
      userId: outcome.userId,
      projectId: outcome.projectId ?? undefined,
      eventType,
      metadata: { entitlementKey: outcome.entitlementKey, provider: providerParam },
    });
  }

  return Response.json({ received: true }, { status: 200 });
}
