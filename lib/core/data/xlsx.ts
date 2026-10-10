import readXlsxFile from "read-excel-file/universal";

import type { ImportLimits } from "./limits";
import { formatBytes } from "./limits";
import type { ImportIssue, RawValue } from "./types";

/**
 * Lecture XLSX dans le navigateur ou dans Node (bibliothèque read-excel-file, entrée « universal »).
 *
 * Limites connues de la bibliothèque (documentées pour l'utilisateur) :
 * - les formules sont lues avec la valeur pré-calculée par le tableur ; une formule en erreur
 *   (#DIV/0!, #N/A…) est lue comme une cellule vide ;
 * - une cellule fusionnée n'a de valeur que dans sa première cellule ;
 * - aucune macro n'est exécutée (le format .xlsx n'en contient pas ; .xlsm n'est pas accepté).
 */

/**
 * Contrôle de l'archive avant décompression (protection « zip bomb ») : lecture du répertoire
 * central ZIP et vérification des tailles décompressées annoncées.
 */
export function inspectZip(bytes: Uint8Array, limits: ImportLimits): ImportIssue | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Fin du répertoire central : signature 0x06054b50, cherchée depuis la fin (commentaire ≤ 64 Ko).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    return { code: "xlsx_malformed", severity: "error", message: "Le fichier n'est pas un classeur Excel valide (archive XLSX illisible)." };
  }
  const entries = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (directoryOffset + directorySize > bytes.length || entries === 0xffff || directoryOffset === 0xffffffff) {
    return { code: "xlsx_malformed", severity: "error", message: "Le classeur Excel est endommagé ou dans un format non pris en charge (ZIP64)." };
  }

  let offset = directoryOffset;
  let totalUncompressed = 0;
  for (let n = 0; n < entries; n += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
      return { code: "xlsx_malformed", severity: "error", message: "Le classeur Excel est endommagé (répertoire de l'archive incohérent)." };
    }
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (uncompressed === 0xffffffff || compressed === 0xffffffff) {
      return { code: "xlsx_too_large", severity: "error", message: "Le classeur dépasse 4 Go une fois décompressé : il ne peut pas être importé." };
    }
    totalUncompressed += uncompressed;
    if (compressed > 0 && uncompressed / compressed > limits.maxCompressionRatio && uncompressed > 1024 * 1024) {
      return {
        code: "xlsx_suspicious_compression",
        severity: "error",
        message: "Le classeur contient des données anormalement compressées : il a été refusé par sécurité.",
      };
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (totalUncompressed > limits.maxUncompressedBytes) {
    return {
      code: "xlsx_too_large",
      severity: "error",
      message: `Le classeur occupe ${formatBytes(totalUncompressed)} une fois décompressé (limite : ${formatBytes(limits.maxUncompressedBytes)}). Exportez la feuille utile en CSV ou réduisez le classeur.`,
    };
  }
  return null;
}

function toIso(date: Date): string {
  const iso = date.toISOString();
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.replace(".000Z", "Z");
}

export interface XlsxSheet {
  name: string;
  rows: RawValue[][];
}

export type XlsxReadResult = { ok: true; sheets: XlsxSheet[] } | { ok: false; issue: ImportIssue };

export async function readXlsx(bytes: Uint8Array, limits: ImportLimits): Promise<XlsxReadResult> {
  const zipIssue = inspectZip(bytes, limits);
  if (zipIssue) return { ok: false, issue: zipIssue };

  try {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    // trim:false : aucune modification des chaînes (espaces conservés).
    const sheets = await readXlsxFile(buffer, { trim: false });
    return {
      ok: true,
      sheets: sheets.map((sheet) => ({
        name: sheet.sheet,
        rows: sheet.data.map((row) =>
          row.map((cell): RawValue => {
            if (cell === null || cell === undefined) return null;
            if ((cell as unknown) instanceof Date) return { t: "date", iso: toIso(cell as unknown as Date) };
            if (typeof cell === "number" || typeof cell === "string" || typeof cell === "boolean") return cell;
            return String(cell);
          }),
        ),
      })),
    };
  } catch {
    // Le détail technique n'est pas exposé (il peut contenir des extraits du fichier).
    return {
      ok: false,
      issue: { code: "xlsx_malformed", severity: "error", message: "Le classeur Excel n'a pas pu être lu : il est endommagé ou n'est pas un fichier .xlsx valide." },
    };
  }
}
