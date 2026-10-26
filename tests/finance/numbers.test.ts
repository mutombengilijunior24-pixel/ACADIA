import { describe, expect, it } from "vitest";

import { detectCurrency, detectUnit, formatAmount, parseAmount } from "@/lib/core/finance";

const value = (raw: string) => {
  const r = parseAmount(raw);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
};

describe("Lecture des montants des états financiers", () => {
  it("formats usuels", () => {
    expect(value("12 500")).toBe(12500);
    expect(value("12 500")).toBe(12500);
    expect(value("1 234 567")).toBe(1234567);
    expect(value("1 234,56")).toBe(1234.56);
    expect(value("1.234.567")).toBe(1234567);
    expect(value("1,234,567")).toBe(1234567);
    expect(value("1.234.567,89")).toBe(1234567.89);
    expect(value("1,234,567.89")).toBe(1234567.89);
    expect(value("12,5")).toBe(12.5);
    expect(value("0,125")).toBe(0.125);
  });

  it("montants négatifs : parenthèses, signe avant ou après", () => {
    expect(value("(12 500)")).toBe(-12500);
    expect(value("-12 500")).toBe(-12500);
    expect(value("−12 500")).toBe(-12500);
    expect(value("12 500-")).toBe(-12500);
  });

  it("monnaies ignorées, cases vides", () => {
    expect(value("12 500 CDF")).toBe(12500);
    expect(value("$12,500.50")).toBe(12500.5);
    expect(value("12 500 FC")).toBe(12500);
    expect(value("")).toBeNull();
    expect(value("-")).toBeNull();
    expect(value("—")).toBeNull();
  });

  it("séparateur ambigu signalé ; texte illisible refusé, jamais deviné", () => {
    expect(parseAmount("1.234")).toEqual({ ok: true, value: 1234, ambiguous: true });
    expect(parseAmount("1,234")).toEqual({ ok: true, value: 1234, ambiguous: true });
    expect(parseAmount("12 5OO").ok).toBe(false);
    expect(parseAmount("15 %").ok).toBe(false);
    expect(parseAmount("1.23.4").ok).toBe(false);
  });

  it("affichage et détection de l'unité et de la monnaie", () => {
    expect(formatAmount(1234567)).toBe("1 234 567");
    expect(formatAmount(-1234.5)).toBe("-1 234,5");
    expect(detectUnit("Montants en milliers de francs congolais")).toBe(1000);
    expect(detectUnit("(en millions de CDF)")).toBe(1_000_000);
    expect(detectUnit("Bilan au 31/12/2023")).toBeNull();
    expect(detectCurrency("en milliers de CDF")).toBe("CDF");
    expect(detectCurrency("Montants en USD")).toBe("USD");
  });
});
