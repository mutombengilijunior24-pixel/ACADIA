// ============================================================
// ACADIA — EXPORT BIBLIOGRAPHIQUE (mission Bibliography & Reference
// Intelligence §34)
//
// Même patron que lib/server/survey/SurveyExport.ts (CSV avec BOM
// UTF-8 + point-virgule) — jamais une deuxième convention d'export
// inventée pour ce module. `docx`/Word déjà supporté par ACADIA reste
// non modifié (lib/core/export/DocumentBibliographyBuilder.ts, autre
// pipeline, pour l'export de mémoire complet — hors périmètre ici).
// ============================================================

import type { Reference } from "@prisma/client";
import type { CitationStyle } from "@/lib/core/research/reference/ReferenceTypes";
import { formatReference } from "@/lib/core/research/reference/BibliographyEngine";

function csvEscape(value: string): string {
  if (/[";\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function referencesToPlainRows(references: Reference[]) {
  return references.map((r) => ({
    title: r.title,
    authors: (JSON.parse(r.authors) as string[]).join("; "),
    year: r.year !== null ? String(r.year) : "",
    sourceType: r.sourceType,
    journal: r.journal ?? "",
    publisher: r.publisher ?? "",
    doi: r.doi ?? "",
    isbn: r.isbn ?? "",
    url: r.url ?? "",
    verificationStatus: r.verificationStatus,
    provenance: r.provenance,
  }));
}

export function buildReferencesCsv(references: Reference[]): string {
  const headers = ["Titre", "Auteurs", "Année", "Type", "Revue", "Éditeur", "DOI", "ISBN", "URL", "Statut de vérification", "Provenance"];
  const lines = [headers.map(csvEscape).join(";")];
  for (const row of referencesToPlainRows(references)) {
    lines.push([row.title, row.authors, row.year, row.sourceType, row.journal, row.publisher, row.doi, row.isbn, row.url, row.verificationStatus, row.provenance].map(csvEscape).join(";"));
  }
  return "﻿" + lines.join("\r\n");
}

const SOURCE_TYPE_TO_BIBTEX_TYPE: Record<string, string> = {
  JOURNAL_ARTICLE: "article",
  BOOK: "book",
  BOOK_CHAPTER: "incollection",
  THESIS: "mastersthesis",
  DISSERTATION: "phdthesis",
  REPORT: "techreport",
  INSTITUTIONAL_REPORT: "techreport",
  GOVERNMENT_DOCUMENT: "misc",
  LAW_OR_REGULATION: "misc",
  CONFERENCE_PAPER: "inproceedings",
  DATASET: "misc",
  WEBSITE: "online",
  WORKING_PAPER: "unpublished",
  OTHER: "misc",
};

function bibtexKey(ref: Reference): string {
  const authors = JSON.parse(ref.authors) as string[];
  const firstAuthorSurname = (authors[0]?.split(",")[0] ?? "ref").replace(/[^a-zA-Z0-9]/g, "");
  return `${firstAuthorSurname || "ref"}${ref.year ?? ""}${ref.id.slice(0, 4)}`;
}

/** Export BibTeX — n'écrit que les champs réellement renseignés, jamais un champ vide inventé (mission §24/§34). */
export function buildBibtex(references: Reference[]): string {
  const blocks = references.map((ref) => {
    const type = SOURCE_TYPE_TO_BIBTEX_TYPE[ref.sourceType] ?? "misc";
    const authors = (JSON.parse(ref.authors) as string[]).join(" and ");
    const fields: [string, string | null][] = [
      ["author", authors || null],
      ["title", ref.title],
      ["year", ref.year !== null ? String(ref.year) : null],
      ["journal", ref.journal],
      ["publisher", ref.publisher],
      ["volume", ref.volume],
      ["number", ref.issue],
      ["pages", ref.pages],
      ["doi", ref.doi],
      ["isbn", ref.isbn],
      ["url", ref.url],
    ];
    const fieldLines = fields
      .filter(([, value]) => value !== null && value !== "")
      .map(([key, value]) => `  ${key} = {${value}}`)
      .join(",\n");
    return `@${type}{${bibtexKey(ref)},\n${fieldLines}\n}`;
  });
  return blocks.join("\n\n");
}

export function exportFileBaseName(projectTitle: string): string {
  const slug = projectTitle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "bibliographie";
}

export interface GeneratedBibliographyView {
  formatted: string[];
  style: CitationStyle;
}

export function buildFormattedBibliography(references: Reference[], style: CitationStyle): GeneratedBibliographyView {
  const sorted = [...references].sort((a, b) => {
    const authorsA = JSON.parse(a.authors) as string[];
    const authorsB = JSON.parse(b.authors) as string[];
    return (authorsA[0] ?? a.title).localeCompare(authorsB[0] ?? b.title);
  });
  return {
    style,
    formatted: sorted.map((r) =>
      formatReference(
        { title: r.title, authors: JSON.parse(r.authors) as string[], year: r.year, sourceType: r.sourceType, journal: r.journal, publisher: r.publisher, volume: r.volume, issue: r.issue, pages: r.pages, doi: r.doi, url: r.url },
        style
      )
    ),
  };
}
