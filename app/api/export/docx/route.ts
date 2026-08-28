// ============================================================
// ACADIA — EXPORT DOCX (P12.21)
//
// Route API STATELESS : reçoit un DocumentModel déjà construit
// côté client (par DocumentBuilder, à partir du ScientificWork
// P11 déjà validé par le chercheur) et se contente de le mettre en
// page au format Word. Aucun calcul scientifique n'a lieu ici —
// cette route ne fait que FORMATER ce qui lui est envoyé.
// ============================================================

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
  convertMillimetersToTwip,
} from "docx";
import type { DocumentModel, DocumentChapterModel } from "@/lib/core/export/DocumentTypes";

export const runtime = "nodejs";

function pt(n: number): number {
  return Math.round(n * 2);
}

function cmToTwip(n: number): number {
  return convertMillimetersToTwip(n * 10);
}

function bodyParagraph(text: string, style: DocumentModel["style"]): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: cmToTwip(style.firstLineIndentCm) },
    spacing: { after: pt(style.paragraphSpacingAfterPt), line: Math.round(style.lineHeight * 240) },
    children: [new TextRun({ text, font: style.fontFamily, size: pt(style.fontSize) })],
  });
}

function headingParagraph(text: string, level: 1 | 2 | 3, style: DocumentModel["style"]): Paragraph {
  const cfg = level === 1 ? style.headingStyles.chapter : level === 2 ? style.headingStyles.section : style.headingStyles.subsection;
  const heading = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
  return new Paragraph({
    heading,
    spacing: { before: pt(cfg.spacingBeforePt), after: pt(cfg.spacingAfterPt) },
    children: [
      new TextRun({
        text: cfg.uppercase ? text.toUpperCase() : text,
        bold: cfg.bold,
        font: style.fontFamily,
        size: pt(cfg.fontSize),
      }),
    ],
  });
}

function dataTable(table: DocumentModel["tables"][number], style: DocumentModel["style"]): (Paragraph | Table)[] {
  const title = new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text: `Tableau ${table.number} : ${table.title}`, bold: true, font: style.fontFamily, size: pt(style.fontSize - 1) })],
  });

  const headerRow = new TableRow({
    children: table.columns.map(
      (col) =>
        new TableCell({
          shading: { fill: style.tableStyle.headerBackground },
          children: [new Paragraph({ children: [new TextRun({ text: col, bold: true, font: style.fontFamily, size: pt(style.fontSize - 1) })] })],
        })
    ),
  });

  const rows = table.rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: cell, font: style.fontFamily, size: pt(style.fontSize - 1) })] })],
            })
        ),
      })
  );

  const grid = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...rows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: style.tableStyle.borderColor },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: style.tableStyle.borderColor },
      left: { style: BorderStyle.SINGLE, size: 2, color: style.tableStyle.borderColor },
      right: { style: BorderStyle.SINGLE, size: 2, color: style.tableStyle.borderColor },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: style.tableStyle.borderColor },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: style.tableStyle.borderColor },
    },
  });

  const source = new Paragraph({
    spacing: { before: 60, after: 200 },
    children: [new TextRun({ text: table.source, italics: true, font: style.fontFamily, size: pt(style.fontSize - 2) })],
  });

  return [title, grid, source];
}

function figureNote(figure: DocumentModel["figures"][number], style: DocumentModel["style"]): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 200 },
    children: [
      new TextRun({
        text: `Figure ${figure.number} : ${figure.title} — voir le tableau ci-dessus pour la représentation chiffrée (l'export DOCX ne produit pas de graphique vectoriel dans cette version ; voir l'export PDF pour une figure graphique). ${figure.source}`,
        italics: true,
        font: style.fontFamily,
        size: pt(style.fontSize - 2),
      }),
    ],
  });
}

function renderChapter(chapter: DocumentChapterModel, model: DocumentModel): (Paragraph | Table)[] {
  const nodes: (Paragraph | Table)[] = [headingParagraph(`${chapter.number}. ${chapter.title}`, 1, model.style)];
  for (const s of chapter.sections) {
    nodes.push(headingParagraph(`${s.number} ${s.title}`, 2, model.style));
    for (const p of s.paragraphs) nodes.push(bodyParagraph(p, model.style));
    for (const tid of s.tableIds) {
      const t = model.tables.find((x) => x.id === tid);
      if (t) nodes.push(...dataTable(t, model.style));
    }
    for (const fid of s.figureIds) {
      const f = model.figures.find((x) => x.id === fid);
      if (f) nodes.push(figureNote(f, model.style));
    }
  }
  return nodes;
}

