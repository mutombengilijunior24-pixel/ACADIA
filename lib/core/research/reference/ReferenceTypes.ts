// ============================================================
// ACADIA — BIBLIOGRAPHY & REFERENCE INTELLIGENCE : CONTRAT CENTRAL
// (mission dédiée)
//
// RÈGLE ABSOLUE : ACADIA NE DOIT JAMAIS INVENTER UNE SOURCE. Une
// information manquante reste `null`/`undefined` — jamais comblée par
// une valeur plausible. Une référence non vérifiée porte toujours
// verificationStatus="TO_VERIFY" (ou "AI_PROPOSED" selon la
// provenance), jamais "VERIFIED" implicitement.
//
// Distinct du `BibliographyReference` existant
// (lib/core/scientific-work/ScientificWorkTypes.ts, saisie manuelle
// simple auteur/année/titre/type, sans DOI/ISBN/provenance/vérification)
// — celui-ci reste utilisé tel quel par l'export de document existant
// (DocumentBibliographyBuilder.ts), non modifié par cette mission. Ce
// fichier définit le contrat du nouveau modèle relationnel `Reference`.
// ============================================================

// ------------------------------------------------------------
// SOURCE TYPE (mission §8) — extensible, jamais une supposition
// automatique "URL = article scientifique" (mission §14).
// ------------------------------------------------------------

export const REFERENCE_SOURCE_TYPES = [
  "JOURNAL_ARTICLE",
  "BOOK",
  "BOOK_CHAPTER",
  "THESIS",
  "DISSERTATION",
  "REPORT",
  "INSTITUTIONAL_REPORT",
  "GOVERNMENT_DOCUMENT",
  "LAW_OR_REGULATION",
  "CONFERENCE_PAPER",
  "DATASET",
  "WEBSITE",
  "WORKING_PAPER",
  "OTHER",
] as const;
export type ReferenceSourceType = (typeof REFERENCE_SOURCE_TYPES)[number];

// ------------------------------------------------------------
// PROVENANCE (mission §9) — vocabulaire dédié, distinct de
// ProvenanceTag (lib/core/research/ResearchTypes.ts), voir schema.prisma
// pour la justification complète de ce choix.
// ------------------------------------------------------------

export const REFERENCE_PROVENANCES = [
  "USER_ENTERED",
  "USER_IMPORTED",
  "DOI_LOOKUP",
  "BIBTEX_IMPORT",
  "RIS_IMPORT",
  "AI_PROPOSED",
  "SYSTEM_IMPORTED",
] as const;
export type ReferenceProvenance = (typeof REFERENCE_PROVENANCES)[number];

// ------------------------------------------------------------
// VERIFICATION STATUS (mission §5) — jamais confondre VERIFIED et
// AI_PROPOSED. Une extraction IA réussie ne rend jamais une référence
// "VERIFIED" (mission §23) — au mieux "AI_PROPOSED", toujours
// accompagnée d'un besoin de vérification humaine.
// ------------------------------------------------------------

export const REFERENCE_VERIFICATION_STATUSES = ["VERIFIED", "INFERRED", "USER_PROVIDED", "AI_PROPOSED", "TO_VERIFY", "INVALID"] as const;
export type ReferenceVerificationStatus = (typeof REFERENCE_VERIFICATION_STATUSES)[number];

/** Statut de départ pour chaque provenance — jamais VERIFIED par défaut, quelle que soit l'origine (mission §5/§23). */
export const DEFAULT_VERIFICATION_STATUS_BY_PROVENANCE: Record<ReferenceProvenance, ReferenceVerificationStatus> = {
  USER_ENTERED: "USER_PROVIDED",
  USER_IMPORTED: "USER_PROVIDED",
  DOI_LOOKUP: "TO_VERIFY",
  BIBTEX_IMPORT: "TO_VERIFY",
  RIS_IMPORT: "TO_VERIFY",
  AI_PROPOSED: "AI_PROPOSED",
  SYSTEM_IMPORTED: "TO_VERIFY",
};

// ------------------------------------------------------------
// CITATION (mission §17/§18/§19)
// ------------------------------------------------------------

