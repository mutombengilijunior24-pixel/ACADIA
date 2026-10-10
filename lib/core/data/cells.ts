import type { CellInterpretation, RawValue, SpreadsheetDate } from "./types";

/**
 * Interprétation déterministe et non destructive d'une cellule.
 *
 * Conventions retenues (contexte francophone) :
 * - Nombre en texte : entier (« 12 », « -3 », « 007 »), décimal avec virgule ou point
 *   (« 3,5 », « 3.5 »), milliers séparés par des espaces (« 1 200 », « 1 200,50 »).
 *   « 1,234 » est lu comme 1,234 (virgule décimale). Les pourcentages (« 45 % »)
 *   restent du texte.
 * - Date en texte : AAAA-MM-JJ (non ambiguë) ou JJ/MM/AAAA (jour d'abord). Si le jour et le
 *   mois sont tous deux ≤ 12, la date est marquée ambiguë. Une date impossible
 *   (« 31/02/2024 ») est « invalid ».
 * - Aucune valeur (NA, 99, « - »…) n'est considérée comme manquante d'office : seules les
 *   cellules absentes, vides ou ne contenant que des espaces le sont.
 */

const INTEGER = /^[+-]?\d+$/;
const DECIMAL = /^[+-]?\d+[.,]\d+$/;
const THOUSANDS = /^[+-]?\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const DMY_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

export function isSpreadsheetDate(value: RawValue): value is SpreadsheetDate {
  return typeof value === "object" && value !== null && (value as SpreadsheetDate).t === "date";
}

/** Libellé utilisé pour comparer les modalités : espaces de bord retirés, casse conservée. */
export function rawToLabel(value: RawValue): string {
  if (value === null) return "";
  if (isSpreadsheetDate(value)) return value.iso;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "VRAI" : "FAUX";
  return value.trim();
}

function validDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function parseNumericText(text: string): number | null {
  const value = text.trim();
  if (INTEGER.test(value)) return Number(value);
  if (DECIMAL.test(value)) return Number(value.replace(",", "."));
  if (THOUSANDS.test(value)) return Number(value.replace(/[   ]/g, "").replace(",", "."));
  return null;
}

export function interpretCell(value: RawValue): CellInterpretation {
  if (value === null) return { kind: "missing", label: "" };
  if (isSpreadsheetDate(value)) return { kind: "date", dateIso: value.iso, label: value.iso };
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { kind: "number", number: value, label: String(value) }
      : { kind: "invalid", label: String(value) };
  }
  if (typeof value === "boolean") return { kind: "boolean", label: value ? "VRAI" : "FAUX" };

  if (value === "") return { kind: "empty_string", label: "" };
  const trimmed = value.trim();
  if (trimmed === "") return { kind: "whitespace", label: "" };

  const iso = ISO_DATE.exec(trimmed);
  if (iso) {
    const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    if (!validDate(year, month, day)) return { kind: "invalid", label: trimmed };
    return { kind: "date", dateIso: `${iso[1]}-${iso[2]}-${iso[3]}`, label: trimmed };
  }

  const dmy = DMY_DATE.exec(trimmed);
  if (dmy) {
    const [first, second, year] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
    // Jour d'abord (convention française). Si le 2e nombre dépasse 12, l'ordre est mois/jour.
    const dayFirst = second <= 12;
    const [day, month] = dayFirst ? [first, second] : [second, first];
    if (!validDate(year, month, day)) return { kind: "invalid", label: trimmed };
    return {
      kind: "date",
      dateIso: `${year}-${pad(month)}-${pad(day)}`,
      ambiguousDate: first <= 12 && second <= 12 && first !== second,
      label: trimmed,
    };
  }

  const number = parseNumericText(trimmed);
  if (number !== null && Number.isFinite(number)) {
    return {
      kind: "numeric_text",
      number,
      leadingZero: /^[+-]?0\d/.test(trimmed),
      label: trimmed,
    };
  }

  return { kind: "text", label: trimmed };
}

/** Cellule considérée comme manquante (absente, vide ou blanche) — politique documentée. */
export function isBlankKind(kind: CellInterpretation["kind"]): boolean {
  return kind === "missing" || kind === "empty_string" || kind === "whitespace";
}

/** Texte affichable d'une valeur brute (pour l'aperçu ; React se charge de l'échappement). */
export function displayRaw(value: RawValue): string {
  if (value === null) return "";
  if (isSpreadsheetDate(value)) return value.iso;
  if (typeof value === "boolean") return value ? "VRAI" : "FAUX";
  return String(value);
}
