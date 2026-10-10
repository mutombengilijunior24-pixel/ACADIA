/**
 * Écriture d'un classeur Excel (.xlsx, format OOXML) sans dépendance lourde :
 * XML des feuilles + archive ZIP (fflate, déjà utilisé par le projet).
 * Mise en forme : titres, en-têtes de tableaux colorés et encadrés, texte renvoyé à la ligne,
 * graphiques natifs Excel reliés à leurs données.
 */
import { strToU8, zipSync } from "fflate";

import { chartTable, type ChartSpec } from "./chartSpecs";
import { plainText } from "./document";
import { chartSpaceXml, nativeChartSize } from "./ooxmlCharts";

export type Cell = string | number | boolean | null | undefined;

/** Graphique natif Excel, relié à un tableau de données de la même feuille. */
export interface SheetChart {
  spec: ChartSpec;
  /** Ligne d'en-tête du tableau de données (1 = première ligne). */
  headerRow: number;
  /** Ancrage du graphique (ligne et colonne, 0 = première). */
  row: number;
  col: number;
  width: number;
  height: number;
}

export interface Sheet {
  name: string;
  rows: Cell[][];
  /** Largeurs de colonnes (en caractères). */
  widths?: number[];
  /** Lignes d'en-tête de tableau (gras, fond indigo clair, bordures). */
  bold?: number[];
  /** Lignes de titre (gras, grande taille, indigo). */
  titles?: number[];
  charts?: SheetChart[];
}

const escapeXml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Caractères de contrôle interdits en XML 1.0.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

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

/** Nom de feuille valide pour Excel : 31 caractères, sans []:*?/\, unique. */
export function sheetName(name: string, used: Set<string>): string {
  const base = (name.replace(/[[\]:*?/\\]/g, " ").trim() || "Feuille").slice(0, 31);
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i += 1) candidate = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

// Styles (cellXfs) : 0 normal (texte renvoyé à la ligne), 1 en-tête de tableau, 2 titre, 3 corps de tableau encadré.
const STYLE_HEADER = 1;
const STYLE_TITLE = 2;

function sheetXml(sheet: Sheet, drawingRel: string | null): string {
  const header = new Set(sheet.bold ?? []);
  const titles = new Set(sheet.titles ?? []);
  const rows = sheet.rows
    .map((row, r) => {
      const style = titles.has(r) ? ` s="${STYLE_TITLE}"` : header.has(r) ? ` s="${STYLE_HEADER}"` : ' s="0"';
      const cells = row
        .map((cell, c) => {
          if (cell === null || cell === undefined || cell === "") return "";
          const ref = `${columnLetter(c)}${r + 1}`;
          if (typeof cell === "number") return Number.isFinite(cell) ? `<c r="${ref}"${style}><v>${cell}</v></c>` : `<c r="${ref}"${style} t="inlineStr"><is><t>${cell > 0 ? "+∞" : cell < 0 ? "−∞" : "—"}</t></is></c>`;
          if (typeof cell === "boolean") return `<c r="${ref}"${style} t="b"><v>${cell ? 1 : 0}</v></c>`;
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(plainText(cell))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}"${titles.has(r) ? ' ht="24" customHeight="1"' : ""}>${cells}</row>`;
    })
    .join("");
  const cols = sheet.widths?.length ? `<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0" showGridLines="${sheet.charts?.length ? 0 : 1}"/></sheetViews>${cols}<sheetData>${rows}</sheetData>${drawingRel ? `<drawing r:id="${drawingRel}"/>` : ""}</worksheet>`;
}

function drawingXml(charts: SheetChart[], firstChart: number): { xml: string; rels: string } {
  const anchors = charts
    .map((chart, i) => {
      const cx = Math.round(chart.width * 9525);
      const cy = Math.round(chart.height * 9525);
      return `<xdr:oneCellAnchor><xdr:from><xdr:col>${chart.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Graphique ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>`;
    })
    .join("");
  return {
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`,
    rels: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${charts
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${firstChart + i}.xml"/>`)
      .join("")}</Relationships>`,
  };
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF1E1B4B"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF312E81"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE0E7FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`;

export function buildWorkbook(sheets: Sheet[]): Uint8Array {
  const used = new Set<string>();
  const named = (sheets.length ? sheets : [{ name: "Feuille", rows: [] }]).map((s) => ({ ...s, name: sheetName(s.name, used) }));
  const files: Record<string, Uint8Array> = {};
  const overrides: string[] = [];
  let chartIndex = 1;
  let drawingIndex = 1;
  named.forEach((sheet, i) => {
    let drawingRel: string | null = null;
    if (sheet.charts?.length) {
      const drawing = drawingXml(sheet.charts, chartIndex);
      sheet.charts.forEach((chart) => {
        files[`xl/charts/chart${chartIndex}.xml`] = strToU8(chartSpaceXml(chart.spec, { sheet: sheet.name, headerRow: chart.headerRow }));
        overrides.push(`<Override PartName="/xl/charts/chart${chartIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
        chartIndex += 1;
      });
      files[`xl/drawings/drawing${drawingIndex}.xml`] = strToU8(drawing.xml);
      files[`xl/drawings/_rels/drawing${drawingIndex}.xml.rels`] = strToU8(drawing.rels);
      files[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdD" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIndex}.xml"/></Relationships>`,
      );
      overrides.push(`<Override PartName="/xl/drawings/drawing${drawingIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
      drawingRel = "rIdD";
      drawingIndex += 1;
    }
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet, drawingRel));
  });
  files["[Content_Types].xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${named
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join("")}${overrides.join("")}</Types>`,
  );
  files["_rels/.rels"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  files["xl/workbook.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${named
      .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets></workbook>`,
  );
  files["xl/_rels/workbook.xml.rels"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${named
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join("")}<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  files["xl/styles.xml"] = strToU8(STYLES);
  return zipSync(files);
}

/** Feuille « Graphiques » : pour chaque graphique, son tableau de données et, à côté, le graphique natif relié. */
export function chartsSheet(specs: ChartSpec[]): Sheet {
  const rows: Cell[][] = [["Graphiques — modifiez une valeur du tableau : le graphique se met à jour"]];
  const titles = [0];
  const bold: number[] = [];
  const charts: SheetChart[] = [];
  let row = 2;
  for (const spec of specs) {
    const table = chartTable(spec);
    const size = nativeChartSize(spec);
    rows[row] = [spec.title];
    titles.push(row);
    const header = row + 1;
    rows[header] = table.head;
    bold.push(header);
    table.rows.forEach((r, i) => {
      rows[header + 1 + i] = r;
    });
    // En-tête à la ligne header (0-based) → header + 1 en numérotation Excel.
    charts.push({ spec, headerRow: header + 1, row: row, col: Math.max(3, table.head.length + 1), width: size.width, height: size.height });
    const chartRows = Math.ceil(size.height / 20);
    row += Math.max(table.rows.length + 3, chartRows + 2) + 1;
  }
  for (let i = 0; i < rows.length; i += 1) rows[i] = rows[i] ?? [];
  return { name: "Graphiques", rows, widths: [34, 16, 16, 16, 4, 4], titles, bold, charts };
}