export const CITATION_RESOLUTION_STATUSES = ["RESOLVED", "UNRESOLVED", "AMBIGUOUS"] as const;
export type CitationResolutionStatus = (typeof CITATION_RESOLUTION_STATUSES)[number];

export const CITATION_STYLES = ["APA", "MLA", "CHICAGO", "HARVARD", "VANCOUVER", "OTHER"] as const;
export type CitationStyle = (typeof CITATION_STYLES)[number] | "DEFAULT";

// ------------------------------------------------------------
// DÉDUPLICATION (mission §15) — jamais une suppression automatique,
// seulement un signalement que le chercheur examine.
// ------------------------------------------------------------

export const DUPLICATE_MATCH_REASONS = ["DOI", "ISBN", "AUTHOR_TITLE_YEAR", "TITLE_SIMILARITY"] as const;
export type DuplicateMatchReason = (typeof DUPLICATE_MATCH_REASONS)[number];

export interface PossibleDuplicateMatch {
  referenceId: string;
  reason: DuplicateMatchReason;
  /** 0..1 — uniquement pour TITLE_SIMILARITY (comparaison exacte sinon). */
  score: number;
}

// ------------------------------------------------------------
// ERREURS DE DOMAINE — même discipline que AssessmentTypes.ts :
// des classes typées, traduites en code HTTP par une seule fonction,
// jamais un throw générique.
// ------------------------------------------------------------

export class ReferenceForbiddenError extends Error {}
export class ReferenceNotFoundError extends Error {}
/** Suppression refusée car la référence est encore utilisée (citation/claim) — mission §30. */
export class ReferenceInUseError extends Error {}
export class InvalidReferenceInputError extends Error {}

// ------------------------------------------------------------
// CONTRAT DE CRÉATION — chaque champ manquant reste absent, jamais
// deviné (mission §6). `authors` est TOUJOURS un tableau, même vide.
// ------------------------------------------------------------

export interface ReferenceInput {
  title: string;
  authors: string[];
  year?: number | null;
  sourceType: ReferenceSourceType;
  journal?: string | null;
  publisher?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  doi?: string | null;
  isbn?: string | null;
  url?: string | null;
  language?: string | null;
  provenance: ReferenceProvenance;
  /** Autorisé uniquement pour provenance="AI_PROPOSED" — voir assertion dans ReferenceService. */
  aiConfidence?: number | null;
  /** Texte BibTeX/RIS d'origine ou JSON de la proposition IA — traçabilité, jamais réinterprété. */
  rawImportData?: string | null;
}

// ------------------------------------------------------------
// NORMALISATION (mission §16) — espaces/casse/format uniquement.
// NE JAMAIS inventer un accent, un nom, ou modifier le contenu
// scientifique du titre.
// ------------------------------------------------------------

/** Collapse les espaces multiples et trim — jamais de changement de casse ou d'orthographe. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeAuthorName(name: string): string {
  return normalizeWhitespace(name);
}

export function normalizeAuthors(authors: string[]): string[] {
  return authors.map(normalizeAuthorName).filter((a) => a.length > 0);
}

/** DOI : normalisation de forme uniquement (retire un préfixe URL/scheme, minuscule) — jamais résolu ni vérifié ici. */
export function normalizeDoi(doi: string): string {
  const trimmed = doi.trim();
  const withoutUrl = trimmed.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  const withoutPrefix = withoutUrl.replace(/^doi:\s*/i, "");
  return withoutPrefix.trim().toLowerCase();
}

export function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[\s-]/g, "").toUpperCase();
}

export function normalizeUrl(url: string): string {
  return url.trim();
}

/** Année : accepte un nombre à 4 chiffres plausible uniquement — jamais une valeur inventée si absente. */
export function normalizeYear(year: unknown): number | null {
  if (year === null || year === undefined || year === "") return null;
  const n = typeof year === "number" ? year : parseInt(String(year), 10);
  if (!Number.isFinite(n) || n < 1000 || n > 3000) return null;
  return n;
}

export function normalizePages(pages: string): string {
  return normalizeWhitespace(pages).replace(/\s*-\s*/g, "-");
}
