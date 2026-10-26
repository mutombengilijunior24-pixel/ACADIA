/**
 * Lecture des montants tels qu'ils figurent dans des états financiers :
 * « 12 500 », « (12 500) », « 12 500- », « −12 500 », « 1.234.567 », « 1,234,567 », « 1 234,56 »,
 * « 12 500 CDF », « $12,500 »… Un montant illisible est refusé avec sa raison (jamais deviné) ;
 * un séparateur ambigu (« 1.234 », « 1,234 ») est lu comme séparateur de milliers et SIGNALÉ.
 */
import { fold } from "@/lib/core/understanding/text";

import type { AmountUnit, Currency } from "./types";

export type AmountParse = { ok: true; value: number | null; ambiguous?: boolean } | { ok: false; reason: string };

const CURRENCY_TOKENS = /\b(cdf|fc|fcfa|f\s?cfa|xaf|xof|usd|eur|euros?|dollars?|francs?(\s+congolais)?)\b/gi;
const MAX_ABS = 1e15;

export function parseAmount(raw: string | number | null | undefined): AmountParse {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw === "number") return Number.isFinite(raw) && Math.abs(raw) < MAX_ABS ? { ok: true, value: raw } : { ok: false, reason: "Montant hors limites." };
  let s = raw.replace(/[   ]/g, " ").trim();
  if (!s || /^[-–—_.]+$/.test(s)) return { ok: true, value: null };
  if (/%/.test(s)) return { ok: false, reason: "Pourcentage : un montant est attendu." };
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(CURRENCY_TOKENS, "").replace(/[$€]/g, "").trim();
  if (/^[-−–]/.test(s)) {
    negative = !negative;
    s = s.slice(1).trim();
  } else if (/[-−–]$/.test(s)) {
    negative = !negative;
    s = s.slice(0, -1).trim();
  }
  // Espaces et apostrophes entre chiffres : séparateurs de milliers.
  s = s.replace(/(\d)[\s'’](?=\d)/g, "$1");
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return { ok: false, reason: `« ${raw.trim().slice(0, 40)} » n'est pas un montant lisible.` };
  let ambiguous = false;
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  if (dots && commas) {
    // Le dernier séparateur est la décimale.
    const decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    s = s.split(thousands).join("").replace(decimal, ".");
  } else if (dots > 1 || commas > 1) {
    const sep = dots > 1 ? "." : ",";
    if (!new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`).test(s)) return { ok: false, reason: `« ${raw.trim().slice(0, 40)} » : séparateurs incohérents.` };
    s = s.split(sep).join("");
  } else if (dots === 1 || commas === 1) {
    const sep = dots === 1 ? "." : ",";
    const [head, tail] = s.split(sep);
    if (tail.length === 3 && head.length >= 1 && head.length <= 3 && !/^0+$/.test(head)) {
      // « 1.234 » ou « 1,234 » : milliers (montants d'états financiers), mais signalé.
      s = head + tail;
      ambiguous = true;
    } else {
      s = `${head}.${tail}`;
    }
  }
  const value = Number(s);
  if (!Number.isFinite(value) || Math.abs(value) >= MAX_ABS) return { ok: false, reason: "Montant hors limites." };
  return { ok: true, value: negative ? -value : value, ...(ambiguous ? { ambiguous } : {}) };
}

/** « 1 234 567 » ; décimales seulement si nécessaires (2 au plus). */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value === 0 ? 0 : value).replace(/[  ]/g, " ");
}

/** Unité annoncée dans un titre ou un en-tête (« en milliers de CDF »). */
export function detectUnit(text: string): AmountUnit | null {
  const f = fold(text);
  if (/\b(en )?millions?\b/.test(f)) return 1_000_000;
  if (/\b(en )?milliers?\b|\bk ?(cdf|fc|usd|\$)\b/.test(f)) return 1000;
  return null;
}

/** Monnaie annoncée dans un titre ou un en-tête. */
export function detectCurrency(text: string): Currency | null {
  const f = fold(text);
  if (/\b(cdf|fc|francs? congolais)\b/.test(f)) return "CDF";
  if (/\b(usd|dollars?( americains?)?)\b|\$/.test(f)) return "USD";
  return null;
}
