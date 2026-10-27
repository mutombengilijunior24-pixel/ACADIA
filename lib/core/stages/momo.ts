// MNJ Stage Connect — paiement Mobile Money « manuel » (avant l'arrivée d'un agrégateur).
// L'étudiant envoie le montant sur un numéro de MNJ, puis déclare le numéro de transaction reçu par SMS ;
// l'équipe vérifie sur le téléphone de MNJ et confirme dans le CRM. Rien n'est jamais considéré comme
// payé sans cette vérification humaine.

import { z } from "zod";

import { STAGE_OPTION_IDS } from "./catalog";

export const MOMO_OPERATORS = [
  { id: "mpesa", label: "M-Pesa (Vodacom)", prefixes: ["81", "82", "83"] },
  { id: "orange_money", label: "Orange Money", prefixes: ["80", "84", "85", "89"] },
  { id: "airtel_money", label: "Airtel Money", prefixes: ["97", "98", "99"] },
  { id: "afrimoney", label: "Afrimoney (Africell)", prefixes: ["90", "91"] },
] as const;
export type MomoOperatorId = (typeof MOMO_OPERATORS)[number]["id"];
export const MOMO_OPERATOR_IDS = MOMO_OPERATORS.map((o) => o.id) as MomoOperatorId[];
export const operatorLabel = (id: string) => MOMO_OPERATORS.find((o) => o.id === id)?.label ?? id;

/** Numéro congolais au format international « +243XXXXXXXXX », ou null s'il n'est pas reconnaissable. */
export function normalizeMsisdn(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  const national = digits.startsWith("243") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  return /^\d{9}$/.test(national) ? `+243${national}` : null;
}

/** « +243 85 644 5612 » */
export function formatMsisdn(msisdn: string): string {
  const n = normalizeMsisdn(msisdn);
  if (!n) return msisdn;
  const d = n.slice(4);
  return `+243 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}

/** Opérateur probable d'après le préfixe (à confirmer par l'équipe dans le CRM). */
export function operatorFromNumber(input: string): MomoOperatorId | null {
  const n = normalizeMsisdn(input);
  if (!n) return null;
  const prefix = n.slice(4, 6);
  return MOMO_OPERATORS.find((o) => (o.prefixes as readonly string[]).includes(prefix))?.id ?? null;
}

export const momoAccountSchema = z.object({
  operator: z.enum(MOMO_OPERATOR_IDS as [MomoOperatorId, ...MomoOperatorId[]]),
  number: z.string().transform((v, ctx) => {
    const n = normalizeMsisdn(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Numéro invalide (ex. +243 85 644 5612)." });
    return n ?? v;
  }),
  name: z.string().trim().min(2, "Nom du titulaire requis.").max(80),
  active: z.boolean(),
});
export type MomoAccount = z.infer<typeof momoAccountSchema>;
export const momoAccountsSchema = z.array(momoAccountSchema).max(6);

/** Code de référence du dossier, à indiquer comme motif du transfert (« MNJ-7K2QX »). Stable et sans base de données. */
export function paymentReference(applicationId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < applicationId.length; i += 1) {
    h ^= applicationId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += alphabet[h % 32];
    h = Math.floor(h / 32);
  }
  return `MNJ-${code}`;
}

/** Numéro de transaction tel qu'on le compare (sans espaces, en majuscules). */
export const normalizeTransactionId = (v: string) => v.replace(/\s+/g, "").toUpperCase();

export const declarationSchema = z.object({
  options: z.array(z.enum(STAGE_OPTION_IDS as [string, ...string[]])).min(1, "Choisissez au moins une option.").max(STAGE_OPTION_IDS.length),
  account: z.string().min(8).max(20),
  transactionId: z
    .string()
    .transform(normalizeTransactionId)
    .pipe(z.string().regex(/^[A-Z0-9.\-_/]{4,40}$/, "Numéro de transaction invalide : recopiez-le tel qu'il figure dans le SMS.")),
  senderPhone: z.string().transform((v, ctx) => {
    const n = normalizeMsisdn(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Indiquez le numéro depuis lequel vous avez payé." });
    return n ?? v;
  }),
});
export type PaymentDeclaration = z.infer<typeof declarationSchema>;
