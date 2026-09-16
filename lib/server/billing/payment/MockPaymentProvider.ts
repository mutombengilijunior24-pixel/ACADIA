// ============================================================
// ACADIA — MOCK PAYMENT PROVIDER (mission Payment Engine)
//
// Implémente EXACTEMENT le contrat PaymentProvider (aucune méthode
// supplémentaire consommée par le code métier) — permet de tester tout
// le Payment Engine (checkout → webhook → entitlement) sans argent réel
// et indépendamment du statut bêta (mission §16).
//
// Fonctionne SANS état partagé en mémoire (compatible environnement
// serverless multi-instance, audit Mission 1 §F) : le résultat final
// simulé (succeeded/failed/cancelled/expired/pending/processing) est
// encodé directement dans providerRef à l'initiation, puis relu par
// verify()/parseWebhookPayload() — jamais stocké dans une Map process.
//
// Le code métier (PaymentService/EntitlementService) n'a JAMAIS
// connaissance de ce mécanisme : il appelle initiate()/verify() comme
// pour n'importe quel provider réel. Le choix du résultat simulé est
// piloté par l'APPELANT DE TEST via metadata.mockOutcome (jamais par
// un `if (mock)` dans le code métier — mission §4).
// ============================================================

import { randomUUID, createHmac } from "node:crypto";
import type {
  PaymentProvider,
  PaymentInitiationRequest,
  PaymentInitiationResult,
  PaymentVerificationResult,
  PaymentCancellationResult,
  ParsedWebhookEvent,
} from "./PaymentProvider";
import { PAYMENT_STATUSES, type PaymentStatus, isPaymentStatus } from "./PaymentStatus";

const MOCK_REF_PREFIX = "mock";

function getMockWebhookSecret(): string {
  return process.env.MOCK_PAYMENT_WEBHOOK_SECRET || "acadia-mock-payment-dev-secret";
}

function isValidMockOutcome(value: string | undefined): value is PaymentStatus {
  return Boolean(value) && isPaymentStatus(value!);
}

/** Encode le résultat simulé final dans la référence — aucun état process partagé requis. */
function buildProviderRef(finalStatus: PaymentStatus): string {
  return `${MOCK_REF_PREFIX}_${finalStatus}_${randomUUID()}`;
}

function parseProviderRef(providerRef: string): PaymentStatus | null {
  const parts = providerRef.split("_");
  if (parts[0] !== MOCK_REF_PREFIX || parts.length < 2) return null;
  const status = parts[1];
  return isPaymentStatus(status) ? status : null;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;

  async initiate(request: PaymentInitiationRequest): Promise<PaymentInitiationResult> {
    // Par défaut ("succeeded" non précisé) : "pending", comme un vrai
    // provider Mobile Money attendrait une confirmation utilisateur sur
    // son téléphone — jamais un succès immédiat simulé sans étape de
    // vérification (mission §5).
    const requestedOutcome = request.metadata?.mockOutcome;
    const finalOutcome: PaymentStatus = isValidMockOutcome(requestedOutcome) ? requestedOutcome : "succeeded";

    const providerRef = buildProviderRef(finalOutcome);

    return {
      // "processing" reflète l'état réaliste juste après initiation —
      // le résultat final n'est révélé qu'à verify()/webhook, jamais ici.
      status: "processing",
      providerRef,
      instructions:
        "Ceci est un paiement simulé (MockPaymentProvider) — aucune transaction réelle, aucun argent déplacé.",
    };
  }

  async verify(providerRef: string): Promise<PaymentVerificationResult> {
    const status = parseProviderRef(providerRef) ?? "failed";
    return { status, providerRef };
  }

  async cancel(_providerRef: string): Promise<PaymentCancellationResult> {
    return { status: "cancelled" };
  }

  /**
   * Le Mock signe avec un secret de développement (jamais un secret de
   * provider réel) — voir buildSignedWebhookPayload(), utilisé
   * uniquement par les tests/scripts internes pour simuler un webhook
   * entrant de bout en bout sur la vraie route HTTP.
   */
  async verifyWebhookSignature(rawBody: string, headers: Headers): Promise<boolean> {
    const signature = headers.get("x-mock-signature");
    if (!signature) return false;
    const expected = createHmac("sha256", getMockWebhookSecret()).update(rawBody).digest("hex");
    return signature === expected;
  }

  async parseWebhookPayload(rawBody: string): Promise<ParsedWebhookEvent> {
    const payload = JSON.parse(rawBody) as { providerEventId: string; providerRef: string };
    const status = parseProviderRef(payload.providerRef) ?? "failed";
    return {
      providerEventId: payload.providerEventId,
      providerRef: payload.providerRef,
      status,
    };
  }

  // ------------------------------------------------------------
  // OUTILS DE TEST UNIQUEMENT — jamais appelés par le code métier ni
  // par un provider réel. Construisent un payload+signature valides
  // pour exercer /api/webhooks/payments/mock de bout en bout.
  // ------------------------------------------------------------

  static buildSignedWebhookRequest(providerRef: string): { body: string; signature: string } {
    const body = JSON.stringify({ providerEventId: randomUUID(), providerRef });
    const signature = createHmac("sha256", getMockWebhookSecret()).update(body).digest("hex");
    return { body, signature };
  }
}

export const ALL_MOCK_OUTCOMES = PAYMENT_STATUSES;
