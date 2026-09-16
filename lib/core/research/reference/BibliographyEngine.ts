// ============================================================
// ACADIA — BIBLIOGRAPHY ENGINE (mission Bibliography & Reference
// Intelligence §19/§24/§25)
//
// Formateur PUREMENT DÉTERMINISTE — utilise UNIQUEMENT les données déjà
// enregistrées sur chaque Reference, jamais un appel IA, jamais une
// donnée inventée pour combler un champ manquant (mission §24/§25).
// "n.d." (no date) est la seule convention utilisée pour une année
// absente — convention bibliographique réelle (APA), pas une
// invention. NE PAS imposer un style par défaut : si aucun style n'est
// fourni, "DEFAULT" retombe sur le format simple déjà utilisé par
// DocumentBibliographyBuilder.ts (formatCitation), jamais un APA
// implicite (mission §19).
// ============================================================

import type { CitationStyle } from "./ReferenceTypes";

export interface FormattableReference {
  title: string;
  authors: string[];
  year: number | null;
  sourceType: string;
  journal: string | null;
  publisher: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  url: string | null;
}

function authorsListApaStyle(authors: string[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return `${authors.slice(0, -1).join(", ")}, & ${authors[authors.length - 1]}`;
}

function doiOrUrl(ref: FormattableReference): string {
  if (ref.doi) return `https://doi.org/${ref.doi}`;
  if (ref.url) return ref.url;
  return "";
}

function volumeIssue(ref: FormattableReference): string {
  if (!ref.volume) return "";
  return ref.issue ? `${ref.volume}(${ref.issue})` : ref.volume;
}

function joinNonEmpty(parts: (string | undefined | null)[], sep = " "): string {
  return parts.filter((p) => p && p.trim()).join(sep);
}

function formatApaLike(ref: FormattableReference): string {
  const authors = authorsListApaStyle(ref.authors);
  const year = ref.year ? `(${ref.year})` : "(n.d.)";
  const container = ref.journal
    ? joinNonEmpty([ref.journal, volumeIssue(ref) && `, ${volumeIssue(ref)}`, ref.pages && `, ${ref.pages}`], "")
    : ref.publisher || "";
  return joinNonEmpty([joinNonEmpty([authors, year]) + ".", `${ref.title}.`, container && `${container}.`, doiOrUrl(ref)]);
}

function formatMla(ref: FormattableReference): string {
  const authors = ref.authors.join(", ");
  const container = ref.journal ? `${ref.journal}` : ref.publisher || "";
  const vol = ref.volume ? `vol. ${ref.volume}, ` : "";
  const issue = ref.issue ? `no. ${ref.issue}, ` : "";
  const year = ref.year ? `${ref.year}, ` : "";
  const pages = ref.pages ? `pp. ${ref.pages}.` : "";
  return joinNonEmpty([authors && `${authors}.`, `"${ref.title}."`, container && `${container},`, `${vol}${issue}${year}${pages}`.trim(), doiOrUrl(ref)]);
}

function formatVancouver(ref: FormattableReference): string {
  const authors = ref.authors.join(", ");
  const year = ref.year ?? "";
  const volIssue = volumeIssue(ref);
  const journalPart = ref.journal ? joinNonEmpty([ref.journal, `${year}`, volIssue && `;${volIssue}`, ref.pages && `:${ref.pages}`], "") : "";
  return joinNonEmpty([authors && `${authors}.`, `${ref.title}.`, journalPart && `${journalPart}.`, doiOrUrl(ref)]);
}

/** Format simple existant (voir ScientificWorkEngine.formatCitation) — jamais remplacé, seulement réutilisé comme repli DEFAULT. */
function formatDefault(ref: FormattableReference): string {
  const year = ref.year ? ` (${ref.year})` : "";
  const container = ref.journal ? ` ${ref.journal}` : ref.publisher ? ` ${ref.publisher}` : "";
  const authors = ref.authors.join(", ");
  return `${authors}${year}. ${ref.title}.${container}`.trim();
}

export function formatReference(ref: FormattableReference, style: CitationStyle = "DEFAULT"): string {
  switch (style) {
    case "APA":
    case "HARVARD":
    case "CHICAGO":
      return formatApaLike(ref);
    case "MLA":
      return formatMla(ref);
    case "VANCOUVER":
      return formatVancouver(ref);
    case "OTHER":
    case "DEFAULT":
    default:
      return formatDefault(ref);
  }
}

export interface GeneratedBibliographyEntry {
  referenceId: string;
  formatted: string;
}

/**
 * Génère la bibliographie triée alphabétiquement par premier auteur
 * (convention standard toutes normes confondues) — jamais un tri qui
 * masquerait une référence, jamais un contenu ajouté au-delà des
 * champs déjà enregistrés (mission §24).
 */
export function generateBibliography(
  references: (FormattableReference & { id: string })[],
  style: CitationStyle = "DEFAULT"
): GeneratedBibliographyEntry[] {
  const sorted = [...references].sort((a, b) => {
    const authorA = a.authors[0] ?? a.title;
    const authorB = b.authors[0] ?? b.title;
    return authorA.localeCompare(authorB);
  });
  return sorted.map((ref) => ({ referenceId: ref.id, formatted: formatReference(ref, style) }));
}
