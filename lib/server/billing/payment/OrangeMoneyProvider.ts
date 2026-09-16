// ============================================================
// ACADIA — ORANGE MONEY RDC (placeholder, mission Payment Engine)
//
// AUCUNE intégration réelle : aucune spécification officielle Orange
// Money RDC n'a été fournie à ce jour (audit Mission 1 — "IMPOSSIBLE
// D'INVENTER DES ENDPOINTS/PAYLOADS/SIGNATURES/CREDENTIALS"). Cette
// classe existe uniquement pour que PaymentProviderFactory ait un point
// d'extension clairement identifié — chaque méthode échoue
// explicitement tant qu'elle n'est pas branchée sur la documentation
// officielle réelle. Ne simule JAMAIS un succès.
//
// Pour brancher le vrai Orange Money RDC : voir docs/PAYMENT_ENGINE.md
// section "Brancher Orange Money".
// ============================================================

import type {
  PaymentProvider,
  PaymentInitiationRequest,
  PaymentInitiationResult,
  PaymentVerificationResult,
  PaymentCancellationResult,
  ParsedWebhookEvent,
} from "./PaymentProvider";
import { ProviderNotConfiguredError } from "./PaymentProvider";

export class OrangeMoneyProvider implements PaymentProvider {
  readonly name = "orange_money" as const;

  async initiate(_request: PaymentInitiationRequest): Promise<PaymentInitiationResult> {
    throw new ProviderNotConfiguredError(this.name);
  }

  async verify(_providerRef: string): Promise<PaymentVerificationResult> {
    throw new ProviderNotConfiguredError(this.name);
  }

  async cancel(_providerRef: string): Promise<PaymentCancellationResult> {
    throw new ProviderNotConfiguredError(this.name);
  }

  async verifyWebhookSignature(_rawBody: string, _headers: Headers): Promise<boolean> {
    throw new ProviderNotConfiguredError(this.name);
  }

  async parseWebhookPayload(_rawBody: string): Promise<ParsedWebhookEvent> {
    throw new ProviderNotConfiguredError(this.name);
  }
}