export async function POST(request: Request) {
  let model: DocumentModel;
  try {
    model = (await request.json()) as DocumentModel;
  } catch {
    return new Response(JSON.stringify({ error: "Corps de requête invalide." }), { status: 400 });
  }

  if (!model || !model.chapters) {
    return new Response(JSON.stringify({ error: "DocumentModel manquant ou invalide." }), { status: 400 });
  }

  const style = model.style;
  const children: (Paragraph | Table)[] = [];

  // -------- PAGE DE GARDE --------
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: model.coverPage.institution, bold: true, font: style.fontFamily, size: pt(14) })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: model.coverPage.faculty, font: style.fontFamily, size: pt(13) })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 800 }, children: [new TextRun({ text: model.coverPage.department, font: style.fontFamily, size: pt(13) })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: model.coverPage.title, bold: true, font: style.fontFamily, size: pt(18) })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 800 }, children: [new TextRun({ text: model.coverPage.degreeStatement, font: style.fontFamily, size: pt(12) })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: `Par : ${model.coverPage.author}`, font: style.fontFamily, size: pt(12) })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: `Directeur / encadreur : ${model.coverPage.supervisor}`, font: style.fontFamily, size: pt(12) })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `Année académique : ${model.coverPage.academicYear}`, font: style.fontFamily, size: pt(12) })] }),
    new Paragraph({ pageBreakBefore: true, children: [] })
  );

  // -------- PAGES PRÉLIMINAIRES --------
  const preliminaryEntries: [string, string][] = [
    ["Dédicace", model.preliminary.dedication],
    ["Remerciements", model.preliminary.acknowledgements],
    ["Épigraphe", model.preliminary.epigraph],
    ["Résumé", model.preliminary.abstract],
    ["Abstract", model.preliminary.abstractEn],
  ];
  for (const [title, text] of preliminaryEntries) {
    children.push(headingParagraph(title, 1, style), bodyParagraph(text, style), new Paragraph({ pageBreakBefore: true, children: [] }));
  }

  // -------- LISTE DES TABLEAUX / FIGURES --------
  children.push(headingParagraph("Liste des tableaux", 1, style));
  if (model.tables.length === 0) {
    children.push(bodyParagraph("Aucun tableau dans ce document.", style));
  } else {
    for (const t of model.tables) children.push(bodyParagraph(`Tableau ${t.number} : ${t.title}`, style));
  }
  children.push(headingParagraph("Liste des figures", 1, style));
  if (model.figures.length === 0) {
    children.push(bodyParagraph("Aucune figure dans ce document.", style));
  } else {
    for (const f of model.figures) children.push(bodyParagraph(`Figure ${f.number} : ${f.title}`, style));
  }
  children.push(new Paragraph({ pageBreakBefore: true, children: [] }));

  // -------- TABLE DES MATIÈRES (champ Word réel, mis à jour via F9) --------
  children.push(
    headingParagraph("Table des matières", 1, style),
    new Paragraph({ children: [new TextRun({ text: "(Clic droit → Mettre à jour les champs, dans Word, pour afficher la pagination réelle.)", italics: true, size: pt(9) })] }),
    new TableOfContents("Table des matières", { hyperlink: true, headingStyleRange: "1-2" }),
    new Paragraph({ pageBreakBefore: true, children: [] })
  );

  // -------- CHAPITRES --------
  for (const chapter of model.chapters) {
    children.push(...renderChapter(chapter, model));
  }

  // -------- ANNEXES --------
  children.push(headingParagraph("Annexes", 1, style));
  if (model.annexes.length === 0) {
    children.push(bodyParagraph("Aucune annexe disponible pour ce projet.", style));
  } else {
    for (const a of model.annexes) children.push(bodyParagraph(`Annexe ${a.number} — ${a.title}`, style));
  }

  // -------- BIBLIOGRAPHIE --------
  children.push(headingParagraph("Bibliographie", 1, style));
  if (model.bibliography.length === 0) {
    children.push(bodyParagraph("Aucune référence enregistrée.", style));
  } else {
    for (const ref of model.bibliography) children.push(bodyParagraph(ref.formatted, style));
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: style.fontFamily, size: pt(style.fontSize) } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: cmToTwip(21), height: cmToTwip(29.7) },
            margin: { top: cmToTwip(style.margins.top), bottom: cmToTwip(style.margins.bottom), left: cmToTwip(style.margins.left), right: cmToTwip(style.margins.right) },
          },
        },
        headers: style.header.enabled
          ? { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: style.header.text || model.coverPage.title, size: pt(9) })] })] }) }
          : undefined,
        footers: style.footer.enabled
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ children: [PageNumber.CURRENT], size: pt(9) })],
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const fileName = `${model.projectId}-${model.workType}.docx`.replace(/[^a-zA-Z0-9_.-]/g, "_");

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
