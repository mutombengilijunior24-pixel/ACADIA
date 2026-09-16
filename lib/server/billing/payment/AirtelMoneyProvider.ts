// ============================================================
// ACADIA — AIRTEL MONEY RDC (placeholder, mission Payment Engine)
//
// AUCUNE intégration réelle : aucune spécification officielle Airtel
// Money RDC n'a été fournie à ce jour. Voir OrangeMoneyProvider.ts pour
// la justification complète de ce pattern — même discipline ici.
//
// Pour brancher le vrai Airtel Money RDC : voir docs/PAYMENT_ENGINE.md
// section "Brancher Airtel Money".
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

export class AirtelMoneyProvider implements PaymentProvider {
  readonly name = "airtel_money" as const;

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
