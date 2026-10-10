/**
 * Lecteur CSV conforme à la RFC 4180 (sans dépendance) :
 * - champs entre guillemets contenant séparateurs, guillemets doublés ("") et sauts de ligne ;
 * - fins de ligne CRLF, LF ou CR ;
 * - aucune valeur modifiée : les espaces et les chaînes vides sont conservés.
 */

export interface CsvRecord {
  fields: string[];
  /** Numéro de la ligne physique où commence l'enregistrement (1 = première ligne). */
  line: number;
}

export type CsvParseResult =
  | { ok: true; records: CsvRecord[] }
  | { ok: false; error: { message: string; line: number } };

export const CANDIDATE_DELIMITERS = [",", ";", "\t", "|"] as const;

export function parseCsv(text: string, delimiter: string): CsvParseResult {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;
  let line = 1;
  let recordLine = 1;
  let quoteOpenedAt = 0;
  let i = 0;
  const length = text.length;

  const endField = () => {
    fields.push(field);
    field = "";
    fieldWasQuoted = false;
  };
  const endRecord = () => {
    endField();
    records.push({ fields, line: recordLine });
    fields = [];
  };

  while (i < length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      if (char === "\r" || char === "\n") {
        // Saut de ligne à l'intérieur d'un champ : conservé tel quel.
        if (char === "\r" && text[i + 1] === "\n") {
          field += "\r\n";
          i += 2;
        } else {
          field += char;
          i += 1;
        }
        line += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"' && field === "" && !fieldWasQuoted) {
      inQuotes = true;
      fieldWasQuoted = true;
      quoteOpenedAt = line;
      i += 1;
      continue;
    }
    if (char === delimiter) {
      endField();
      i += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      endRecord();
      i += char === "\r" && text[i + 1] === "\n" ? 2 : 1;
      line += 1;
      recordLine = line;
      continue;
    }
    field += char;
    i += 1;
  }

  if (inQuotes) {
    return {
      ok: false,
      error: { message: `Guillemet ouvert ligne ${quoteOpenedAt} jamais refermé.`, line: quoteOpenedAt },
    };
  }

  // Dernier enregistrement (sauf si le fichier se termine par un saut de ligne).
  if (field !== "" || fields.length > 0 || fieldWasQuoted) endRecord();

  return { ok: true, records };
}

/**
 * Détection du séparateur sur les 50 premiers enregistrements : on retient le candidat
 * qui donne le plus de colonnes de façon cohérente (même nombre de champs sur la majorité
 * des lignes non vides). Retourne null si aucun candidat ne produit plus d'une colonne.
 */
export function detectDelimiter(text: string): { delimiter: string; confident: boolean } | null {
  const sample = text.slice(0, 64 * 1024);
  let best: { delimiter: string; columns: number; consistency: number } | null = null;

  for (const delimiter of CANDIDATE_DELIMITERS) {
    const parsed = parseCsv(sample, delimiter);
    if (!parsed.ok) continue;
    const counts = parsed.records
      .slice(0, 50)
      .filter((record) => !(record.fields.length === 1 && record.fields[0].trim() === ""))
      .map((record) => record.fields.length);
    if (counts.length === 0) continue;
    const frequency = new Map<number, number>();
    for (const count of counts) frequency.set(count, (frequency.get(count) ?? 0) + 1);
    const [mode, modeCount] = [...frequency.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    if (mode < 2) continue;
    const consistency = modeCount / counts.length;
    if (!best || consistency > best.consistency || (consistency === best.consistency && mode > best.columns)) {
      best = { delimiter, columns: mode, consistency };
    }
  }

  if (!best) return null;
  return { delimiter: best.delimiter, confident: best.consistency >= 0.9 };
}

export function delimiterLabel(delimiter: string): string {
  switch (delimiter) {
    case "":
      return "aucun (une seule colonne)";
    case ",":
      return "virgule (,)";
    case ";":
      return "point-virgule (;)";
    case "\t":
      return "tabulation";
    case "|":
      return "barre verticale (|)";
    default:
      return `« ${delimiter} »`;
  }
}
