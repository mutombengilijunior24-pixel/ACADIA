// ============================================================
// ACADIA — DOCUMENT EXPORT TYPES (P12)
//
// P12 est un bloc de MISE EN PAGE / EXPORT — jamais de logique
// scientifique ici. Le DocumentModel défini ci-dessous est une
// simple reformulation, pour l'impression, du ScientificWork (P11)
// déjà construit et validé par le chercheur. Aucune valeur
// numérique, référence, auteur ou résultat n'est recalculé ou
// inventé à ce niveau — voir DocumentBuilder.ts.
// ============================================================

import type { ScientificWorkType } from "@/lib/core/scientific-work/ScientificWorkTypes";

export type { ScientificWorkType };

export type ExportFormat = "docx" | "pdf";

// ------------------------------------------------------------
// STYLE ACADÉMIQUE — modifiable par le chercheur, jamais présenté
// comme une norme institutionnelle obligatoire (P12.5).
// ------------------------------------------------------------

export interface DocumentMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface DocumentHeadingStyle {
  fontSize: number;
  bold: boolean;
  uppercase: boolean;
  spacingBeforePt: number;
  spacingAfterPt: number;
}

export interface DocumentStyle {
  pageSize: "A4" | "Letter";
  margins: DocumentMargins;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  headingStyles: {
    chapter: DocumentHeadingStyle;
    section: DocumentHeadingStyle;
    subsection: DocumentHeadingStyle;
  };
  paragraphSpacingAfterPt: number;
  firstLineIndentCm: number;
  header: { enabled: boolean; text: string };
  footer: { enabled: boolean; text: string };
  pageNumbering: { enabled: boolean; startAt: number };
  tableStyle: { borderColor: string; headerBackground: string };
  figureStyle: { barColor: string };
  citationStyle: "harvard";
}

export const DEFAULT_DOCUMENT_STYLE: DocumentStyle = {
  pageSize: "A4",
  margins: { top: 2.5, bottom: 2.5, left: 3, right: 2 },
  fontFamily: "Times New Roman",
  fontSize: 12,
  lineHeight: 1.5,
  headingStyles: {
    chapter: { fontSize: 16, bold: true, uppercase: true, spacingBeforePt: 24, spacingAfterPt: 12 },
    section: { fontSize: 13, bold: true, uppercase: false, spacingBeforePt: 16, spacingAfterPt: 8 },
    subsection: { fontSize: 12, bold: true, uppercase: false, spacingBeforePt: 12, spacingAfterPt: 6 },
  },
  paragraphSpacingAfterPt: 6,
  firstLineIndentCm: 1.25,
  header: { enabled: true, text: "" },
  footer: { enabled: true, text: "" },
  pageNumbering: { enabled: true, startAt: 1 },
  tableStyle: { borderColor: "999999", headerBackground: "EEF2FF" },
  figureStyle: { barColor: "2554EB" },
  citationStyle: "harvard",
};

// ------------------------------------------------------------
// PAGE DE GARDE (P12.6) — jamais inventée : "À compléter" si absent.
// ------------------------------------------------------------

export const COVER_TO_COMPLETE = "À compléter";

export interface CoverPageInfo {
  institution: string;
  faculty: string;
  department: string;
  title: string;
  degreeStatement: string;
  author: string;
  supervisor: string;
  academicYear: string;
}

// ------------------------------------------------------------
// PAGES PRÉLIMINAIRES (P12.7)
// ------------------------------------------------------------

export const PRELIMINARY_TO_COMPLETE = "À compléter par le chercheur.";

export interface DocumentPreliminary {
  dedication: string;
  acknowledgements: string;
  epigraph: string;
  abstract: string;
  abstractEn: string;
}

// ------------------------------------------------------------
// TABLE DES MATIÈRES (P12.8)
// ------------------------------------------------------------

export interface DocumentTocEntry {
  level: 1 | 2 | 3;
  number: string;
  title: string;
}

// ------------------------------------------------------------
// TABLEAUX / FIGURES (P12.13/14) — numérotation séquentielle,
// source jamais inventée ("Source : données du projet." si l'année
// n'est pas connue — jamais "Données d'enquête, 2026" fabriqué).
// ------------------------------------------------------------

export const DEFAULT_SOURCE_LABEL = "Source : données du projet.";

export interface DocumentTableModel {
  id: string;
  number: number;
  title: string;
  columns: string[];
  rows: string[][];
  source: string;
}

export interface DocumentFigureModel {
  id: string;
  number: number;
  title: string;
  kind: "bar";
  data: { label: string; value: number }[];
  source: string;
}

// ------------------------------------------------------------
// CHAPITRES / SECTIONS — repris tels quels de ScientificWork (P11),
// jamais réécrits ni réinterprétés.
// ------------------------------------------------------------

export interface DocumentSectionModel {
  id: string;
  number: string;
  title: string;
  paragraphs: string[];
  tableIds: string[];
  figureIds: string[];
  hasPlaceholder: boolean;
}

export interface DocumentChapterModel {
  id: string;
  number: string;
  title: string;
  sections: DocumentSectionModel[];
}

// ------------------------------------------------------------
// ANNEXES (P12.19) — uniquement si l'élément existe réellement.
// ------------------------------------------------------------

export interface DocumentAnnexModel {
  id: string;
  number: number;
  title: string;
  available: boolean;
  note: string;
}

// ------------------------------------------------------------
// BIBLIOGRAPHIE (P12.18) — uniquement les références réellement
// enregistrées par le chercheur, triées alphabétiquement.
// ------------------------------------------------------------

export interface DocumentBibliographyEntryModel {
  id: string;
  formatted: string;
}

// ------------------------------------------------------------
// MODÈLE DE DOCUMENT COMPLET — source unique pour DOCX et PDF.
// ------------------------------------------------------------

export interface DocumentModel {
  projectId: string;
  workType: ScientificWorkType;
  workTypeLabel: string;
  coverPage: CoverPageInfo;
  preliminary: DocumentPreliminary;
  tableOfContents: DocumentTocEntry[];
  chapters: DocumentChapterModel[];
  tables: DocumentTableModel[];
  figures: DocumentFigureModel[];
  annexes: DocumentAnnexModel[];
  bibliography: DocumentBibliographyEntryModel[];
  style: DocumentStyle;
  generatedAt: string;
}

// ------------------------------------------------------------
// EXPORT READINESS (P12.24) — distinct de la readiness scientifique
// (P11) : un document peut être techniquement exportable même si le
// travail scientifique reste incomplet. Les deux ne doivent jamais
// être confondus dans l'interface.
// ------------------------------------------------------------

export type ExportCheckStatus = "READY" | "WARNING" | "BLOCKED";

export interface ExportCheckItem {
  id: string;
  label: string;
  status: ExportCheckStatus;
  detail: string;
}

export interface ExportReadinessResult {
  items: ExportCheckItem[];
  overallStatus: ExportCheckStatus;
  documentExportable: boolean;
}

// ------------------------------------------------------------
// HISTORIQUE D'EXPORT — persisté via la même architecture
// localStorage que le reste de l'application (P12, pas de nouveau
// paradigme de stockage).
// ------------------------------------------------------------

export interface ExportHistoryEntry {
  id: string;
  format: ExportFormat;
  workType: ScientificWorkType;
  generatedAt: string;
  fileName: string;
  sizeBytes: number;
}
