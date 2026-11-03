/**
 * Contrôle 1 — forme et cohérence, sans internet ni IA :
 * - chaque citation du texte a sa référence, et chaque référence est citée ;
 * - même année des deux côtés, « 2017a / 2017b » quand un auteur a deux textes la même année ;
 * - règles APA 7 : « et al. » dès trois auteurs, « et » ou « & », ordre alphabétique, éléments
 *   indispensables, DOI en lien, italique (document Word), page des citations textuelles.
 */
import { apaInText, formatApa, runsText } from "./apa7";
import { citationLabel } from "./citations";
import { fold, isUpperName, norm, sameFamily, titleSimilarity, CURRENT_YEAR } from "./text";
import { REFERENCE_KIND_LABELS, type Convention, type FormIssue, type InTextCitation, type ParsedReference, type PersonName } from "./types";

/** « BCC » ↔ « Banque Centrale du Congo » ; « INS » ↔ « Institut national de la statistique ». */
const acronymOf = (name: string) =>
  name
    .split(/[\s\-]+/)
    .filter((w) => /^\p{Lu}/u.test(w) && !/^(?:De|Du|Des|La|Le|Les|Et|Of|The|And)$/.test(w))
    .map((w) => w[0])
    .join("")
    .toUpperCase();

function authorMatches(cited: string, person: PersonName): boolean {
  if (sameFamily(cited, person.family)) return true;
  if (person.corporate) {
    const c = norm(cited);
    const f = norm(person.family);
    if (c && (f.includes(c) || c.includes(f))) return true;
    if (/^\p{Lu}{2,}$/u.test(cited) && acronymOf(person.family) === cited) return true;
    // « Banque mondiale » ↔ « Banque mondiale (BM) » : l'acronyme entre parenthèses.
    const paren = /\(([\p{Lu}]{2,})\)/u.exec(person.family)?.[1];
    if (paren && paren === cited) return true;
  }
  return false;
}

export interface CitationLink {
  citationId: string;
  referenceId: string | null;
  /** Référence trouvée, mais avec une autre année. */
  yearMismatch: boolean;
}

export interface ConsistencyResult {
  links: CitationLink[];
  issues: FormIssue[];
  /** Références jamais citées dans le texte. */
  uncited: string[];
}

const SEVERITY_ORDER = { erreur: 0, a_verifier: 1, conseil: 2 } as const;
const yearLabel = (y: number | null, suffix: string, noDate: boolean, convention: Convention) => (noDate || !y ? (convention === "apa_fr" ? "s.d." : "n.d.") : `${y}${suffix}`);
const firstFamily = (r: ParsedReference) => r.authors[0]?.family ?? r.title ?? r.raw;

