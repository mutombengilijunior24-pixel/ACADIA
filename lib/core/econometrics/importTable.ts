/**
 * Lecture d'un tableau de séries (Excel ou CSV) : repère la colonne des périodes (années, trimestres,
 * mois) et les colonnes numériques, dans les deux dispositions courantes — périodes en lignes, ou périodes
 * en colonnes (présentation des rapports de la banque centrale), transposées automatiquement.
 * Rien n'est deviné en silence : chaque choix est signalé et modifiable.
 */
import { parseNumericText } from "@/lib/core/data/cells";
import type { RawValue } from "@/lib/core/data/types";

import { guessRole, ROLE_BY_ID } from "./roles";
import { MAX_PERIODS, MAX_SERIES, type Frequency, type MacroDataset, type MacroSeries } from "./types";

const YEAR = /^(19|20)\d{2}$/;
const QUARTER = /^((19|20)\d{2})\s*[-/ ]?\s*[TQ]\s*([1-4])$|^[TQ]\s*([1-4])\s*[-/ ]?\s*((19|20)\d{2})$/i;
const MONTH = /^((19|20)\d{2})[-/.](0?[1-9]|1[0-2])$/;

function asText(v: RawValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "iso" in v) return (v as { iso: string }).iso.slice(0, 7);
  return String(v).trim();
}

/** Libellé de période normalisé (« 2005 », « 2005T1 », « 2005-03 ») et fréquence, ou null. */
export function parsePeriod(v: RawValue): { label: string; frequency: Frequency } | null {
  if (typeof v === "number" && Number.isInteger(v) && v >= 1900 && v <= 2100) return { label: String(v), frequency: "annuelle" };
  const t = asText(v);
  if (YEAR.test(t)) return { label: t, frequency: "annuelle" };
  const q = QUARTER.exec(t);
  if (q) return { label: `${q[1] ?? q[5]}T${q[3] ?? q[4]}`, frequency: "trimestrielle" };
  const m = MONTH.exec(t);
  if (m) return { label: `${m[1]}-${m[3].padStart(2, "0")}`, frequency: "mensuelle" };
  return null;
}

function asNumber(v: RawValue): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = asText(v).replace(/%$/, "").trim();
  if (!t || /^(n\.?d\.?|na|-|…|\.\.\.?)$/i.test(t)) return null;
  return parseNumericText(t);
}

/** « PIB nominal (milliards de CDF) » → nom « PIB nominal », unité « milliards de CDF ». */
export function splitHeader(header: string): { name: string; unit: string } {
  const m = /^(.*?)\s*[([]([^)\]]+)[)\]]\s*$/.exec(header.trim());
  return m ? { name: m[1].trim() || header.trim(), unit: m[2].trim() } : { name: header.trim(), unit: "" };
}

export interface TableParse {
  dataset: MacroDataset | null;
  notes: string[];
  errors: string[];
}

/** `headers` : en-têtes de colonnes ; `rows` : lignes de données alignées. */
export function datasetFromTable(headers: string[], rows: RawValue[][], fileName: string): TableParse {
  const notes: string[] = [];
  let h = headers;
  let r = rows;
  // Disposition « périodes en colonnes » : la majorité des en-têtes (hors première colonne) sont des périodes.
  const headerPeriods = h.slice(1).filter((x) => parsePeriod(x)).length;
  if (h.length > 2 && headerPeriods >= Math.max(2, Math.ceil((h.length - 1) * 0.6))) {
    const periods = h.slice(1);
    const names = r.map((row) => asText(row[0]));
    h = ["Période", ...names];
    r = periods.map((p, j) => [p, ...r.map((row) => row[j + 1] ?? null)]);
    notes.push("Les périodes figuraient en colonnes : le tableau a été transposé (une ligne par période).");
  }
  // Colonne des périodes : celle dont la plupart des valeurs sont des périodes.
  const scores = h.map((_, j) => r.filter((row) => parsePeriod(row[j] ?? null)).length);
  const pcol = scores.indexOf(Math.max(...scores));
  if (pcol < 0 || scores[pcol] < Math.max(2, Math.ceil(r.length * 0.6))) return { dataset: null, notes, errors: ["Aucune colonne de périodes (années, trimestres ou mois) n'a été trouvée : la première colonne doit contenir les années (ex. 2005, 2006…)."] };
  let lines = r.map((row) => ({ period: parsePeriod(row[pcol] ?? null), row })).filter((x): x is { period: { label: string; frequency: Frequency }; row: RawValue[] } => x.period !== null);
  const frequency = lines[0].period.frequency;
  if (lines.some((l) => l.period.frequency !== frequency)) return { dataset: null, notes, errors: ["Les périodes mélangent plusieurs fréquences (années et trimestres, par exemple) : gardez une seule fréquence."] };
  // Ordre chronologique.
  const sorted = [...lines].sort((a, b) => a.period.label.localeCompare(b.period.label));
  if (sorted.some((l, i) => l !== lines[i])) {
    lines = sorted;
    notes.push("Les périodes ont été remises dans l'ordre chronologique.");
  }
  const seen = new Set<string>();
  for (const l of lines) {
    if (seen.has(l.period.label)) return { dataset: null, notes, errors: [`La période ${l.period.label} apparaît plusieurs fois.`] };
    seen.add(l.period.label);
  }
  if (lines.length > MAX_PERIODS) return { dataset: null, notes, errors: [`Trop de périodes (${lines.length}) : au plus ${MAX_PERIODS}.`] };
  const series: MacroSeries[] = [];
  h.forEach((header, j) => {
    if (j === pcol) return;
    const values = lines.map((l) => asNumber(l.row[j] ?? null));
    const filled = values.filter((v) => v !== null).length;
    if (!filled) return;
    if (filled < lines.length * 0.5) notes.push(`« ${header || `Colonne ${j + 1}`} » est incomplète (${filled} valeur(s) sur ${lines.length}).`);
    const { name, unit } = splitHeader(header || `Série ${j + 1}`);
    const role = guessRole(name);
    series.push({ id: `s${series.length + 1}`, name, unit: unit || (role !== "autre" ? ROLE_BY_ID[role].unitHint : ""), role, values });
  });
  if (!series.length) return { dataset: null, notes, errors: ["Aucune colonne numérique n'a été trouvée à côté des périodes."] };
  if (series.length > MAX_SERIES) {
    notes.push(`Seules les ${MAX_SERIES} premières séries ont été retenues.`);
    series.length = MAX_SERIES;
  }
  notes.push(`${series.length} série(s) sur ${lines.length} période(s) ; le rôle de chaque série est proposé d'après son nom : vérifiez-le.`);
  return {
    dataset: { title: fileName.replace(/\.[^.]+$/, ""), economy: "", frequency, periods: lines.map((l) => l.period.label), series, source: "", fictitious: false },
    notes,
    errors: [],
  };
}
