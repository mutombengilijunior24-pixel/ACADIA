// ============================================================
// ACADIA — FACTORY PAYMENT PROVIDER (mission Payment Engine)
//
// SEUL endroit de tout le projet qui lit PAYMENT_MODE et
// MOBILE_MONEY_PROVIDER (audit Mission 1 §1/§19) — PaymentService et
// tout le reste du domaine métier n'appellent que getPaymentProvider(),
// jamais directement MockPaymentProvider/OrangeMoneyProvider/etc.
//
// PAYMENT_MODE absent ou "mock" → MockPaymentProvider (comportement par
// défaut sûr : jamais un vrai provider activé sans configuration
// explicite). PAYMENT_MODE="live" exige MOBILE_MONEY_PROVIDER — sinon
// échec explicite immédiat (jamais un repli silencieux vers le mock en
// prétendant être "live").
// ============================================================

import type { PaymentProvider, PaymentProviderName } from "./PaymentProvider";
import { MockPaymentProvider } from "./MockPaymentProvider";
import { OrangeMoneyProvider } from "./OrangeMoneyProvider";
import { AirtelMoneyProvider } from "./AirtelMoneyProvider";
import { CinetPayProvider } from "./CinetPayProvider";

export class PaymentConfigurationError extends Error {}

function resolveLiveProvider(providerName: string): PaymentProvider {
  switch (providerName) {
    case "orange_money":
      return new OrangeMoneyProvider();
    case "airtel_money":
      return new AirtelMoneyProvider();
    case "cinetpay":
      return new CinetPayProvider();
    default:
      throw new PaymentConfigurationError(
        `MOBILE_MONEY_PROVIDER="${providerName}" inconnu — valeurs valides : orange_money | airtel_money | cinetpay.`
      );
  }
}

/**
 * Résout LE provider actif pour cette instance. Appelée à chaque
 * checkout/vérification — volontairement sans cache module-level pour
 * refléter immédiatement un changement de variable d'environnement
 * (redeploy), sans coût réel (simple sélection, aucun appel réseau ici).
 */
export function getPaymentProvider(): PaymentProvider {
  const mode = process.env.PAYMENT_MODE || "mock";

  if (mode === "mock") {
    return new MockPaymentProvider();
  }

  if (mode === "live") {
    const providerName = process.env.MOBILE_MONEY_PROVIDER;
    if (!providerName) {
      throw new PaymentConfigurationError(
        "PAYMENT_MODE=\"live\" mais MOBILE_MONEY_PROVIDER n'est pas défini — aucun provider réel ne peut être sélectionné."
      );
    }
    return resolveLiveProvider(providerName);
  }

  throw new PaymentConfigurationError(`PAYMENT_MODE="${mode}" inconnu — valeurs valides : mock | live.`);
}

/** Résout un provider par NOM explicite (utilisé par la route webhook, qui reçoit le provider dans l'URL — voir app/api/webhooks/payments/[provider]/route.ts). Ne consulte pas PAYMENT_MODE : un webhook peut légitimement arriver pour "mock" même si l'app tourne par ailleurs en mode live de test. */
export function getPaymentProviderByName(name: string): PaymentProvider {
  if (name === "mock") return new MockPaymentProvider();
  return resolveLiveProvider(name);
}

export function isKnownPaymentProviderName(name: string): name is PaymentProviderName {
  return name === "mock" || name === "orange_money" || name === "airtel_money" || name === "cinetpay";
}
