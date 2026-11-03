/**
 * Contrôle 2 — existence : comparaison d'une référence de l'étudiant avec les notices renvoyées par les
 * bases bibliographiques ouvertes (Crossref, OpenAlex, HAL, Open Library, Google Books), puis statut.
 * Aucune IA : l'IA est justement ce qui invente des références. On ne conclut jamais « fausse » : au pire
 * « suspecte », avec les raisons, et la décision revient à l'étudiant puis au directeur.
 */
import { formatApa } from "./apa7";
import { CURRENT_YEAR, norm, sameFamily, titleSimilarity } from "./text";
import { LOCAL_KINDS, type Convention, type ParsedReference, type PersonName, type ReferenceKind, type TextRun } from "./types";

export type SourceId = "crossref" | "openalex" | "hal" | "openlibrary" | "googlebooks";

/** Références vérifiées par requête (limite de durée des fonctions serveur). */
export const VERIFY_BATCH = 3;

export const SOURCE_LABELS: Record<SourceId, string> = {
  crossref: "Crossref",
  openalex: "OpenAlex",
  hal: "HAL",
  openlibrary: "Open Library",
  googlebooks: "Google Books",
};

/** Notice bibliographique renvoyée par une base (jamais complétée par ACADIA). */
export interface WorkRecord {
  source: SourceId;
  id: string;
  doi: string | null;
  title: string;
  authors: PersonName[];
  year: number | null;
  container: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publisher: string | null;
  isbn: string[];
  kind: ReferenceKind | null;
  /** Résumé (ou description d'un livre), quand la base le fournit : sert au contrôle du contexte. */
  abstract: string | null;
  url: string | null;
}

/** Ce qu'ont répondu les bases pour une référence. */
export interface LookupOutcome {
  /** Résultat de la recherche par DOI, si la référence en indique un. */
  doi: { found: boolean; record: WorkRecord | null } | null;
  candidates: WorkRecord[];
  /** La revue est indexée (d'autres articles y figurent) : utile pour juger un article introuvable. */
  containerIndexed: boolean | null;
  consulted: SourceId[];
  /** Bases qui n'ont pas répondu (panne, délai dépassé). */
  failed: SourceId[];
}

export type ExistenceStatus = "verifiee" | "a_corriger" | "introuvable" | "suspecte" | "non_verifiable";

export const EXISTENCE_LABELS: Record<ExistenceStatus, string> = {
  verifiee: "Vérifiée",
  a_corriger: "À corriger",
  introuvable: "Introuvable dans les bases ouvertes",
  suspecte: "Suspecte",
  non_verifiable: "Non vérifiable en ligne",
};

export interface Difference {
  field: "titre" | "auteurs" | "annee" | "revue" | "volume" | "numero" | "pages" | "doi";
  student: string;
  found: string;
}

export interface ExistenceVerdict {
  referenceId: string;
  status: ExistenceStatus;
  label: string;
  reasons: string[];
  differences: Difference[];
  match: WorkRecord | null;
  score: number;
  /** Référence corrigée en APA 7, construite UNIQUEMENT avec la notice trouvée. */
  corrected: TextRun[] | null;
  consulted: SourceId[];
}

export interface MatchScore {
  title: number;
  author: boolean;
  yearDiff: number | null;
  container: number | null;
  score: number;
}

export function scoreMatch(ref: ParsedReference, w: WorkRecord): MatchScore {
  const title = ref.title ? titleSimilarity(ref.title, w.title) : 0;
  const first = ref.authors[0];
  const author = !first ? true : first.corporate ? w.authors.some((a) => norm(a.family).includes(norm(first.family)) || norm(first.family).includes(norm(a.family))) || !w.authors.length : w.authors.some((a) => sameFamily(first.family, a.family));
  const yearDiff = ref.year && w.year ? Math.abs(ref.year - w.year) : null;
  const container = ref.container && w.container ? titleSimilarity(ref.container, w.container) : null;
  // Départage (réimpressions, recueils) : même revue, même volume, même première page.
  const tie = (container ?? 0) * 0.06 + (ref.volume && w.volume === ref.volume ? 0.02 : 0) + (pageNumbers(ref.pages)[0] && pageNumbers(ref.pages)[0] === pageNumbers(w.pages)[0] ? 0.02 : 0);
  const score = title * 0.7 + (author ? 0.2 : 0) + (yearDiff === null ? 0.05 : yearDiff === 0 ? 0.1 : yearDiff === 1 ? 0.05 : 0) + tie;
  return { title, author, yearDiff, container, score: Math.round(score * 1000) / 1000 };
}

const authorList = (authors: PersonName[]) => authors.map((a) => (a.given ? `${a.family}, ${a.given}` : a.family)).join(" ; ") || "—";
const pageNumbers = (p: string | null) => (p ? (p.match(/\d+/g) ?? []) : []);
/** Notices de livres : la liste d'auteurs et l'année varient d'une édition à l'autre. */
const BOOK_SOURCES: SourceId[] = ["openlibrary", "googlebooks"];

