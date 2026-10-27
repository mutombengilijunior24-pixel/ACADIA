/**
 * Écriture d'un vrai document Word (.docx, OOXML) : styles de titres, tableaux à en-tête coloré et
 * graphiques NATIFS Word (survol, « Modifier les données », couleurs modifiables), chacun relié à un
 * petit classeur Excel incorporé contenant ses données. Le document se déclare au format Word actuel
 * (sinon Word l'ouvre en « Mode de compatibilité ») ; sous chaque titre de section, une vraie ligne
 * horizontale Word, qu'on sélectionne d'un clic et qu'on supprime avec la touche Suppr.
 * Aucune dépendance autre que fflate (ZIP).
 */
import { strToU8, zipSync } from "fflate";

import { chartTable } from "./chartSpecs";
import { formatCell, plainText, type ReportDocument } from "./document";
import { chartSpaceXml, nativeChartSize } from "./ooxmlCharts";
import { buildWorkbook } from "./xlsx";

const esc = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

// Les sauts de ligne deviennent de vrais retours à la ligne Word ; aucune balise n'est recopiée en texte.
const run = (text: string, props = "") => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}${plainText(text).split("\n").map((line) => `<w:t xml:space="preserve">${esc(line)}</w:t>`).join("<w:br/>")}</w:r>`;
const para = (content: string, style?: string, extra = "") => `<w:p>${style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extra}</w:pPr>` : ""}${content}</w:p>`;

/** Ligne horizontale Word (Bordure > Ligne horizontale) : un objet à part, cliquable et supprimable. */
const separator = (id: number) =>
  `<w:p><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="120" w:line="160" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:rect id="_x0000_i${1024 + id}" style="width:0;height:1.5pt" o:hralign="center" o:hrstd="t" o:hrnoshade="t" o:hr="t" fillcolor="#C7D2FE" stroked="f"/></w:pict></w:r></w:p>`;

const SETTINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;

const EMU_PER_PX = 9525;
const MAX_WIDTH_PX = 600;

function tableXml(head: string[], rows: Array<Array<string | number>>): string {
  const cellXml = (value: string | number, header: boolean) =>
    `<w:tc><w:tcPr>${header ? '<w:shd w:val="clear" w:color="auto" w:fill="E0E7FF"/>' : ""}</w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/>${typeof value === "number" ? '<w:jc w:val="right"/>' : ""}</w:pPr>${run(String(formatCell(value)), header ? '<w:b/><w:color w:val="1E1B4B"/><w:sz w:val="20"/>' : '<w:sz w:val="20"/>')}</w:p></w:tc>`;
  return `<w:tbl><w:tblPr><w:tblStyle w:val="AcadiaTable"/><w:tblW w:w="5000" w:type="pct"/><w:tblLook w:val="04A0" w:firstRow="1"/></w:tblPr>${`<w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((h) => cellXml(h, true)).join("")}</w:tr>`}${rows
    .map((r) => `<w:tr>${head.map((_, i) => cellXml(r[i] ?? "", false)).join("")}</w:tr>`)
    .join("")}</w:tbl>${para("", undefined, '<w:spacing w:after="60"/>')}`;
}

function chartXml(id: number, rel: string, width: number, height: number): string {
  const scale = Math.min(1, MAX_WIDTH_PX / width);
  const cx = Math.round(width * scale * EMU_PER_PX);
  const cy = Math.round(height * scale * EMU_PER_PX);
  return `<w:p><w:pPr><w:jc w:val="center"/><w:keepNext/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Graphique ${id}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="${rel}"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="0F172A"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:color w:val="312E81"/><w:sz w:val="44"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="40"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="312E81"/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="1E293B"/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="334155"/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="475569"/><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Warn"><w:name w:val="Avertissement"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:left w:val="single" w:sz="24" w:space="6" w:color="F59E0B"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FEF3C7"/><w:ind w:left="120"/></w:pPr><w:rPr><w:color w:val="78350F"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/></w:pPr><w:rPr><w:b/><w:color w:val="1E293B"/><w:sz w:val="21"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Note"><w:name w:val="Note"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr><w:rPr><w:i/><w:color w:val="64748B"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Bullet"><w:name w:val="Liste à puces"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/><w:ind w:left="360" w:hanging="240"/></w:pPr></w:style>
<w:style w:type="table" w:styleId="AcadiaTable"><w:name w:val="Tableau ACADIA"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:color="CBD5E1"/></w:tblBorders><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

export function buildDocx(doc: ReportDocument): Uint8Array {
  const media: Record<string, Uint8Array> = {};
  const chartOverrides: string[] = [];
  const rels: string[] = ['<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>', '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'];
  let separators = 0;
  let chartIndex = 0;
  let drawingId = 1;
  const body = doc.blocks
    .map((b) => {
      switch (b.type) {
        case "title":
          return para(run(b.text), "Title");
        case "h1":
          return para(run(b.text), "Heading1") + separator(++separators);
        case "h2":
          return para(run(b.text), "Heading2");
        case "h3":
          return para(run(b.text), "Heading3");
        case "p":
          return para(run(b.text, b.bold ? "<w:b/>" : "") + (b.tag ? run(`  ${b.tag}`, '<w:i/><w:color w:val="4F46E5"/><w:sz w:val="16"/>') : ""));
        case "meta":
          return para(run(b.text), "Meta");
        case "warn":
          return para(run(b.text), "Warn");
        case "bullets":
          return b.items.map((item) => para(run(`•  ${item}`), "Bullet")).join("");
        case "table":
          return tableXml(b.head, b.rows);
        case "chart": {
          chartIndex += 1;
          const k = chartIndex;
          const table = chartTable(b.spec);
          // Classeur incorporé : les données du graphique, modifiables depuis Word.
          media[`word/embeddings/Donnees_graphique${k}.xlsx`] = buildWorkbook([{ name: "Données", rows: [table.head, ...table.rows], bold: [0], widths: [36, 16, 16, 16] }]);
          media[`word/charts/chart${k}.xml`] = strToU8(chartSpaceXml(b.spec, { sheet: "Données", headerRow: 1 }, "rIdData"));
          media[`word/charts/_rels/chart${k}.xml.rels`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdData" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/Donnees_graphique${k}.xlsx"/></Relationships>`);
          chartOverrides.push(`<Override PartName="/word/charts/chart${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
          const rel = `rIdChart${k}`;
          rels.push(`<Relationship Id="${rel}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="charts/chart${k}.xml"/>`);
          const size = nativeChartSize(b.spec);
          return chartXml(drawingId++, rel, size.width, size.height) + (b.spec.note ? para(run(b.spec.note), "Note") : "");
        }
      }
    })
    .join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1077" w:bottom="1134" w:left="1077" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${chartOverrides.join("")}</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    ),
    "docProps/core.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(doc.title)}</dc:title><dc:creator>ACADIA</dc:creator><dc:language>fr-FR</dc:language></cp:coreProperties>`,
    ),
    "word/_rels/document.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`),
    "word/document.xml": strToU8(document),
    "word/styles.xml": strToU8(STYLES),
    "word/settings.xml": strToU8(SETTINGS),
    ...media,
  });
}
