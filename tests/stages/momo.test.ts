import { describe, expect, it } from "vitest";

import { isPaid, PAYMENT_STATE_LABELS } from "@/lib/core/stages/catalog";
import { declarationSchema, formatMsisdn, momoAccountsSchema, normalizeMsisdn, operatorFromNumber, paymentReference } from "@/lib/core/stages/momo";
import { computeStatus, nextStep } from "@/lib/core/stages/workflow";

describe("numéros Mobile Money (RDC)", () => {
  it("normalise et affiche les numéros, quelle que soit la saisie", () => {
    for (const v of ["+243856445612", "243 856 445 612", "0856445612", "856445612", "+243 85 644 5612"]) expect(normalizeMsisdn(v)).toBe("+243856445612");
    expect(normalizeMsisdn("12345")).toBeNull();
    expect(formatMsisdn("0997774996")).toBe("+243 99 777 4996");
  });

  it("devine l'opérateur d'après le préfixe", () => {
    expect(operatorFromNumber("+243856445612")).toBe("orange_money");
    expect(operatorFromNumber("+243997774996")).toBe("airtel_money");
    expect(operatorFromNumber("0812345678")).toBe("mpesa");
    expect(operatorFromNumber("0901234567")).toBe("afrimoney");
  });

  it("réglage des numéros : numéro et titulaire obligatoires, numéro normalisé", () => {
    const ok = momoAccountsSchema.safeParse([{ operator: "orange_money", number: "0856 445 612", name: "Titulaire Test", active: true }]);
    expect(ok.success && ok.data[0].number).toBe("+243856445612");
    expect(momoAccountsSchema.safeParse([{ operator: "orange_money", number: "123", name: "X", active: true }]).success).toBe(false);
  });
});

describe("déclaration du paiement", () => {
  const base = { options: ["recommandation", "assurance"], account: "+243856445612", senderPhone: "0812345678", transactionId: " mp261027.1530.a12345 " };

  it("normalise le numéro de transaction et le numéro d'envoi", () => {
    const parsed = declarationSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.transactionId).toBe("MP261027.1530.A12345");
      expect(parsed.data.senderPhone).toBe("+243812345678");
    }
  });

  it("refuse une déclaration sans option, sans transaction lisible ou sans numéro d'envoi", () => {
    expect(declarationSchema.safeParse({ ...base, options: [] }).success).toBe(false);
    expect(declarationSchema.safeParse({ ...base, transactionId: "ab" }).success).toBe(false);
    expect(declarationSchema.safeParse({ ...base, transactionId: "<script>" }).success).toBe(false);
    expect(declarationSchema.safeParse({ ...base, senderPhone: "abc" }).success).toBe(false);
  });

  it("référence de dossier stable, lisible, sans caractères ambigus", () => {
    const ref = paymentReference("cmvqdnzy7000gx9jo3gnta7i0");
    expect(ref).toBe(paymentReference("cmvqdnzy7000gx9jo3gnta7i0"));
    expect(ref).toMatch(/^MNJ-[2-9A-HJ-NP-Z]{5}$/);
    expect(paymentReference("autre-dossier")).not.toBe(ref);
  });

  it("un paiement déclaré n'est jamais « réglé » tant que l'équipe ne l'a pas confirmé", () => {
    expect(isPaid("a_verifier")).toBe(false);
    expect(isPaid("paye_momo")).toBe(true);
    expect(PAYMENT_STATE_LABELS.a_verifier).toMatch(/vérification/);
    const facts = { type: "academique" as const, status: "en_attente", paymentStatus: "a_verifier", documentsReceived: [], assignedCompany: null, tutorName: null, startDate: null, endDate: null };
    expect(computeStatus(facts, "2026-10-27")).toBe("en_attente");
    expect(nextStep(facts, "2026-10-27").student[0]).toMatch(/en cours de vérification/);
    expect(nextStep(facts, "2026-10-27").team[0]).toMatch(/Vérifier le paiement Mobile Money/);
  });
});
