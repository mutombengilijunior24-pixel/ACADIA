/** Présentation des valeurs d'indicateurs (format français) et des repères. */
import type { Bands, IndicatorDef, IndicatorUnit } from "./indicators/types";
import type { Company } from "./types";

const nf = (digits: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
const clean = (s: string) => s.replace(/[  ]/g, " ");

export function currencySuffix(company: Pick<Company, "currency" | "currencyOther" | "unit">): string {
  const currency = company.currency === "AUTRE" ? company.currencyOther || "unités monétaires" : company.currency;
  return company.unit === 1000 ? `milliers de ${currency}` : company.unit === 1_000_000 ? `millions de ${currency}` : currency;
}

export function formatValue(value: number | null, unit: IndicatorUnit, company?: Pick<Company, "currency" | "currencyOther" | "unit">): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const v = Object.is(value, -0) ? 0 : value;
  switch (unit) {
    case "pct":
      return `${clean(nf(1).format(v * 100))} %`;
    case "points":
      return `${v >= 0 ? "+" : ""}${clean(nf(1).format(v * 100))} pts`;
    case "ratio":
      return clean(nf(2).format(v));
    case "jours":
      return `${clean(nf(0).format(Math.round(v)))} j`;
    case "annees":
      return `${clean(nf(1).format(v))} an${Math.abs(v) >= 2 ? "s" : ""}`;
    case "montant":
      return `${clean(nf(0).format(Math.round(v)))}${company ? ` ${currencySuffix(company)}` : ""}`;
  }
}

/** « au moins 1,2 (favorable) ; moins de 1 (défavorable) ». */
export function bandsText(def: IndicatorDef, bands: Bands | null): string {
  if (!bands || def.direction === "neutral") return "";
  const f = (v: number) => formatValue(v, def.unit);
  if (bands.good === 0 && bands.bad === 0) return def.direction === "higher" ? "positif" : "négatif ou nul";
  if (def.direction === "higher") return bands.good === bands.bad ? `au moins ${f(bands.good)}` : `au moins ${f(bands.good)} ; défavorable sous ${f(bands.bad)}`;
  return bands.good === bands.bad ? `au plus ${f(bands.good)}` : `au plus ${f(bands.good)} ; défavorable au-delà de ${f(bands.bad)}`;
}
