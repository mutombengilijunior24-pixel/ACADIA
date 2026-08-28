// ============================================================
// ACADIA — EXPORT PDF (P12.22)
//
// Route API STATELESS : reçoit un DocumentModel déjà construit
// côté client (par DocumentBuilder, à partir du ScientificWork
// P11 déjà validé par le chercheur) et se contente de le mettre en
// page au format PDF. Aucun calcul scientifique n'a lieu ici.
//
// Next.js documente les Route Handlers comme des fichiers
// `route.js|ts` (pas `.tsx`) — ce fichier utilise donc
// React.createElement plutôt que la syntaxe JSX.
// ============================================================

import { existsSync } from "node:fs";
import { createElement as h, type ReactElement } from "react";
import { Document, Page, View, Text, StyleSheet, renderToBuffer, Font } from "@react-pdf/renderer";
import type { DocumentModel, DocumentChapterModel, DocumentTableModel, DocumentFigureModel } from "@/lib/core/export/DocumentTypes";

export const runtime = "nodejs";

Font.registerHyphenationCallback((word) => [word]);

// ------------------------------------------------------------
// La police "Times-Roman" standard intégrée à @react-pdf/renderer
// ne couvre pas les symboles grecs/mathématiques (χ, β, ρ, ², ≠…)
// pourtant courants dans les résultats statistiques (P8/P9) — ils
// s'affichaient déformés. Sur un serveur Windows, la vraie police
// Times New Roman (couverture Unicode complète, incluant le grec)
// est déjà présente sur le système : on l'enregistre si disponible,
// sans dépendance ni police embarquée supplémentaire ; sinon on
// retombe silencieusement sur la police standard PDF intégrée.
// ------------------------------------------------------------

const WINDOWS_FONTS_DIR = "C:/Windows/Fonts";
const CUSTOM_FONT_FAMILY = "AcadiaTimes";

