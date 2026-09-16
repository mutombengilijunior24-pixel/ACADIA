// ============================================================
// ACADIA — CONTRAT PAYMENT PROVIDER (mission Payment Engine)
//
// Abstraction PROVIDER-AGNOSTIQUE (audit Mission 1, §I) — aucun concept
// spécifique à Orange Money, Airtel Money ou CinetPay n'apparaît ici.
// Le domaine métier (PaymentService/EntitlementService) ne dépend QUE
// de ce contrat, jamais d'une implémentation concrète — le choix du
// provider réel est entièrement isolé dans PaymentProviderFactory.ts.
//
// Aucune URL, endpoint, payload ou signature d'un provider réel n'est
// fabriqué ici (mission §1/§18 — "IMPOSSIBLE D'INVENTER"). Ce fichier
// ne décrit que la FORME que doit prendre n'importe quel provider,
// réel ou simulé.
// ============================================================

import type { PaymentStatus } from "./PaymentStatus";

/** Identifiants de provider connus par ACADIA — "beta_free" reste le provider historique du mode bêta (EntitlementService), inchangé. */
export const PAYMENT_PROVIDER_NAMES = [
  "beta_free",
  "mock",
  "orange_money",
  "airtel_money",
  "cinetpay",
] as const;

export type PaymentProviderName = (typeof PAYMENT_PROVIDER_NAMES)[number];

/**
 * Levée par un provider réel tant qu'il n'est pas configuré (aucun
 * credential/spécification officielle disponible — audit Mission 1,
 * §18). Ne simule JAMAIS un succès silencieux : un provider non prêt
 * doit échouer explicitement, toujours.
 */
export class ProviderNotConfiguredError extends Error {
  constructor(public readonly provider: PaymentProviderName) {
    super(
      `Le fournisseur de paiement "${provider}" n'est pas encore configuré ` +
        `(aucun credential/spécification officielle disponible). Aucun paiement réel ne peut être initié.`
    );
  }
}

export interface PaymentInitiationRequest {
  /** Payment.id déjà créé côté ACADIA avant l'appel provider (voir PaymentService) — permet de toujours corréler la réponse à une ligne existante. */
  paymentId: string;
  amountUsd: number;
  currency: string;
  entitlementKey: string;
  userId: string;
  /** Métadonnées non sensibles, jamais un secret ni un PIN — voir chaque provider pour ce qu'il accepte réellement. */
  metadata?: Record<string, string>;
}

export interface PaymentInitiationResult {
  /** Statut immédiatement après initiation — typiquement "pending" ou "processing", jamais "succeeded" (mission §5 : "ne jamais accorder une entitlement simplement parce que le client affirme avoir payé"). */
  status: PaymentStatus;
  /** Référence de transaction CÔTÉ PROVIDER — sert à corréler un futur webhook/vérification à ce Payment (stocké dans Payment.providerRef, déjà existant). */
  providerRef: string | null;
  /** Instructions à afficher au chercheur (ex. code USSD) — jamais un secret, jamais un credential. */
  instructions?: string | null;
}

export interface PaymentVerificationResult {
  status: PaymentStatus;
  providerRef: string | null;
}

export interface PaymentCancellationResult {
  status: PaymentStatus;
}

/**
 * Résultat de la vérification d'un événement webhook entrant, une fois
 * la signature validée et le payload compris par LE PROVIDER CONCERNÉ
 * (jamais par la route webhook elle-même — voir app/api/webhooks/payments/[provider]/route.ts).
 */
export interface ParsedWebhookEvent {
  providerEventId: string;
  providerRef: string | null;
  status: PaymentStatus;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;

  /** Démarre un paiement chez le provider. Ne doit jamais être appelé pendant une transaction Prisma ouverte (audit Mission 1, §F/§13). */
  initiate(request: PaymentInitiationRequest): Promise<PaymentInitiationResult>;

  /** Interroge activement le provider sur l'état d'une transaction (chemin de secours si le webhook n'arrive jamais — voir §26, "polling"). */
  verify(providerRef: string): Promise<PaymentVerificationResult>;

  /** Annulation — optionnelle, certains providers ne la permettent pas une fois la transaction initiée côté utilisateur. */
  cancel?(providerRef: string): Promise<PaymentCancellationResult>;

  /**
   * Vérifie l'authenticité d'un webhook entrant (signature/secret propre
   * au provider) à partir du corps BRUT de la requête. Doit toujours
   * être appelée AVANT tout parsing du payload. Un provider non
   * configuré lève ProviderNotConfiguredError — jamais un `true` par défaut.
   */
  verifyWebhookSignature(rawBody: string, headers: Headers): Promise<boolean>;

  /** Traduit le payload brut (déjà authentifié) en un événement normalisé, provider-agnostique pour le reste du système. */
  parseWebhookPayload(rawBody: string): Promise<ParsedWebhookEvent>;
}
