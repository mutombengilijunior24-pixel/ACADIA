/**
 * Bibliographie : repérage de la section, rubriques (« Ouvrages », « Webographie »…) et découpage de chaque
 * référence en éléments (auteurs, année, titre, revue, volume, pages, éditeur, DOI…). Deux présentations
 * sont reconnues : APA (année entre parenthèses après les auteurs) et la présentation « classique » des
 * mémoires (NOM, P., Titre, Éditeur, Ville, année). Règles fixes, sans IA ; ce qui n'est pas reconnu avec
 * assurance est signalé « lecture incertaine », jamais deviné.
 */
import { CURRENT_YEAR } from "./text";
import type { DocParagraph, ParsedReference, PersonName, ReferenceKind, TextRun } from "./types";

const HEADING = /^(?:[IVXLC]+[.)]|\d+[.)]|chapitre\s+\w+\s*[:.-]?)?\s*(bibliographie|r[ée]f[ée]rences(?:\s+bibliographiques)?|liste\s+des\s+r[ée]f[ée]rences|ouvrages\s+cit[ée]s|sources\s+et\s+bibliographie|bibliography|references|works\s+cited)\s*:?$/i;
const END = /^(?:[IVXLC]+[.)]|\d+[.)])?\s*(annexes?|appendices?|table\s+des\s+mati[èe]res|liste\s+des\s+(?:tableaux|figures|abr[ée]viations)|index)\b/i;
const HAS_YEAR = /\b(?:1[5-9]\d{2}|20\d{2})\b|\bs\.\s?d\.|\bn\.\s?d\./i;

/** Rubrique de bibliographie → type de document attendu. */
function kindOfSection(label: string | null): ReferenceKind | null {
  if (!label) return null;
  const l = label.toLowerCase();
  if (/m[ée]moires?|th[èe]ses?|\btfc\b|travaux\s+de\s+fin/.test(l)) return "memoire";
  if (/cours|syllabus/.test(l)) return "cours";
  if (/lois?|textes?\s+(?:l[ée]gaux|juridiques|officiels|l[ée]gislatifs)|l[ée]gislation|juridiques?/.test(l)) return "texte_juridique";
  if (/web|sites?|internet|en\s+ligne|netographie/.test(l)) return "web";
  if (/rapports?|documents?\s+officiels?|publications?\s+officielles?|documents?\s+de\s+travail/.test(l)) return "rapport";
  if (/articles?|revues?|p[ée]riodiques?/.test(l)) return "article";
  if (/ouvrages?|livres?/.test(l)) return "livre";
  return null;
}

const cleanEntry = (s: string) => s.replace(/^(?:\[\d+\]|\d+\s*[.)-]|[-•–*▪●○])\s*/, "").trim();

export interface BibliographyEntry {
  raw: string;
  runs: TextRun[];
  section: string | null;
  paragraphIndex: number;
}

/** Entrées de la bibliographie. Sans titre « Bibliographie » (texte collé), tout le texte est la bibliographie. */
export function splitBibliography(paragraphs: DocParagraph[]): { entries: BibliographyEntry[]; found: boolean; startIndex: number | null } {
  const body = paragraphs.filter((p) => !p.footnote);
  let start = -1;
  body.forEach((p, i) => {
    if (p.text.length < 60 && HEADING.test(p.text.trim())) start = i;
  });
  const slice = start >= 0 ? body.slice(start + 1) : body;
  const entries: BibliographyEntry[] = [];
  let section: string | null = null;
  for (const p of slice) {
    const text = p.text.trim();
    if (start >= 0 && text.length < 60 && END.test(text)) break;
    // Rubrique : ligne courte sans année ni structure de référence.
    if (text.length < 80 && !HAS_YEAR.test(text) && !/https?:\/\//.test(text) && text.split(/[.,]/).filter((x) => x.trim()).length <= 2) {
      section = text.replace(/^(?:[IVXLC]+|\d+|[A-Za-z])\s*[.)-]\s*/, "").replace(/\s*:$/, "").trim() || null;
      continue;
    }
    const raw = cleanEntry(text);
    if (raw.length < 12) continue;
    const runs = p.runs.map((r) => ({ ...r }));
    entries.push({ raw, runs, section, paragraphIndex: p.index });
  }
  return { entries, found: start >= 0, startIndex: start >= 0 ? body[start].index : null };
}

// ---------------------------------------------------------------------------------------------------------
// Auteurs.