/** Pages : « 251 » (première page seule, fréquent chez Crossref) ne contredit pas « 251-276 ». */
function samePages(a: string, b: string): boolean {
  const x = pageNumbers(a);
  const y = pageNumbers(b);
  if (!x.length || !y.length) return true;
  if (x[0] !== y[0]) return false;
  return x.length < 2 || y.length < 2 || x[1] === y[1];
}

function differencesOf(ref: ParsedReference, w: WorkRecord, s: MatchScore): Difference[] {
  const out: Difference[] = [];
  const book = BOOK_SOURCES.includes(w.source);
  if (ref.title && s.title < 0.97) out.push({ field: "titre", student: ref.title, found: w.title });
  const missingAuthor = !book && ref.authors.length && w.authors.length && !ref.authors.every((a) => a.corporate || w.authors.some((b) => sameFamily(a.family, b.family)));
  if (!s.author || missingAuthor) out.push({ field: "auteurs", student: authorList(ref.authors), found: authorList(w.authors) });
  if (s.yearDiff) out.push({ field: "annee", student: String(ref.year), found: String(w.year) });
  if (ref.kind === "article" && s.container !== null && s.container < 0.75) out.push({ field: "revue", student: ref.container ?? "—", found: w.container ?? "—" });
  if (ref.volume && w.volume && ref.volume !== w.volume) out.push({ field: "volume", student: ref.volume, found: w.volume });
  if (ref.issue && w.issue && ref.issue !== w.issue && pageNumbers(ref.issue)[0] !== pageNumbers(w.issue)[0]) out.push({ field: "numero", student: ref.issue, found: w.issue });
  if (ref.pages && w.pages && !samePages(ref.pages, w.pages)) out.push({ field: "pages", student: ref.pages, found: w.pages });
  if (ref.doi && w.doi && ref.doi.toLowerCase() !== w.doi.toLowerCase()) out.push({ field: "doi", student: ref.doi, found: w.doi });
  return out;
}

/** Référence corrigée : la notice de la base, présentée en APA 7 (le type et l'édition de l'étudiant sont conservés). */
function correctedFrom(ref: ParsedReference, w: WorkRecord, convention: Convention): TextRun[] {
  return formatApa(
    {
      raw: ref.raw,
      kind: w.kind && w.kind !== "autre" ? w.kind : ref.kind,
      // Livre : les auteurs de l'étudiant sont gardés (la notice d'une autre édition peut en omettre).
      authors: w.authors.length && !BOOK_SOURCES.includes(w.source) ? w.authors : ref.authors,
      // Première page seule dans la notice : les pages complètes de l'étudiant, si elles commencent pareil.
      pages: w.pages && ref.pages && pageNumbers(w.pages).length < 2 && samePages(w.pages, ref.pages) ? ref.pages : w.pages,
      // Notices de livres sans année d'édition : l'année de l'étudiant est conservée (la base ne la contredit pas).
      year: w.year ?? ref.year,
      yearSuffix: ref.yearSuffix,
      noDate: !(w.year ?? ref.year),
      title: w.title,
      container: w.container,
      // Livre : l'éditeur de l'édition citée par l'étudiant (la notice peut décrire une autre édition).
      publisher: BOOK_SOURCES.includes(w.source) ? (ref.publisher ?? w.publisher) : w.publisher,
      edition: ref.edition,
      volume: w.volume,
      issue: w.issue,
      doi: w.doi,
      url: w.doi ? null : ref.url,
    },
    convention,
  );
}

const DIFF_LABELS: Record<Difference["field"], string> = { titre: "le titre", auteurs: "les auteurs", annee: "l'année", revue: "la revue", volume: "le volume", numero: "le numéro", pages: "les pages", doi: "le DOI" };

