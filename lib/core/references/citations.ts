/**
 * Repérage des citations « auteur-date » dans le texte :
 * - entre parenthèses : (Kotler, 2017) ; (Kotler et Keller, 2016, p. 45) ; (Kotler et al., 2017 ; BCC, 2021) ;
 *   (Kotler, 2015, 2017) ; (Banque mondiale, s.d.) ;
 * - narratives : Kotler (2017) ; Selon Mbuyi Kalala (2015, p. 12) ; Kotler et Keller (2016).
 * Règles fixes, sans IA : ce qui n'a pas la forme d'une citation n'est pas compté.
 */
import type { DocParagraph, InTextCitation } from "./types";

const YEAR = String.raw`(?:1[5-9]\d{2}|20\d{2})[a-z]?`;
const NO_DATE = String.raw`s\.\s?d\.|n\.\s?d\.`;
const YEARS = String.raw`(?:${YEAR}|${NO_DATE})(?:\s*,\s*${YEAR})*`;
const PAGES = String.raw`(?:pp?\.|chap\.|§)\s*[\d\s\-–,]*\d`;

const NARRATIVE_YEAR = new RegExp(String.raw`\((${YEARS})(?:\s*,\s*(${PAGES}))?\)`, "gu");
const PART = new RegExp(String.raw`^(?:(?:voir|cf\.?|v\.|e\.g\.,?|p\.\s?ex\.,?|see|[Ss]ources?\s*:)\s*)?((?:(?:de|du|van|von|der|di|da|le|la)\s)?[\p{Lu}][^\d();]{0,118}?)\s*,\s*(${YEARS})(?:\s*,\s*(${PAGES}))?$`, "u");
const YEARS_ONLY = new RegExp(String.raw`^(${YEARS})(?:\s*,\s*(${PAGES}))?$`, "u");

/** Mots en tête de phrase qui précèdent un nom sans en faire partie (« Selon Kotler (2017) »). */
const LEAD_WORDS = new Set(
  "Selon D'après D’après Pour Chez Comme Ainsi En Le La Les Dans Voir Cf Mais Or Et Pourtant Enfin Alors Donc Aussi Si Car Puis Ensuite Toutefois Cependant Néanmoins Lorsque Quand Tandis Il Elle Ils Elles Nous On Cette Ce Ces Cet Leur Son Sa Ses Notre Nos Votre Une Un Des Du De Par Sur Avec Après Avant Contrairement Suivant According As In The This These Following Since While For By".split(" "),
);

const split = (group: string) => {
  const etAl = /\s+et\s+al\.?$/.test(group);
  const body = group.replace(/\s+et\s+al\.?$/, "").trim();
  const connector = /\s&\s|&/.test(body) ? "&" : /\sand\s/.test(body) ? "and" : /\set\s/.test(body) ? "et" : null;
  const authors = body
    .split(/\s*,\s*|\s+et\s+|\s*&\s*|\s+and\s+/)
    .map((a) => a.trim())
    .filter(Boolean);
  return { authors, etAl, connector: connector as InTextCitation["connector"] };
};

const yearParts = (years: string) =>
  years.split(/\s*,\s*/).map((y) => {
    const noDate = /^(?:s|n)\.\s?d\.$/.test(y);
    const m = /^(\d{4})([a-z]?)$/.exec(y);
    return { year: m ? Number(m[1]) : null, suffix: m?.[2] ?? "", noDate };
  });

/** Phrases d'un paragraphe (sans couper après « et al. » ou « p. »). */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+(?=[«"“\p{Lu}])/u).filter(Boolean);
}
const sentenceOf = (text: string, raw: string) => sentences(text).find((s) => s.includes(raw)) ?? text;

export function findCitations(paragraphs: DocParagraph[]): InTextCitation[] {
  const out: Array<Omit<InTextCitation, "id">> = [];
  for (const p of paragraphs) {
    // 1. Citations entre parenthèses (une parenthèse peut en contenir plusieurs, séparées par « ; »).
    for (const m of p.text.matchAll(/\(([^()]{4,240})\)/g)) {
      let previous: ReturnType<typeof split> | null = null;
      for (const part of m[1].split(/\s*;\s*/)) {
        const trimmed = part.trim();
        const full = PART.exec(trimmed);
        const group = full ? split(full[1]) : null;
        const only: RegExpExecArray | null = !full && previous ? YEARS_ONLY.exec(trimmed) : null;
        const who: ReturnType<typeof split> | null = group && group.authors.length && group.authors.every((a) => /^(?:[a-z]+\s)?(?:[DdLl]['’])?\p{Lu}/u.test(a)) ? group : only ? previous : null;
        if (!who) continue;
        previous = who;
        const years = full ? full[2] : only![1];
        const pages = (full ? full[3] : only![2]) ?? null;
        for (const y of yearParts(years)) out.push({ raw: m[0], authors: who.authors, etAl: who.etAl, connector: who.connector, year: y.year, yearSuffix: y.suffix, noDate: y.noDate, pages, narrative: false, paragraphIndex: p.index, footnote: p.footnote, sentence: sentenceOf(p.text, m[0]) });
      }
    }
    // 2. Citations narratives : on part de « (année) » et on remonte jusqu'au nom qui la précède
    // (« Selon Mbuyi Kalala (2015) », « la théorie de Keynes (1936) », « la Banque mondiale (s.d.) »).
    for (const m of p.text.matchAll(NARRATIVE_YEAR)) {
      const before = p.text.slice(0, m.index).trimEnd();
      if (!/[\p{L}.]$/u.test(before)) continue;
      const words = before.split(/\s+/).slice(-6);
      while (words.length && (!/^(?:[DL]['’])?\p{Lu}/u.test(words[0]) || LEAD_WORDS.has(words[0]) || /[.!?:;]$/.test(words[0]) || /^\d/.test(words[0]))) words.shift();
      let group = words.join(" ").replace(/[,;:]$/, "");
      // « En Afrique, Kotler (2016) » : sans « et », seul le dernier élément d'une énumération est l'auteur.
      if (group.includes(",") && !/\s(?:et|&|and)\s|&/.test(group)) group = group.slice(group.lastIndexOf(",") + 1).trim();
      if (!group) continue;
      const who = split(group);
      if (!who.authors.length || !who.authors.every((a) => /^(?:[a-z]+\s)?(?:[DdLl]['’])?\p{Lu}/u.test(a))) continue;
      const raw = `${group} ${m[0]}`;
      for (const y of yearParts(m[1])) out.push({ raw, authors: who.authors, etAl: who.etAl, connector: who.connector, year: y.year, yearSuffix: y.suffix, noDate: y.noDate, pages: m[2] ?? null, narrative: true, paragraphIndex: p.index, footnote: p.footnote, sentence: sentenceOf(p.text, group) });
    }
  }
  return out.map((c, i) => ({ ...c, id: `c${i + 1}` }));
}

/** Forme courte d'une citation pour l'affichage : « Kotler et Keller, 2016 ». */
export function citationLabel(c: InTextCitation): string {
  const names = c.etAl ? `${c.authors[0]} et al.` : c.authors.length > 1 ? `${c.authors.slice(0, -1).join(", ")} ${c.connector ?? "et"} ${c.authors.at(-1)}` : (c.authors[0] ?? "?");
  return `${names}, ${c.noDate ? "s.d." : `${c.year ?? "?"}${c.yearSuffix}`}`;
}
