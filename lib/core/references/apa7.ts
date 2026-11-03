/**
 * Mise en forme APA 7 (adaptation française ou version anglaise), avec l'italique. N'utilise QUE les
 * éléments présents : un élément absent n'est jamais inventé (il est signalé par le contrôle de forme).
 * La casse des titres n'est pas modifiée.
 */
import { initialsOf, isUpperName, titleCaseName } from "./text";
import type { Convention, ParsedReference, PersonName, TextRun } from "./types";

export type ApaSource = Pick<ParsedReference, "authors" | "year" | "yearSuffix" | "noDate" | "title" | "container" | "publisher" | "edition" | "volume" | "issue" | "pages" | "doi" | "url" | "kind" | "raw">;

const T = (convention: Convention) =>
  convention === "apa_fr"
    ? { and: "et", noDate: "s.d.", in: "Dans", page: "p.", pages: "p.", edition: (n: string) => `${n}${n === "1" ? "re" : "e"} éd.`, etAl: "et al." }
    : { and: "&", noDate: "n.d.", in: "In", page: "p.", pages: "pp.", edition: (n: string) => `${n}${n.endsWith("1") && n !== "11" ? "st" : n.endsWith("2") && n !== "12" ? "nd" : n.endsWith("3") && n !== "13" ? "rd" : "th"} ed.`, etAl: "et al." };

/** « KOTLER » → « Kotler » ; prénoms → initiales. */
export function apaName(p: PersonName): string {
  if (p.corporate) return p.family.replace(/\.$/, "");
  const family = isUpperName(p.family) ? titleCaseName(p.family) : p.family;
  const initials = initialsOf(p.given);
  return initials ? `${family}, ${initials}` : family;
}

export function apaAuthors(authors: PersonName[], convention: Convention): string {
  const t = T(convention);
  const names = authors.map(apaName);
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length > 20) return `${names.slice(0, 19).join(", ")}, … ${names.at(-1)}`;
  // APA anglaise : virgule avant « & » dès deux auteurs ; adaptation française : « A, B et C ».
  return convention === "apa_en" ? `${names.slice(0, -1).join(", ")}, ${t.and} ${names.at(-1)}` : `${names.slice(0, -1).join(", ")} ${t.and} ${names.at(-1)}`;
}

const end = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`);
const doiLink = (doi: string) => `https://doi.org/${doi}`;
const dash = (pages: string) => pages.replace(/\s*[-–]\s*/, "–");

/** Référence APA 7 sous forme de fragments (texte + italique). */
export function formatApa(ref: ApaSource, convention: Convention): TextRun[] {
  const t = T(convention);
  if (ref.kind === "texte_juridique") return [{ text: ref.raw, italic: false }];
  const runs: TextRun[] = [];
  const push = (text: string, italic = false) => {
    if (!text) return;
    const last = runs.at(-1);
    if (last && last.italic === italic) last.text += text;
    else runs.push({ text, italic });
  };
  const date = `(${ref.noDate || !ref.year ? t.noDate : `${ref.year}${ref.yearSuffix}`}).`;
  const authors = apaAuthors(ref.authors, convention);
  const title = ref.title ?? "";
  // Sans auteur, le titre prend la place de l'auteur.
  if (authors) push(`${end(authors)} ${date} `);
  const ed = ref.edition ? ` (${t.edition(ref.edition)})` : "";
  switch (ref.kind) {
    case "article": {
      if (!authors) push(`${end(title)} ${date} `);
      else if (title) push(`${end(title)} `);
      if (ref.container) {
        push(ref.container, true);
        if (ref.volume) {
          push(", ");
          push(ref.volume, true);
        }
        if (ref.issue) push(`(${ref.issue})`);
        if (ref.pages) push(`, ${dash(ref.pages)}`);
        push(". ");
      }
      break;
    }
    case "chapitre": {
      if (!authors) push(`${end(title)} ${date} `);
      else if (title) push(`${end(title)} `);
      if (ref.container) {
        push(`${t.in} `);
        push(ref.container, true);
        push(ref.pages ? ` (${/[-–]/.test(ref.pages) ? t.pages : t.page} ${dash(ref.pages)}). ` : ". ");
      }
      if (ref.publisher) push(`${end(ref.publisher)} `);
      break;
    }
    case "memoire":
    case "cours": {
      if (authors && title) push(title, true);
      else if (title) push(`${title}`, true);
      if (!authors) push(` ${date}`);
      const kind = ref.kind === "cours" ? (convention === "apa_fr" ? "Notes de cours" : "Lecture notes") : null;
      const bracket = [kind, ref.publisher].filter(Boolean).join(", ");
      push(bracket ? ` [${bracket}]. ` : ". ");
      break;
    }
    default: {
      // Livre, rapport, page web, autre : titre en italique.
      if (title) push(title, true);
      push(`${ed}.`);
      if (!authors) push(` ${date}`);
      push(" ");
      // L'éditeur est omis quand il est l'auteur (rapport d'une institution).
      const sameAsAuthor = ref.authors.length === 1 && ref.authors[0].corporate && ref.publisher && ref.authors[0].family.toLowerCase().includes(ref.publisher.toLowerCase());
      if (ref.publisher && !sameAsAuthor) push(`${end(ref.publisher)} `);
    }
  }
  if (ref.doi) push(doiLink(ref.doi));
  else if (ref.url) push(ref.url);
  const last = runs.at(-1);
  if (last) last.text = last.text.trimEnd();
  return runs;
}

export const runsText = (runs: TextRun[]) => runs.map((r) => r.text).join("");

/** Forme correcte de la citation dans le texte, d'après la référence. */
export function apaInText(ref: Pick<ParsedReference, "authors" | "year" | "yearSuffix" | "noDate">, convention: Convention, narrative: boolean, pages: string | null = null): string {
  const t = T(convention);
  const names = ref.authors.map((a) => (a.corporate ? a.family.replace(/\.$/, "") : isUpperName(a.family) ? titleCaseName(a.family) : a.family));
  const join = narrative && convention === "apa_en" ? "and" : t.and;
  const who = names.length >= 3 ? `${names[0]} ${t.etAl}` : names.length === 2 ? `${names[0]} ${join} ${names[1]}` : (names[0] ?? "?");
  const year = ref.noDate || !ref.year ? t.noDate : `${ref.year}${ref.yearSuffix}`;
  const page = pages ? `, ${pages}` : "";
  return narrative ? `${who} (${year}${page})` : `(${who}, ${year}${page})`;
}