export function decideExistence(ref: ParsedReference, outcome: LookupOutcome, convention: Convention): ExistenceVerdict {
  const base = { referenceId: ref.id, consulted: outcome.consulted };
  const verdict = (status: ExistenceStatus, reasons: string[], match: WorkRecord | null = null, differences: Difference[] = [], score = 0): ExistenceVerdict => ({ ...base, status, label: EXISTENCE_LABELS[status], reasons, differences, match, score, corrected: match ? correctedFrom(ref, match, convention) : null });
  const sources = (w: WorkRecord) => SOURCE_LABELS[w.source];

  const scored = outcome.candidates.map((w) => ({ w, s: scoreMatch(ref, w) })).sort((a, b) => b.s.score - a.s.score);
  const strong = scored.find(({ s }) => s.title >= 0.88 && s.author && (s.yearDiff === null || s.yearDiff <= 2));
  const medium = strong ?? scored.find(({ s }) => (s.title >= 0.75 && s.author) || s.title >= 0.93);

  const found = (w: WorkRecord, s: MatchScore, extra: string[] = []) => {
    const differences = differencesOf(ref, w, s);
    if (!differences.length && !extra.length) return verdict("verifiee", [`Trouvée dans ${sources(w)} : auteurs, titre et année concordent.`], w, [], s.score);
    const reasons = [...extra, ...(differences.length ? [`Trouvée dans ${sources(w)}, mais ${differences.map((d) => DIFF_LABELS[d.field]).join(", ")} diffère${differences.length > 1 ? "nt" : ""} de votre référence.`] : [])];
    if (s.yearDiff === 1) reasons.push("Un an d'écart vient souvent de la date de mise en ligne : retenez l'année du numéro de la revue.");
    return verdict("a_corriger", reasons, w, differences, s.score);
  };

  // 1. La référence indique un DOI : c'est l'identifiant le plus sûr.
  if (ref.doi && outcome.doi) {
    const rec = outcome.doi.record;
    if (outcome.doi.found && rec) {
      const s = scoreMatch(ref, rec);
      if (s.title >= 0.75 || (s.title >= 0.6 && s.author)) return found(rec, s);
      if (strong && strong.w.doi?.toLowerCase() !== ref.doi.toLowerCase()) return found(strong.w, strong.s, [`Le DOI indiqué (${ref.doi}) renvoie à un autre texte : « ${rec.title} ». Le texte cité existe, avec un autre DOI.`]);
      return verdict("suspecte", [`Le DOI indiqué (${ref.doi}) existe, mais renvoie à un autre texte : « ${rec.title} » (${rec.year ?? "s.d."}). Aucun texte correspondant à votre titre n'a été trouvé.`], null, [], s.score);
    }
    if (!outcome.doi.found && !outcome.failed.includes("crossref")) {
      if (strong) return found(strong.w, strong.s, [`Le DOI indiqué (${ref.doi}) n'existe pas ; le texte cité existe, avec un autre DOI.`]);
      return verdict("suspecte", [`Le DOI indiqué (${ref.doi}) n'existe dans aucune base, et aucun texte de ce titre n'a été trouvé : signe fréquent d'une référence inventée. Vérifiez la source d'origine.`]);
    }
  }

  // 2. Recherche par titre et auteur.
  if (strong) return found(strong.w, strong.s);
  if (medium) return found(medium.w, medium.s, ["Notice proche trouvée : vérifiez qu'il s'agit bien du même texte."]);

  // 3. Rien de convaincant.
  if (LOCAL_KINDS.includes(ref.kind) || ref.kind === "web") {
    return verdict("non_verifiable", [ref.kind === "web" ? "Page web : son existence se vérifie par le lien, pas dans les bases bibliographiques." : "Ce type de document (mémoire, cours, rapport, texte officiel) est rarement indexé dans les bases internationales : gardez une preuve (page de garde, lien, ISBN)."]);
  }
  if (outcome.consulted.length === 0 || outcome.failed.length === outcome.consulted.length) return verdict("non_verifiable", ["Les bases bibliographiques n'ont pas répondu : réessayez plus tard."]);
  // La base principale pour ce type de document n'a pas répondu : on ne conclut pas « introuvable » sans elle.
  const primary: SourceId = ref.kind === "livre" ? "openlibrary" : "crossref";
  if (outcome.failed.includes(primary)) return verdict("non_verifiable", [`${SOURCE_LABELS[primary]} n'a pas répondu et les autres bases ne contiennent pas cette référence : relancez la vérification dans quelques minutes.`]);
  const answered = outcome.consulted.filter((s) => !outcome.failed.includes(s));
  const reasons = [`Aucune notice correspondante dans ${answered.map((s) => SOURCE_LABELS[s]).join(", ")}${outcome.failed.length ? ` (${outcome.failed.map((s) => SOURCE_LABELS[s]).join(", ")} n'a pas répondu)` : ""}.`];
  if (ref.kind === "article" && outcome.containerIndexed && (ref.year ?? 0) >= 2000 && (ref.year ?? 0) <= CURRENT_YEAR()) {
    return verdict("suspecte", [...reasons, `La revue « ${ref.container} » est indexée (d'autres articles y figurent), mais cet article n'y apparaît pas. Vérifiez la source : c'est le cas typique d'une référence inventée.`]);
  }
  if (ref.uncertain) reasons.push("La référence elle-même est incomplète ou mal lue : complétez-la, puis relancez la vérification.");
  reasons.push("Ce n'est pas une preuve d'invention (ouvrages anciens, éditeurs locaux) : gardez une preuve de la source (page de garde, ISBN, lien).");
  return verdict("introuvable", reasons);
}
