/**
 * Normalisation pour comparer des noms et des titres : minuscules, sans accents ni ponctuation.
 * Ne sert qu'à COMPARER ; le texte de l'étudiant n'est jamais réécrit avec ces formes.
 */

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Forme de comparaison : sans accents, sans ponctuation, espaces simples. */
export const norm = (s: string) =>
  fold(s)
    .replace(/[’'`´]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const TITLE_STOPWORDS = new Set(["the", "a", "an", "of", "and", "in", "on", "for", "to", "le", "la", "les", "un", "une", "des", "de", "du", "d", "l", "et", "en", "au", "aux", "dans", "sur", "pour", "par"]);

export const titleTokens = (s: string) =>
  norm(s)
    .split(" ")
    .filter((w) => w && !TITLE_STOPWORDS.has(w));

/** Distance d'édition (Levenshtein), bornée pour rester rapide sur des titres. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Ressemblance de deux titres (0 à 1) : la meilleure de deux mesures, l'une sur les caractères (fautes de
 * frappe), l'autre sur les mots (mots déplacés, sous-titre omis : « Marketing management » contre
 * « Marketing management: Analysis, planning… »).
 */
export function titleSimilarity(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  const chars = 1 - levenshtein(x.slice(0, 300), y.slice(0, 300)) / Math.max(x.length, y.length, 1);
  const ta = new Set(titleTokens(a));
  const tb = new Set(titleTokens(b));
  if (!ta.size || !tb.size) return Math.max(0, chars);
  const inter = [...ta].filter((w) => tb.has(w)).length;
  // Mots du titre le plus court retrouvés dans l'autre (sous-titre omis), pondérés par la part couverte.
  const containment = inter / Math.min(ta.size, tb.size);
  const coverage = Math.min(ta.size, tb.size) / Math.max(ta.size, tb.size);
  const words = containment * (0.6 + 0.4 * coverage);
  return Math.max(0, Math.min(1, Math.max(chars, words)));
}

/** Particules qui ne suffisent pas à identifier un nom (« de », « van »…). */
const PARTICLES = new Set(["de", "du", "des", "van", "von", "der", "den", "le", "la", "di", "da", "dos", "del", "mc", "wa", "ya"]);

/** Mots significatifs d'un nom de famille (« Mbuyi Kalala » → mbuyi, kalala ; « van Dijk » → dijk). */
export const nameTokens = (family: string) =>
  norm(family)
    .split(" ")
    .filter((w) => w.length > 1 && !PARTICLES.has(w));

/**
 * Deux noms de famille désignent-ils la même personne ? Comparaison tolérante : un nom congolais à
 * plusieurs éléments (« Mbuyi Kalala ») est reconnu par l'un de ses éléments (« Kalala »).
 */
export function sameFamily(a: string, b: string): boolean {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (!x.length || !y.length) return norm(a) === norm(b) && !!norm(a);
  if (x.join(" ") === y.join(" ")) return true;
  return x.some((w) => w.length >= 3 && y.includes(w));
}

export const isUpperName = (s: string) => /\p{Lu}{3,}/u.test(s) && s === s.toUpperCase();

/** « KOTLER » → « Kotler » ; « MBUYI KALALA » → « Mbuyi Kalala » ; « VAN DIJK » → « Van Dijk ». */
export const titleCaseName = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

/** Initiales APA à partir de prénoms (« Philip » → « P. » ; « Jean-Pierre » → « J.-P. » ; « C.W.J. » → « C. W. J. »). */
export function initialsOf(given: string): string {
  const g = given.trim();
  if (!g) return "";
  const initial = (part: string) => {
    const letter = part.replace(/[^\p{L}]/gu, "").charAt(0);
    return letter ? `${letter.toUpperCase()}.` : "";
  };
  return g
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split("-")
        // « C.W.J. » : initiales collées, séparées par des points.
        .map((part) => part.split(/\.(?=\p{L})/u).map(initial).filter(Boolean).join(" "))
        .filter(Boolean)
        .join("-"),
    )
    .filter(Boolean)
    .join(" ");
}

export const CURRENT_YEAR = () => new Date().getFullYear();