const PARTICLE = String.raw`(?:(?:de|du|des|van|von|der|den|di|da|le|la|dos|del)\s)`;
const INITIALS = /^(?:\p{Lu}\p{Ll}?\.(?:\s?-\s?|\s)?)+$/u;
const UPPER_FAMILY = new RegExp(String.raw`^${PARTICLE}?(?:[DdLl]['’])?[\p{Lu}'’\-]{2,}(?:\s+${PARTICLE}?[\p{Lu}'’\-]{2,}){0,3}(?:\s+(?:\p{Lu}\.\s?-?)+)?$`, "u");
const CAP_FAMILY = new RegExp(String.raw`^${PARTICLE}?(?:[DdLl]['’])?\p{Lu}[\p{Ll}'’\-]+(?:\s+${PARTICLE}?\p{Lu}[\p{L}'’\-]+){0,3}$`, "u");
const GIVEN_NAME = /^\p{Lu}[\p{Ll}\-]+(?:[\s-]\p{Lu}[\p{Ll}]+)?$/u;
const CORPORATE_WORDS = /\b(banque|bank|institut|institute|minist[èe]re|ministry|organisation|organization|fonds|fund|programme|program|universit[ée]|university|bureau|office|agence|agency|commission|r[ée]publique|gouvernement|government|conseil|council|soci[ée]t[ée]|association|centre|center|direction|cellule|observatoire|union|nations\s+unies|united\s+nations|world|mondiale?|africaine?|congo|ins|bcc|fmi|imf|oms|who|pnud|undp|unicef|unesco|fao|ocde|oecd|bad|afdb|cenco)\b/i;

const isConnector = (s: string) => /^(?:et|&|and)$/i.test(s);

/** Une personne écrite « NOM, P. » ou « Nom, P. » ou « NOM Prénom ». */
function personFrom(family: string, given: string): PersonName {
  // « KOTLER P. » : initiales collées au nom.
  const glued = /^(.*?\S)\s+((?:\p{Lu}\.\s?-?)+)$/u.exec(family);
  if (glued && !given) return { family: glued[1].trim(), given: glued[2].trim(), corporate: false };
  return { family: family.trim(), given: given.trim(), corporate: false };
}

/**
 * Lit une suite de noms au début d'un texte (« KOTLER, P. et KELLER, K. L., Marketing… ») et rend les
 * personnes lues et la longueur de texte consommée. `strict` (présentation classique) : un nom en
 * minuscules n'est accepté que suivi d'initiales, pour ne pas prendre le titre pour un auteur.
 */
function readAuthors(text: string, strict: boolean): { authors: PersonName[]; consumed: number } {
  const parts = text.split(/(\s*,\s*|\s+(?:et|&|and)\s+|\s*&\s*)/);
  const authors: PersonName[] = [];
  let consumed = 0;
  let upperMode: boolean | null = null;
  for (let i = 0; i < parts.length; i += 2) {
    const piece = parts[i].trim().replace(/\.$/, (m) => (INITIALS.test(parts[i].trim()) ? m : ""));
    const sep = parts[i + 1] ?? "";
    if (!piece) {
      consumed += parts[i].length + sep.length;
      continue;
    }
    const last = authors.at(-1);
    const isInitials = INITIALS.test(parts[i].trim());
    if (isInitials && last && !last.given) {
      last.given = parts[i].trim();
    } else if (UPPER_FAMILY.test(piece) && (upperMode !== false || !strict)) {
      upperMode = true;
      authors.push(personFrom(piece, ""));
    } else if (last && !last.given && upperMode && GIVEN_NAME.test(piece)) {
      last.given = piece; // « KOTLER, Philip »
    } else if (CAP_FAMILY.test(piece) && (!strict || INITIALS.test((parts[i + 2] ?? "").trim()))) {
      if (upperMode === null) upperMode = false;
      authors.push(personFrom(piece, ""));
    } else break;
    consumed += parts[i].length + sep.length;
    // La liste s'arrête après un point final d'initiales suivi d'une virgule de titre : géré par l'appelant.
    if (isConnector(sep.trim())) continue;
  }
  return { authors, consumed };
}