function tryRegisterSystemTimesNewRoman(): boolean {
  const files = {
    regular: `${WINDOWS_FONTS_DIR}/times.ttf`,
    bold: `${WINDOWS_FONTS_DIR}/timesbd.ttf`,
    italic: `${WINDOWS_FONTS_DIR}/timesi.ttf`,
    boldItalic: `${WINDOWS_FONTS_DIR}/timesbi.ttf`,
  };
  if (!Object.values(files).every((f) => existsSync(f))) return false;
  try {
    Font.register({
      family: CUSTOM_FONT_FAMILY,
      fonts: [
        { src: files.regular, fontWeight: "normal", fontStyle: "normal" },
        { src: files.bold, fontWeight: "bold", fontStyle: "normal" },
        { src: files.italic, fontWeight: "normal", fontStyle: "italic" },
        { src: files.boldItalic, fontWeight: "bold", fontStyle: "italic" },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

const HAS_SYSTEM_FONT = tryRegisterSystemTimesNewRoman();

const FONT_REGULAR = HAS_SYSTEM_FONT ? CUSTOM_FONT_FAMILY : "Times-Roman";
const FONT_BOLD_FAMILY = HAS_SYSTEM_FONT ? CUSTOM_FONT_FAMILY : "Times-Bold";
const FONT_BOLD_WEIGHT: "bold" | undefined = HAS_SYSTEM_FONT ? "bold" : undefined;
const FONT_ITALIC_FAMILY = HAS_SYSTEM_FONT ? CUSTOM_FONT_FAMILY : "Times-Italic";
const FONT_ITALIC_STYLE: "italic" | undefined = HAS_SYSTEM_FONT ? "italic" : undefined;

const CM_TO_PT = 28.3465;

function buildStyles(model: DocumentModel) {
  const s = model.style;
  return StyleSheet.create({
    page: {
      fontFamily: FONT_REGULAR,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      paddingTop: s.margins.top * CM_TO_PT,
      paddingBottom: s.margins.bottom * CM_TO_PT + 20,
      paddingLeft: s.margins.left * CM_TO_PT,
      paddingRight: s.margins.right * CM_TO_PT,
    },
    coverInstitution: { fontSize: 14, fontFamily: FONT_BOLD_FAMILY, fontWeight: FONT_BOLD_WEIGHT, textAlign: "center", marginBottom: 8 },
    coverLine: { fontSize: 13, textAlign: "center", marginBottom: 6 },
    coverTitle: { fontSize: 18, fontFamily: FONT_BOLD_FAMILY, fontWeight: FONT_BOLD_WEIGHT, textAlign: "center", marginTop: 40, marginBottom: 30 },
    coverMeta: { fontSize: 12, textAlign: "center", marginBottom: 6 },
    h1: { fontSize: s.headingStyles.chapter.fontSize, fontFamily: FONT_BOLD_FAMILY, fontWeight: FONT_BOLD_WEIGHT, marginTop: 18, marginBottom: 10 },
    h2: { fontSize: s.headingStyles.section.fontSize, fontFamily: FONT_BOLD_FAMILY, fontWeight: FONT_BOLD_WEIGHT, marginTop: 12, marginBottom: 6 },
    paragraph: { fontSize: s.fontSize, textAlign: "justify", marginBottom: 6, textIndent: s.firstLineIndentCm * CM_TO_PT },
    tableTitle: { fontSize: s.fontSize - 1, fontFamily: FONT_BOLD_FAMILY, fontWeight: FONT_BOLD_WEIGHT, marginTop: 8, marginBottom: 4 },
    tableRow: { flexDirection: "row" },
    tableCellHeader: { flex: 1, borderStyle: "solid", borderWidth: 0.5, borderColor: "#999999", backgroundColor: "#EEF2FF", padding: 4, fontFamily: FONT_BOLD_FAMILY, fontWeight: FONT_BOLD_WEIGHT, fontSize: s.fontSize - 1 },
    tableCell: { flex: 1, borderStyle: "solid", borderWidth: 0.5, borderColor: "#999999", padding: 4, fontSize: s.fontSize - 1 },
    source: { fontSize: s.fontSize - 2, fontFamily: FONT_ITALIC_FAMILY, fontStyle: FONT_ITALIC_STYLE, marginTop: 3, marginBottom: 10 },
    figureTitle: { fontSize: s.fontSize - 1, fontFamily: FONT_BOLD_FAMILY, fontWeight: FONT_BOLD_WEIGHT, marginTop: 8, marginBottom: 6 },
    figureRow: { flexDirection: "row", alignItems: "flex-end", height: 120, marginBottom: 4 },
    figureBarWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: 100 },
    figureBarLabel: { fontSize: 7, marginTop: 3, textAlign: "center" },
    figureBarValue: { fontSize: 7, marginBottom: 2, textAlign: "center" },
    footer: { position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontSize: 9, color: "#666666" },
    tocEntry: { fontSize: s.fontSize, marginBottom: 4 },
    note: { fontSize: 9, fontFamily: FONT_ITALIC_FAMILY, fontStyle: FONT_ITALIC_STYLE, marginBottom: 10, color: "#666666" },
  });
}

function pageFooter(styles: ReturnType<typeof buildStyles>) {
  return h(Text, {
    style: styles.footer,
    fixed: true,
    render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`,
  });
}

function renderTable(table: DocumentTableModel, styles: ReturnType<typeof buildStyles>) {
  return h(
    View,
    { key: table.id, wrap: false },
    h(Text, { style: styles.tableTitle }, `Tableau ${table.number} : ${table.title}`),
    h(
      View,
      { style: styles.tableRow },
      ...table.columns.map((col, i) => h(Text, { key: i, style: styles.tableCellHeader }, col))
    ),
    ...table.rows.map((row, ri) =>
      h(
        View,
        { style: styles.tableRow, key: ri },
        ...row.map((cell, ci) => h(Text, { key: ci, style: styles.tableCell }, cell))
      )
    ),
    h(Text, { style: styles.source }, table.source)
  );
}

function renderFigure(figure: DocumentFigureModel, styles: ReturnType<typeof buildStyles>, barColor: string) {
  const max = Math.max(1, ...figure.data.map((d) => d.value));
  return h(
    View,
    { key: figure.id, wrap: false },
    h(Text, { style: styles.figureTitle }, `Figure ${figure.number} : ${figure.title}`),
    h(
      View,
      { style: styles.figureRow },
      ...figure.data.map((d, i) =>
        h(
          View,
          { key: i, style: styles.figureBarWrap },
          h(Text, { style: styles.figureBarValue }, String(d.value)),
          h(View, { style: { width: "60%", height: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: `#${barColor}` } }),
          h(Text, { style: styles.figureBarLabel }, d.label)
        )
      )
    ),
    h(Text, { style: styles.source }, figure.source)
  );
}

function renderChapter(chapter: DocumentChapterModel, model: DocumentModel, styles: ReturnType<typeof buildStyles>) {
  const children: ReactElement[] = [h(Text, { style: styles.h1, key: "title" }, `${chapter.number}. ${chapter.title}`)];
  for (const s of chapter.sections) {
    children.push(h(Text, { style: styles.h2, key: `${s.id}-title` }, `${s.number} ${s.title}`));
    s.paragraphs.forEach((p, i) => children.push(h(Text, { style: styles.paragraph, key: `${s.id}-p-${i}` }, p)));
    for (const tid of s.tableIds) {
      const t = model.tables.find((x) => x.id === tid);
      if (t) children.push(renderTable(t, styles));
    }
    for (const fid of s.figureIds) {
      const f = model.figures.find((x) => x.id === fid);
      if (f) children.push(renderFigure(f, styles, model.style.figureStyle.barColor));
    }
  }
  return h(Page, { size: "A4", style: styles.page, key: chapter.id }, ...children, pageFooter(styles));
}

function buildPdfDocument(model: DocumentModel) {
  const styles = buildStyles(model);

  const coverPage = h(
    Page,
    { size: "A4", style: styles.page, key: "cover" },
    h(Text, { style: styles.coverInstitution }, model.coverPage.institution),
    h(Text, { style: styles.coverLine }, model.coverPage.faculty),
    h(Text, { style: [styles.coverLine, { marginBottom: 40 }] }, model.coverPage.department),
    h(Text, { style: styles.coverTitle }, model.coverPage.title),
    h(Text, { style: [styles.coverMeta, { marginBottom: 40 }] }, model.coverPage.degreeStatement),
    h(Text, { style: styles.coverMeta }, `Par : ${model.coverPage.author}`),
    h(Text, { style: [styles.coverMeta, { marginBottom: 40 }] }, `Directeur / encadreur : ${model.coverPage.supervisor}`),
    h(Text, { style: styles.coverMeta }, `Année académique : ${model.coverPage.academicYear}`)
  );

  const preliminaryEntries: [string, string][] = [
    ["Dédicace", model.preliminary.dedication],
    ["Remerciements", model.preliminary.acknowledgements],
    ["Épigraphe", model.preliminary.epigraph],
    ["Résumé", model.preliminary.abstract],
    ["Abstract", model.preliminary.abstractEn],
  ];
  const preliminaryPages = preliminaryEntries.map(([title, text]) =>
    h(
      Page,
      { size: "A4", style: styles.page, key: `prelim-${title}` },
      h(Text, { style: styles.h1 }, title),
      h(Text, { style: styles.paragraph }, text),
      pageFooter(styles)
    )
  );

  const listsPage = h(
    Page,
    { size: "A4", style: styles.page, key: "lists" },
    h(Text, { style: styles.h1 }, "Liste des tableaux"),
    ...(model.tables.length === 0
      ? [h(Text, { style: styles.paragraph, key: "no-tables" }, "Aucun tableau dans ce document.")]
      : model.tables.map((t) => h(Text, { style: styles.tocEntry, key: `lt-${t.id}` }, `Tableau ${t.number} : ${t.title}`))),
    h(Text, { style: styles.h1 }, "Liste des figures"),
    ...(model.figures.length === 0
      ? [h(Text, { style: styles.paragraph, key: "no-figures" }, "Aucune figure dans ce document.")]
      : model.figures.map((f) => h(Text, { style: styles.tocEntry, key: `lf-${f.id}` }, `Figure ${f.number} : ${f.title}`))),
    pageFooter(styles)
  );

  const tocPage = h(
    Page,
    { size: "A4", style: styles.page, key: "toc" },
    h(Text, { style: styles.h1 }, "Table des matières"),
    h(
      Text,
      { style: styles.note },
      "Les numéros de page ne sont pas indiqués ici (la pagination réelle dépend du rendu final) — se référer à la navigation par signets du lecteur PDF."
    ),
    ...model.tableOfContents.map((entry, i) =>
      h(Text, { style: [styles.tocEntry, entry.level === 1 ? { fontFamily: FONT_BOLD_FAMILY, fontWeight: FONT_BOLD_WEIGHT } : { marginLeft: 14 }], key: i }, `${entry.number}  ${entry.title}`)
    ),
    pageFooter(styles)
  );

  const chapterPages = model.chapters.map((c) => renderChapter(c, model, styles));

  const annexesPage = h(
    Page,
    { size: "A4", style: styles.page, key: "annexes" },
    h(Text, { style: styles.h1 }, "Annexes"),
    ...(model.annexes.length === 0
      ? [h(Text, { style: styles.paragraph, key: "no-annexes" }, "Aucune annexe disponible pour ce projet.")]
      : model.annexes.map((a) => h(Text, { style: styles.paragraph, key: a.id }, `Annexe ${a.number} — ${a.title}`))),
    pageFooter(styles)
  );

  const bibliographyPage = h(
    Page,
    { size: "A4", style: styles.page, key: "bibliography" },
    h(Text, { style: styles.h1 }, "Bibliographie"),
    ...(model.bibliography.length === 0
      ? [h(Text, { style: styles.paragraph, key: "no-refs" }, "Aucune référence enregistrée.")]
      : model.bibliography.map((ref) => h(Text, { style: styles.paragraph, key: ref.id }, ref.formatted))),
    pageFooter(styles)
  );

  return h(
    Document,
    { title: model.coverPage.title, author: model.coverPage.author !== "À compléter" ? model.coverPage.author : undefined },
    coverPage,
    ...preliminaryPages,
    listsPage,
    tocPage,
    ...chapterPages,
    annexesPage,
    bibliographyPage
  );
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

  try {
    const buffer = await renderToBuffer(buildPdfDocument(model));
    const fileName = `${model.projectId}-${model.workType}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, "_");

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    // Le moteur de rendu PDF (@react-pdf/renderer / pdfkit) peut échouer sur des
    // documents scientifiques très volumineux (nombreux tableaux/figures cumulés
    // sur de nombreuses pages) — limite connue du moteur de mise en page tierce,
    // pas un défaut du DocumentModel lui-même (voir ACADIA_P18_FINAL_TEST_REPORT.md
    // Blocker 3). On ne masque jamais l'échec ni n'invente un PDF vide : on renvoie
    // une erreur claire et actionnable, jamais de trace technique au client.
    console.error("[ACADIA] Erreur de rendu PDF :", error);
    return new Response(
      JSON.stringify({
        error: "PDF_RENDER_FAILED",
        message:
          "La génération du PDF a échoué, probablement en raison du volume du document (nombreux tableaux/figures). Utilisez l'export DOCX en alternative, ou réduisez le contenu exporté.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
