// ============================================================
// ACADIA — STATUTS DE PAIEMENT (mission Payment Engine)
//
// Représentation UNIQUE et cohérente de Payment.status dans tout le
// code (audit Mission 1, §7 : "ne mélange pas pending / PENDING /
// Succeeded sans raison"). Minuscules — cohérent avec les valeurs déjà
// écrites en production par EntitlementService ("pending"/"succeeded"/
// "failed", voir mission Conversion) et avec Entitlement.status
// ("active"/"revoked", même casse). Payment.status reste une colonne
// String (aucune migration de type Prisma nécessaire, voir audit §C) —
// ce module est la SEULE source de vérité sur les valeurs autorisées.
// ============================================================

export const PAYMENT_STATUSES = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/** Un statut terminal ne doit plus jamais être modifié par un événement ultérieur. */
export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled" || status === "expired";
}