function parseAuthorsBlock(block: string): PersonName[] {
  const cleaned = block
    .replace(/\((?:dir|[ée]ds?|coord|ed)\.?\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,$/, "");
  if (!cleaned) return [];
  const words = cleaned.split(/\s+/);
  const lowerWords = words.filter((w) => /^\p{Ll}/u.test(w) && !/^(?:de|du|des|van|von|der|den|di|da|le|la|et|and|dos|del|d['’].*|l['’].*)$/u.test(w));
  if (CORPORATE_WORDS.test(cleaned) && !/,\s*(?:\p{Lu}\.)/u.test(cleaned)) return [{ family: cleaned.replace(/\.$/, ""), given: "", corporate: true }];
  if (lowerWords.length && !/,/.test(cleaned)) return [{ family: cleaned.replace(/\.$/, ""), given: "", corporate: true }];
  const { authors } = readAuthors(cleaned, false);
  return authors.length ? authors : [{ family: cleaned.replace(/\.$/, ""), given: "", corporate: true }];
}

// ---------------------------------------------------------------------------------------------------------
// Éléments.

const trimEnd = (s: string) => s.replace(/[\s.,;:]+$/, "").trim();
const CITIES = /^(?:paris|kinshasa|lubumbashi|bruxelles|brussels|louvain(?:-la-neuve)?|li[èe]ge|gen[èe]ve|lausanne|londres|london|new york|montr[ée]al|qu[ée]bec|dakar|abidjan|yaound[ée]|douala|kigali|bujumbura|kisangani|bukavu|goma|mbuji-mayi|kananga|washington(?:,?\s*d\.?c\.?)?|oxford|cambridge|boston|berlin|amsterdam|lyon|grenoble|toulouse|bordeaux|rennes|lille|nanterre|chicago|princeton|harlow|hoboken|upper saddle river|thousand oaks|cham|heidelberg)$/i;

interface Pieces {
  container: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publisher: string | null;
  place: string | null;
}

/** « Revue X, 12(3), 45-67 » ou « Revue X, vol. 12, n° 3, pp. 45-67 ». */
function articleTail(text: string): Omit<Pieces, "publisher" | "place"> | null {
  const apa = /^(.+?),\s*(\d+)\s*(?:\(([^)]+)\))?\s*(?:,\s*(?:pp?\.\s*)?([eE]?\d+(?:\s*[-–]\s*\d+)?))?\s*\.?\s*$/.exec(text);
  if (apa && !/^\d/.test(apa[1])) return { container: trimEnd(apa[1]), volume: apa[2], issue: apa[3]?.trim() ?? null, pages: apa[4]?.replace(/\s/g, "").replace("-", "–") ?? null };
  const fr = /^(?:in\s+|dans\s+)?(.+?),\s*(?:vol(?:ume)?\.?\s*(\d+))?\s*,?\s*(?:n[°o]\.?\s*([\w-]+))?\s*,?\s*(?:pp?\.\s*(\d+\s*[-–]\s*\d+|\d+))?\s*\.?$/i.exec(text);
  if (fr && (fr[2] || fr[3])) return { container: trimEnd(fr[1]), volume: fr[2] ?? null, issue: fr[3] ?? null, pages: fr[4]?.replace(/\s/g, "").replace("-", "–") ?? null };
  return null;
}

/** Éditeur et lieu : « Paris : Dunod » ; « Pearson » ; « Dunod, Paris ». */
function publisherOf(text: string): { publisher: string | null; place: string | null } {
  const t = trimEnd(text.replace(/\b\d+(?:e|ème|eme|th|nd|rd|st)?\s*[ée]d(?:ition|\.)?/gi, "").replace(/\(\s*\)/g, ""));
  if (!t) return { publisher: null, place: null };
  const colon = /^([^:]+?)\s*:\s*(.+)$/.exec(t);
  if (colon) return { place: colon[1].trim(), publisher: trimEnd(colon[2]) };
  const parts = t.split(/\s*,\s*/).filter(Boolean);
  const place = parts.find((p) => CITIES.test(p)) ?? null;
  const publisher = parts.filter((p) => p !== place && !/^\d{4}$/.test(p)).join(", ") || null;
  return { publisher: publisher ? trimEnd(publisher) : null, place };
}