export function checkConsistency(input: { citations: InTextCitation[]; references: ParsedReference[]; convention: Convention; hasBody: boolean; fromWord: boolean }): ConsistencyResult {
  const { citations, references, convention, hasBody, fromWord } = input;
  const issues: FormIssue[] = [];
  const links: CitationLink[] = [];
  const cited = new Set<string>();

  // 1. Citations → références.
  for (const c of citations) {
    const label = citationLabel(c);
    const byAuthor = references.filter((r) => r.authors.length && authorMatches(c.authors[0] ?? "", r.authors[0]));
    const sameYear = byAuthor.filter((r) => (c.noDate ? r.noDate || !r.year : r.year === c.year && (!c.yearSuffix || r.yearSuffix === c.yearSuffix)));
    if (sameYear.length === 1 || (sameYear.length > 1 && c.yearSuffix)) {
      const r = sameYear[0];
      cited.add(r.id);
      links.push({ citationId: c.id, referenceId: r.id, yearMismatch: false });
      checkCitationForm(c, r, convention, issues);
    } else if (sameYear.length > 1) {
      sameYear.forEach((r) => cited.add(r.id));
      links.push({ citationId: c.id, referenceId: sameYear[0].id, yearMismatch: false });
      issues.push({ code: "citation_ambigue", severity: "erreur", citationId: c.id, message: `« ${label} » : la bibliographie contient ${sameYear.length} textes de cet auteur la même année. Distinguez-les par une lettre (${c.year}a, ${c.year}b), dans le texte comme dans la bibliographie.` });
    } else if (byAuthor.length === 1) {
      const r = byAuthor[0];
      cited.add(r.id);
      links.push({ citationId: c.id, referenceId: r.id, yearMismatch: true });
      issues.push({ code: "annee_differente", severity: "erreur", citationId: c.id, referenceId: r.id, message: `« ${label} » : la bibliographie indique ${yearLabel(r.year, r.yearSuffix, r.noDate, convention)} pour ${firstFamily(r)}. L'année doit être la même dans le texte et dans la bibliographie.`, fix: apaInText(r, convention, c.narrative, c.pages) });
    } else {
      links.push({ citationId: c.id, referenceId: null, yearMismatch: false });
      issues.push({ code: "citation_sans_reference", severity: "erreur", citationId: c.id, message: byAuthor.length > 1 ? `« ${label} » : cette année ne figure pour aucun des ${byAuthor.length} textes de cet auteur dans la bibliographie.` : `« ${label} » est citée dans le texte mais absente de la bibliographie.` });
    }
    // Citation textuelle sans page.
    if (!c.pages && /[«“"][^»”"]{12,}[»”"]/.test(c.sentence)) issues.push({ code: "citation_textuelle_sans_page", severity: "conseil", citationId: c.id, message: `« ${label} » accompagne une citation entre guillemets : APA demande la page (ex. p. 45).` });
  }

  // 2. Références jamais citées.
  const uncited = hasBody ? references.filter((r) => !cited.has(r.id)).map((r) => r.id) : [];
  for (const id of uncited) {
    const r = references.find((x) => x.id === id)!;
    issues.push({ code: "reference_non_citee", severity: "a_verifier", referenceId: id, message: `${firstFamily(r)} (${yearLabel(r.year, r.yearSuffix, r.noDate, convention)}) figure dans la bibliographie mais n'est cité nulle part dans le texte. En APA, la bibliographie ne contient que les textes cités.` });
  }

  // 3. Forme de chaque référence.
  for (const r of references) checkReferenceForm(r, convention, fromWord, issues);

  // 4. Ordre alphabétique (premier auteur, puis année).
  const key = (r: ParsedReference) => `${fold(firstFamily(r))}|${r.year ?? 0}`;
  for (let i = 1; i < references.length; i += 1) {
    if (references[i - 1].section !== references[i].section) continue;
    if (key(references[i]) < key(references[i - 1])) {
      issues.push({ code: "ordre_alphabetique", severity: "conseil", referenceId: references[i].id, message: `Ordre alphabétique : ${firstFamily(references[i])} devrait précéder ${firstFamily(references[i - 1])}.` });
      break;
    }
  }

  // 5. Doublons.
  for (let i = 0; i < references.length; i += 1) {
    for (let j = i + 1; j < references.length; j += 1) {
      const a = references[i];
      const b = references[j];
      if (a.title && b.title && a.year === b.year && titleSimilarity(a.title, b.title) > 0.92) issues.push({ code: "doublon", severity: "a_verifier", referenceId: b.id, message: `Référence en double : « ${b.title} » (${b.year ?? "s.d."}) apparaît deux fois.` });
    }
  }

  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { links, issues, uncited };
}

function checkCitationForm(c: InTextCitation, r: ParsedReference, convention: Convention, issues: FormIssue[]) {
  const label = citationLabel(c);
  const n = r.authors.length;
  const expected = apaInText(r, convention, c.narrative, c.pages);
  if (r.authors[0]?.corporate) return;
  if (c.etAl && n > 0 && n < 3) issues.push({ code: "et_al_injustifie", severity: "erreur", citationId: c.id, referenceId: r.id, message: `« ${label} » : « et al. » ne s'emploie qu'à partir de trois auteurs ; ce texte en a ${n}.`, fix: expected });
  else if (!c.etAl && n >= 3 && c.authors.length >= 3) issues.push({ code: "et_al_attendu", severity: "conseil", citationId: c.id, referenceId: r.id, message: `« ${label} » : en APA 7, dès trois auteurs, on écrit le premier suivi de « et al. », dès la première citation.`, fix: expected });
  else if (!c.etAl && n === 2 && c.authors.length === 1) issues.push({ code: "second_auteur_omis", severity: "erreur", citationId: c.id, referenceId: r.id, message: `« ${label} » : ce texte a deux auteurs ; citez les deux à chaque fois.`, fix: expected });
  if (c.authors.length === 2 && n === 2 && !sameFamily(c.authors[1], r.authors[1].family)) issues.push({ code: "second_auteur_different", severity: "a_verifier", citationId: c.id, referenceId: r.id, message: `« ${label} » : le second auteur ne correspond pas à la bibliographie (${r.authors[1].family}).`, fix: expected });
  if (c.connector) {
    const wanted = convention === "apa_fr" ? "et" : c.narrative ? "and" : "&";
    if (c.connector !== wanted) issues.push({ code: "connecteur", severity: "conseil", citationId: c.id, message: `« ${label} » : ${convention === "apa_fr" ? "en français, on relie les auteurs par « et »" : c.narrative ? "dans une citation narrative, on écrit « and »" : "entre parenthèses, on écrit « & »"}.`, fix: expected });
  }
}

const REQUIRED: Partial<Record<ParsedReference["kind"], Array<[keyof ParsedReference, string]>>> = {
  article: [
    ["container", "le nom de la revue"],
    ["volume", "le volume"],
    ["pages", "les pages"],
  ],
  livre: [["publisher", "l'éditeur"]],
  chapitre: [
    ["container", "le titre de l'ouvrage collectif"],
    ["pages", "les pages du chapitre"],
    ["publisher", "l'éditeur"],
  ],
  memoire: [["publisher", "le type de travail et l'établissement (ex. « Mémoire de licence, Université de Lubumbashi »)"]],
};

function checkReferenceForm(r: ParsedReference, convention: Convention, fromWord: boolean, issues: FormIssue[]) {
  const who = `${firstFamily(r)} (${yearLabel(r.year, r.yearSuffix, r.noDate, convention)})`;
  const fix = runsText(formatApa(r, convention));
  if (r.kind === "texte_juridique") return;
  if (r.uncertain) issues.push({ code: "lecture_incertaine", severity: "a_verifier", referenceId: r.id, message: `Lecture incertaine : ACADIA n'a pas reconnu avec assurance tous les éléments de « ${r.raw.slice(0, 90)}${r.raw.length > 90 ? "…" : ""} ». Vérifiez-la.` });
  if (r.layout === "classique" && r.authors.length) issues.push({ code: "presentation_non_apa", severity: "erreur", referenceId: r.id, message: `${who} : présentation non APA. En APA, l'année vient juste après les auteurs : « Auteur, I. (année). Titre… ».`, fix });
  if (!r.year && !r.noDate) issues.push({ code: "annee_manquante", severity: "erreur", referenceId: r.id, message: `${firstFamily(r)} : année manquante. Si le document n'est pas daté, écrivez « ${convention === "apa_fr" ? "s.d." : "n.d."} ».` });
  if (r.year && r.year > CURRENT_YEAR() + 1) issues.push({ code: "annee_future", severity: "erreur", referenceId: r.id, message: `${who} : cette année est dans le futur.` });
  if (r.noDate && convention === "apa_fr" && /\bn\.\s?d\./i.test(r.raw)) issues.push({ code: "sans_date_langue", severity: "conseil", referenceId: r.id, message: `${firstFamily(r)} : en français, « s.d. » (sans date) plutôt que « n.d. ».` });
  const persons = r.authors.filter((a) => !a.corporate);
  if (persons.some((a) => isUpperName(a.family)) && r.layout === "apa") issues.push({ code: "nom_majuscules", severity: "conseil", referenceId: r.id, message: `${who} : en APA, les noms s'écrivent en minuscules avec une majuscule initiale (« ${persons.map((a) => (isUpperName(a.family) ? a.family.charAt(0) + a.family.slice(1).toLowerCase() : a.family))[0]} »).`, fix });
  if (persons.some((a) => /\p{Ll}{2,}/u.test(a.given))) issues.push({ code: "prenoms_complets", severity: "conseil", referenceId: r.id, message: `${who} : en APA, les prénoms sont abrégés en initiales (« ${persons.find((a) => /\p{Ll}{2,}/u.test(a.given))!.given} » → initiales).`, fix });
  for (const [field, label] of REQUIRED[r.kind] ?? []) {
    if (!r[field]) issues.push({ code: `manque_${String(field)}`, severity: "a_verifier", referenceId: r.id, message: `${who} (${REFERENCE_KIND_LABELS[r.kind].toLowerCase()}) : il manque ${label}.` });
  }
  if (/\bdoi\s*:/i.test(r.raw)) issues.push({ code: "doi_format", severity: "conseil", referenceId: r.id, message: `${who} : en APA 7, le DOI s'écrit sous forme de lien : https://doi.org/${r.doi ?? "…"}.`, fix });
  if (r.kind === "article" && /\bpp?\.\s*\d/.test(r.raw) && r.layout === "apa") issues.push({ code: "pp_article", severity: "conseil", referenceId: r.id, message: `${who} : pour un article, APA 7 indique les pages sans « pp. » (ex. 45–67).`, fix });
  if (fromWord && !r.runs.some((x) => x.italic && x.text.trim().length > 2) && ["livre", "article", "rapport", "memoire", "chapitre", "web"].includes(r.kind)) issues.push({ code: "italique_manquant", severity: "conseil", referenceId: r.id, message: `${who} : ${r.kind === "article" ? "le nom de la revue et le volume" : r.kind === "chapitre" ? "le titre de l'ouvrage collectif" : "le titre"} doi${r.kind === "article" ? "vent" : "t"} être en italique.`, fix });
}
