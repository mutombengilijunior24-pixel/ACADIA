// ============================================================
// ACADIA — DOCUMENT BIBLIOGRAPHY BUILDER (P12.18)
//
// Ne formate QUE les références réellement enregistrées par le
// chercheur (BibliographyReference, P11) — tri alphabétique,
// jamais une référence ajoutée ou modifiée ici.
// ============================================================

import type { BibliographyReference } from "@/lib/core/scientific-work/ScientificWorkTypes";
import { formatCitation } from "@/lib/core/scientific-work/ScientificWorkEngine";
import type { DocumentBibliographyEntryModel } from "./DocumentTypes";

export function buildBibliography(references: BibliographyReference[]): DocumentBibliographyEntryModel[] {
  return [...references]
    .sort((a, b) => a.author.localeCompare(b.author))
    .map((ref) => ({ id: ref.id, formatted: formatCitation(ref) }));
}
