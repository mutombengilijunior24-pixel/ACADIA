/**
 * Analyse d'un mémoire (ou d'une bibliographie collée), entièrement dans le navigateur : citations,
 * bibliographie, contrôle de forme et bibliographie corrigée en APA 7.
 */
import { formatApa } from "./apa7";
import { checkAttributions } from "./attributions";
import { findCitations } from "./citations";
import { checkConsistency, type CitationLink } from "./consistency";
import { parseBibliography } from "./parse";
import { fold } from "./text";
import type { Convention, DocParagraph, FormIssue, InTextCitation, ParsedReference, TextRun } from "./types";

export interface DocumentAnalysis {
  convention: Convention;
  citations: InTextCitation[];
  references: ParsedReference[];
  links: CitationLink[];
  issues: FormIssue[];
  uncited: string[];
  bibliographyFound: boolean;
  /** Le texte du mémoire est présent (sinon : bibliographie seule, sans contrôle des citations). */
  hasBody: boolean;
  /** Références placées en notes de bas de page (présentation non APA). */
  footnoteReferences: number;
  /** Bibliographie corrigée en APA 7, triée par ordre alphabétique. */
  corrected: Array<{ referenceId: string; runs: TextRun[] }>;
  stats: { citations: number; references: number; errors: number; toCheck: number; advice: number };
}

/** Une note de bas de page qui ressemble à une référence (« KOTLER, P., Marketing…, 2015, p. 45. »). */
const looksLikeReference = (text: string) => /\b(?:1[5-9]\d{2}|20\d{2})\b/.test(text) && /^[\p{Lu}][\p{Lu}'’\- ]{2,},/u.test(text.trim());

export function analyzeDocument(input: { paragraphs: DocParagraph[]; footnotes?: DocParagraph[]; convention: Convention; fromWord: boolean; bibliographyOnly?: boolean }): DocumentAnalysis {
  const footnotes = input.footnotes ?? [];
  const parsed = parseBibliography(input.paragraphs);
  // Sans titre « Bibliographie », un mémoire complet n'est pas lu comme une bibliographie (texte collé : si).
  const bib = parsed.found || input.bibliographyOnly ? parsed : { ...parsed, references: [] as ParsedReference[] };
  const startIndex = bib.startIndex;
  // Texte du mémoire : tout ce qui précède la bibliographie (et les notes de bas de page).
  const body = input.bibliographyOnly ? [] : startIndex === null ? input.paragraphs : input.paragraphs.filter((p) => p.index < startIndex);
  const hasBody = body.length > 0 && bib.references.length > 0;
  const citations = body.length ? findCitations([...body, ...footnotes]) : [];
  const consistency = bib.references.length ? checkConsistency({ citations, references: bib.references, convention: input.convention, hasBody, fromWord: input.fromWord }) : { links: [], issues: [], uncited: [] };
  const footnoteReferences = footnotes.filter((f) => looksLikeReference(f.text)).length;
  // Anachronismes (erreurs) en tête, conseils d'attribution à la fin.
  const attributions = checkAttributions(citations);
  const issues = [...attributions.filter((i) => i.severity === "erreur"), ...consistency.issues, ...attributions.filter((i) => i.severity !== "erreur")];
  if (footnoteReferences >= 3 && footnoteReferences > citations.length) {
    issues.unshift({ code: "notes_de_bas_de_page", severity: "a_verifier", message: `${footnoteReferences} notes de bas de page contiennent des références : c'est la présentation « classique », pas le style APA. En APA, on cite dans le texte (Auteur, année) et la bibliographie donne la référence complète.` });
  }
  if (!bib.found && !input.bibliographyOnly) {
    issues.unshift({ code: "bibliographie_introuvable", severity: "a_verifier", message: "Aucun titre « Bibliographie » ou « Références » n'a été trouvé : vérifiez que la bibliographie est bien dans le document, sous ce titre." });
  }
  const sorted = [...bib.references].sort((a, b) => fold(a.authors[0]?.family ?? a.title ?? a.raw).localeCompare(fold(b.authors[0]?.family ?? b.title ?? b.raw)) || (a.year ?? 0) - (b.year ?? 0));
  const count = (s: FormIssue["severity"]) => issues.filter((i) => i.severity === s).length;
  return {
    convention: input.convention,
    citations,
    references: bib.references,
    links: consistency.links,
    issues,
    uncited: consistency.uncited,
    bibliographyFound: bib.found,
    hasBody,
    footnoteReferences,
    corrected: sorted.map((r) => ({ referenceId: r.id, runs: formatApa(r, input.convention) })),
    stats: { citations: citations.length, references: bib.references.length, errors: count("erreur"), toCheck: count("a_verifier"), advice: count("conseil") },
  };
}
