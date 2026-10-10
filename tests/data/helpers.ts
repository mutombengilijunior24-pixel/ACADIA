/**
 * Utilitaires des tests du chantier A.
 * Toutes les données utilisées sont SYNTHÉTIQUES, construites pour les tests : ce ne sont
 * pas des données de recherche réelles.
 */
import { strToU8, zipSync } from "fflate";

import { importFile } from "@/lib/core/data/importer";
import type { ImportLimits } from "@/lib/core/data/limits";
import type { ImportOptions, ImportedDataset } from "@/lib/core/data/types";

export const utf8 = (text: string) => new TextEncoder().encode(text);

/** Encode en Windows-1252 (caractères latins) pour simuler un export Excel « CSV » sous Windows. */
export function windows1252(text: string): Uint8Array {
  const table: Record<string, number> = { "é": 0xe9, "è": 0xe8, "ê": 0xea, "à": 0xe0, "ç": 0xe7, "ô": 0xf4, "É": 0xc9, "ï": 0xef };
  return Uint8Array.from([...text].map((char) => table[char] ?? char.charCodeAt(0)));
}

export async function importOk(name: string, bytes: Uint8Array, options: ImportOptions = {}, limits?: ImportLimits): Promise<ImportedDataset> {
  const result = await importFile(name, bytes, options, limits);
  if (!result.ok) throw new Error(`Import refusé : ${result.issues.map((issue) => issue.code).join(", ")}`);
  return result.dataset;
}

export async function importErrorCodes(name: string, bytes: Uint8Array, options: ImportOptions = {}, limits?: ImportLimits): Promise<string[]> {
  const result = await importFile(name, bytes, options, limits);
  if (result.ok) throw new Error("Import accepté alors qu'un refus était attendu");
  return result.issues.map((issue) => issue.code);
}

/* ---------------------------------------------------------------
   Construction de classeurs XLSX synthétiques (format OOXML minimal).
--------------------------------------------------------------- */

export type XCell = string | number | boolean | null | { date: number } | { raw: string };

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    letters = String.fromCharCode(65 + r) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function sheetXml(rows: XCell[][]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          if (cell === null) return "";
          const ref = `${columnLetter(c)}${r + 1}`;
          if (typeof cell === "number") return `<c r="${ref}"><v>${cell}</v></c>`;
          if (typeof cell === "boolean") return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
          if (typeof cell === "string") return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
          if ("date" in cell) return `<c r="${ref}" s="1"><v>${cell.date}</v></c>`;
          return cell.raw;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

/** Classeur avec une ou plusieurs feuilles ; `{ date: n }` = numéro de série Excel au format date (numFmt 14). */
export function buildXlsx(sheets: Array<{ name: string; rows: XCell[][] }>): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
        .map((sheet, i) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" xfId="0"/><xf numFmtId="14" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    ),
  };
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet.rows));
  });
  return zipSync(files);
}
