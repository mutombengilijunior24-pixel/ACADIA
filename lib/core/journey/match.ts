/**
 * Rapprochement de textes tolérant aux fautes de frappe des exports réels
 * (« garentie » ≈ « garantie », « CREDITQuel » = « CREDIT Quel »).
 * Les mots fréquents dans l'ensemble des textes comparés (« crédit » dans tout un questionnaire
 * sur le crédit) pèsent moins que les mots rares (pondération IDF).
 */
import { contentStems } from "@/lib/core/understanding/text";

/** Sépare un titre de section collé à la question : « RATIONNEMENT DU CREDITQuel » → « … CREDIT Quel ». */
export function splitGlued(text: string): string {
  return text.replace(/([A-ZÀ-Ý]{2,})([A-ZÀ-Ý][a-zà-ÿ])/g, "$1 $2");
}

export function tokensOf(text: string): string[] {
  return [...new Set(contentStems(splitGlued(text)).filter((t) => t.length >= 2 && !/^\d+$/.test(t)))];
}

function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, current[j]);
    }
    if (best > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/** Similarité de deux racines : identiques 1 ; une faute 0,85 ; deux fautes (mots longs) 0,7 ; même début (≥ 5 lettres) 0,5. */
export function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const shortest = Math.min(a.length, b.length);
  if (shortest >= 5 && levenshtein(a, b, 1) <= 1) return 0.85;
  if (shortest >= 7 && levenshtein(a, b, 2) <= 2) return 0.7;
  let prefix = 0;
  while (prefix < shortest && a[prefix] === b[prefix]) prefix += 1;
  return prefix >= 5 ? 0.5 : 0;
}

export interface Corpus {
  idf: (token: string) => number;
}

/** IDF sur un ensemble de textes cibles (df compté avec la même tolérance aux fautes). */
export function corpusOf(texts: string[]): Corpus {
  const docs = texts.map(tokensOf);
  const n = Math.max(1, docs.length);
  const cache = new Map<string, number>();
  return {
    idf: (token) => {
      const known = cache.get(token);
      if (known !== undefined) return known;
      const df = docs.filter((doc) => doc.some((t) => tokenSimilarity(token, t) >= 0.85)).length;
      const value = Math.log(1 + n / (1 + df)) + 0.1;
      cache.set(token, value);
      return value;
    },
  };
}

export interface MatchScore {
  score: number;
  matched: Array<{ token: string; with: string; similarity: number }>;
}

/** Part (pondérée) des mots de `source` retrouvés dans `target` — entre 0 et 1. */
export function coverage(source: string[], target: string[], corpus?: Corpus): MatchScore {
  if (!source.length || !target.length) return { score: 0, matched: [] };
  let total = 0;
  let got = 0;
  const matched: MatchScore["matched"] = [];
  for (const token of source) {
    const weight = corpus ? corpus.idf(token) : 1;
    total += weight;
    let best = 0;
    let bestWith = "";
    for (const t of target) {
      const s = tokenSimilarity(token, t);
      if (s > best) {
        best = s;
        bestWith = t;
      }
    }
    if (best > 0) {
      got += weight * best;
      matched.push({ token, with: bestWith, similarity: best });
    }
  }
  return { score: total ? got / total : 0, matched };
}