function kindOf(raw: string, after: string, hint: ReferenceKind | null, url: string | null, article: boolean): ReferenceKind {
  if (/^(?:loi|d[ée]cret|ordonnance|arr[êe]t[ée]|constitution|code\s+(?:du|de|des)|acte\s+uniforme)\b/i.test(raw)) return "texte_juridique";
  if (/\[(?:m[ée]moire|th[èe]se|tfc|travail)|m[ée]moire\s+(?:de|en|pr[ée]sent)|th[èe]se\s+(?:de|en|pr[ée]sent)|travail\s+de\s+fin|\btfc\b|doctoral\s+dissertation|master'?s\s+thesis/i.test(raw)) return "memoire";
  if (/notes?\s+de\s+cours|cours\s+(?:in[ée]dit|polycopi|de\s+)|syllabus/i.test(raw)) return "cours";
  if (article) return "article";
  if (/^(?:in|dans)\s/i.test(after.trim())) return "chapitre";
  if (hint) return hint;
  if (/\brapport\b|\breport\b|working\s+paper|document\s+de\s+travail|note\s+de\s+conjoncture|bulletin|annuaire\s+statistique/i.test(raw)) return "rapport";
  if (url) return "web";
  return "livre";
}

const yearIn = (s: string) => {
  const all = [...s.matchAll(/\b(1[5-9]\d{2}|20\d{2})([a-z])?\b/g)].filter((m) => Number(m[1]) <= CURRENT_YEAR() + 1);
  return all.at(-1) ?? null;
};

export function parseReference(entry: BibliographyEntry, index: number): ParsedReference {
  const raw = entry.raw;
  const hint = kindOfSection(entry.section);
  let w = raw;
  const doiMatch = /(?:https?:\/\/(?:dx\.)?doi\.org\/|\bdoi\s*:\s*)?(10\.\d{4,9}\/[^\s"<>]+)/i.exec(w);
  const doi = doiMatch ? doiMatch[1].replace(/[.,;)\]]+$/, "") : null;
  if (doiMatch) w = w.replace(doiMatch[0], " ");
  const urlMatch = /https?:\/\/[^\s<>"]+/.exec(w);
  const url = urlMatch ? urlMatch[0].replace(/[.,;)\]]+$/, "") : null;
  if (urlMatch) w = w.replace(urlMatch[0], " ");
  const isbnMatch = /\bISBN(?:-1[03])?\s*:?\s*([\dXx][\d\-Xx ]{8,16}[\dXx])/i.exec(w);
  const isbn = isbnMatch ? isbnMatch[1].replace(/[^\dXx]/g, "") : null;
  if (isbnMatch) w = w.replace(isbnMatch[0], " ");
  w = w
    .replace(/\b(?:consult[ée]e?\s+le|r[ée]cup[ée]r[ée]e?\s+(?:le|de|sur)|retrieved\s+(?:from|on)|disponible\s+(?:sur|à))\b[^.]*\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s,]+$/, "");

  let authors: PersonName[] = [];
  let year: number | null = null;
  let yearSuffix = "";
  let noDate = false;
  let rest = w;
  let layout: ParsedReference["layout"] = "classique";

  const apa = /^(.{2,400}?)\s*\(\s*(?:((1[5-9]\d{2}|20\d{2})([a-z])?)|(s\.\s?d\.|n\.\s?d\.))(?:\s*,\s*[^)]*)?\)\s*\.?\s*(.*)$/u.exec(w);
  if (apa && !/[«"“]/.test(apa[1])) {
    layout = "apa";
    authors = parseAuthorsBlock(apa[1]);
    year = apa[3] ? Number(apa[3]) : null;
    yearSuffix = apa[4] ?? "";
    noDate = !!apa[5];
    rest = apa[6];
  } else {
    const read = /^(?:loi|d[ée]cret|ordonnance|arr[êe]t[ée]|constitution|code)\b/i.test(w) ? { authors: [], consumed: 0 } : readAuthors(w, true);
    authors = read.authors;
    rest = w.slice(read.consumed).replace(/^[\s,.:;-]+/, "");
    const y = yearIn(rest);
    if (/\bs\.\s?d\.|\bn\.\s?d\./i.test(rest) && !y) noDate = true;
    if (y) {
      year = Number(y[1]);
      yearSuffix = y[2] ?? "";
      rest = (rest.slice(0, y.index) + rest.slice((y.index ?? 0) + y[0].length)).replace(/\(\s*\)/g, "").replace(/,\s*,/g, ",").replace(/\s+/g, " ").trim();
    }
    if (!authors.length && !/^(?:loi|d[ée]cret|ordonnance|arr[êe]t[ée]|constitution|code)\b/i.test(w)) {
      // Auteur collectif en tête (« Banque centrale du Congo, Rapport annuel 2020, Kinshasa, 2021 »).
      const first = /^([^,]+?),\s*(.+)$/.exec(rest);
      if (first && CORPORATE_WORDS.test(first[1]) && first[1].split(/\s+/).length <= 8) {
        authors = [{ family: first[1].trim(), given: "", corporate: true }];
        rest = first[2];
      }
    }
  }

  // Titre, puis le reste (revue, éditeur…).
  let title: string | null = null;
  let after = "";
  // Titre entre guillemets : présentation classique seulement (en APA, des guillemets peuvent être DANS le titre).
  const quoted = layout === "classique" ? /^[^«"“]{0,6}[«"“]\s*([^»"”]+?)\s*[»"”]\s*[,.]?\s*(.*)$/.exec(rest) : null;
  if (quoted) {
    title = trimEnd(quoted[1]);
    after = quoted[2];
  } else if (layout === "apa") {
    const cut = /^(.+?(?:[^\s.]{2}|\))[.?!])\s+(?=\p{Lu}|\p{N}|In\s|Dans\s|\[|\()/u.exec(rest);
    if (cut) {
      title = trimEnd(cut[1].replace(/[.]$/, ""));
      after = rest.slice(cut[0].length);
    } else title = trimEnd(rest) || null;
    const bracket = /^\[([^\]]+)\]\s*\.?\s*(.*)$/.exec(after);
    if (bracket) after = `[${bracket[1]}] ${bracket[2]}`;
  } else {
    // Présentation classique : le titre continue tant que le morceau suivant commence par une minuscule
    // (« Théorie générale de l'emploi, de l'intérêt et de la monnaie, Payot… »).
    const parts = rest.split(/\s*,\s*/);
    let n = parts.length ? 1 : 0;
    while (n < parts.length && /^\p{Ll}/u.test(parts[n]) && !/^(?:in|dans|vol|n°|no|pp?\.|s\.\s?d|[ée]d|ed)\b/i.test(parts[n])) n += 1;
    title = n ? trimEnd(parts.slice(0, n).join(", ")) || null : null;
    after = parts.slice(n).join(", ");
  }
  // Édition : « (15th ed.) », « (2e éd.) », « 3e édition ».
  let edition: string | null = null;
  const ed = /\(?\s*(\d+)\s*(?:e|ème|eme|th|nd|rd|st)?\s*[ée]d(?:ition|\.)?\s*\)?/i;
  const inTitle = title ? ed.exec(title) : null;
  if (title && inTitle) {
    edition = inTitle[1];
    title = trimEnd(title.replace(inTitle[0], " ").replace(/\s+/g, " "));
  } else {
    const inAfter = ed.exec(after);
    if (inAfter) edition = inAfter[1];
  }
  after = after.replace(/^[\s,.]+/, "").trim();

  // Revue (article) ou éditeur (livre, rapport…).
  let tail = articleTail(after.replace(/^(?:in|dans)\s+/i, ""));
  // « in Revue…, vol. 5, n° 2 » est un article ; « In T. Frängsmyr (Ed.), Ouvrage (pp. …) » un chapitre.
  const chapter = /^(?:in|dans)\s/i.test(after) && !(tail && (tail.volume || tail.issue));
  if (chapter) tail = null;
  let pieces: Pieces = { container: null, volume: null, issue: null, pages: null, publisher: null, place: null };
  if (tail) pieces = { ...pieces, ...tail };
  else if (chapter) {
    const ch = /^(?:in|dans)\s+(?:(.+?)\s*\((?:dir|[ée]ds?|eds?|coord)\.?\)\s*,?\s*)?(.+?)\s*(?:\((?:pp?\.)\s*([\d\s\-–]+)\))?\s*[.,]\s*(.*)$/i.exec(after);
    if (ch) pieces = { ...pieces, container: trimEnd(ch[2]), pages: ch[3]?.replace(/\s/g, "").replace("-", "–") ?? null, ...publisherOf(ch[4] ?? "") };
  } else {
    const bracket = /^\[([^\]]+)\]\s*\.?\s*(.*)$/.exec(after);
    pieces = { ...pieces, ...publisherOf(bracket ? bracket[2] : after) };
    const pages = /\bpp?\.\s*(\d+\s*[-–]\s*\d+|\d+)/.exec(after);
    if (pages) pieces.pages = pages[1].replace(/\s/g, "").replace("-", "–");
  }

  const kind = kindOf(raw, after, hint, url, !!tail);
  if (kind !== "livre" && kind !== "rapport" && kind !== "memoire" && kind !== "chapitre" && kind !== "cours" && !tail) pieces.publisher = pieces.publisher ?? null;
  const uncertain = !title || (!year && !noDate) || (!authors.length && kind !== "texte_juridique") || (kind === "article" && !pieces.container);

  return {
    id: `r${index + 1}`,
    index,
    raw,
    runs: entry.runs,
    authors,
    year,
    yearSuffix,
    noDate,
    title,
    container: pieces.container,
    publisher: kind === "article" ? null : pieces.publisher,
    place: pieces.place,
    edition,
    volume: pieces.volume,
    issue: pieces.issue,
    pages: pieces.pages,
    doi,
    url,
    isbn,
    kind,
    layout,
    section: entry.section,
    uncertain,
  };
}

export function parseBibliography(paragraphs: DocParagraph[]) {
  const split = splitBibliography(paragraphs);
  return { ...split, references: split.entries.map((e, i) => parseReference(e, i)) };
}
